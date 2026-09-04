'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TEMPLATES, OVERDUE_HELLO_TREATMENTS, composeMessage, findUnresolvedTokens, type TemplateEntry, type OverdueHelloTreatment } from '@/lib/templates';
import { dispatchViaGmail } from '@/lib/gmail-dispatch';
import { getDb } from '@/lib/db';
import type { NetworkType, CultivationPathway } from '@/lib/types';

// Display labels only, the underlying values are the real NetworkType
// enum from lib/types.ts. Do not add categories here that don't exist
// in that type, the two must stay in sync.
const NETWORK_TYPE_LABELS: Record<NetworkType, string> = {
  EXECUTIVE_CORPORATE: 'Executive & Corporate',
  CREATOR_BRAND_MEDIA: 'Creator, Brand & Media',
  FOUNDER_VENTURE: 'Founder & Venture',
  ADVISOR_STRATEGIC_SERVICES: 'Advisor & Strategic Services',
  COMMERCIAL_SALES_PARTNERSHIPS: 'Commercial, Sales & Partnerships',
  RECRUITER_TALENT: 'Recruiter & Talent',
};

const NETWORK_TYPES = Object.keys(NETWORK_TYPE_LABELS) as NetworkType[];

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [selectedType, setSelectedType] = useState<NetworkType>('EXECUTIVE_CORPORATE');
  const [selectedEntry, setSelectedEntry] = useState<TemplateEntry | OverdueHelloTreatment | null>(null);
  const [firstName, setFirstName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  if (status !== 'authenticated' || !session) {
    return (
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>
        <p style={{ opacity: 0.6 }}>Loading...</p>
      </main>
    );
  }

  const pathwaysForType = TEMPLATES[selectedType];
  const composed = selectedEntry
    ? composeMessage(selectedEntry, {
        firstName: firstName || '[First Name]',
        companyName: companyName || '[Company Name]',
      })
    : null;
  const unresolvedTokens = composed ? findUnresolvedTokens(composed) : [];

  async function handleLogToLedger() {
    if (!composed || !selectedEntry) return;
    // VAULT mode here deliberately, not EPHEMERAL. Ephemeral's in-memory
    // backend is intentionally unimplemented in lib/db.ts, it throws
    // rather than silently falling back to real storage. Vault mode
    // uses real IndexedDB and works right now.
    const db = getDb('VAULT');
    const pathway: CultivationPathway = 'pathway' in selectedEntry ? selectedEntry.pathway : 'OVERDUE_HELLO';
    await db.ledgerEntries.add({
      entryId: crypto.randomUUID(),
      contactId: 'demo-contact', // real contact IDs come from CSV import, not yet built
      dispatchedAt: new Date().toISOString(),
      pathway,
      subjectLine: composed.subjectLine,
      outcome: 'DELIVERED',
      impressionCreated: true,
    });
    setStatusMessage('Logged to local Ledger (Dexie, Vault mode, real IndexedDB). Nothing sent anywhere.');
  }

  async function handleSendViaGmail() {
    if (!composed || !session.accessToken || !recipientEmail) {
      setStatusMessage('Need a composed message, a recipient email, and an active session.');
      return;
    }
    const result = await dispatchViaGmail(
      {
        to: recipientEmail,
        subjectLine: composed.subjectLine,
        fullBody: composed.fullBody,
        senderName: session.user?.name ?? 'SPARX User',
        senderEmail: session.user?.email ?? '',
      },
      session.accessToken
    );
    if (result.success) {
      setStatusMessage(`Sent. Gmail message ID: ${result.messageId}`);
    } else {
      // Expected to fail right now: the compliance footer in
      // lib/gmail-dispatch.ts is still placeholder text on purpose.
      setStatusMessage(`Blocked: ${result.error}`);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontWeight: 300, letterSpacing: '0.02em', fontSize: 28 }}>Your Network Assets Workspace</h1>
        <button onClick={() => signOut()}>Sign out</button>
      </div>
      <p style={{ opacity: 0.6, fontSize: 13, marginTop: 4 }}>Signed in as {session.user?.email}</p>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 15, opacity: 0.7 }}>1. Network type</h2>
        <select value={selectedType} onChange={(e) => { setSelectedType(e.target.value as NetworkType); setSelectedEntry(null); }}>
          {NETWORK_TYPES.map((type) => (
            <option key={type} value={type}>{NETWORK_TYPE_LABELS[type]}</option>
          ))}
        </select>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 15, opacity: 0.7 }}>2. Way to Cultivate</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pathwaysForType.map((entry) => (
            <button
              key={entry.pathway}
              onClick={() => setSelectedEntry(entry)}
              style={{ textAlign: 'left', padding: 8, opacity: selectedEntry === entry ? 1 : 0.7 }}
            >
              {entry.pathway.replace(/_/g, ' ')} &mdash; {entry.subjectLine}
            </button>
          ))}
          {OVERDUE_HELLO_TREATMENTS.map((treatment) => (
            <button
              key={treatment.id}
              onClick={() => setSelectedEntry(treatment)}
              style={{ textAlign: 'left', padding: 8, opacity: selectedEntry === treatment ? 1 : 0.7 }}
            >
              Overdue Hello, {treatment.name} &mdash; {treatment.subjectLine}
            </button>
          ))}
        </div>
      </section>

      {selectedEntry && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 15, opacity: 0.7 }}>3. Fill in what SPARX doesn't already know</h2>
          <input placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ marginRight: 8 }} />
          <input placeholder="Company Name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={{ marginRight: 8 }} />
          <input placeholder="Recipient email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
        </section>
      )}

      {composed && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 15, opacity: 0.7 }}>Live Preview</h2>
          <div style={{ border: '1px solid #333', padding: 16, borderRadius: 4 }}>
            <p style={{ fontWeight: 600 }}>Subject: {composed.subjectLine}</p>
            <p style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{composed.fullBody}</p>
          </div>
          {unresolvedTokens.length > 0 && (
            <p style={{ fontSize: 13, opacity: 0.6, marginTop: 8 }}>
              Unresolved tokens, still need real context: {unresolvedTokens.join(', ')}
            </p>
          )}
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button onClick={handleLogToLedger}>Log to Ledger (local only)</button>
            <button onClick={handleSendViaGmail}>Send via Gmail</button>
          </div>
        </section>
      )}

      {statusMessage && (
        <p style={{ marginTop: 16, fontSize: 13, opacity: 0.8 }}>{statusMessage}</p>
      )}
    </main>
  );
}
