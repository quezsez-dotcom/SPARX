'use client';

import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  if (status === 'loading' || status === 'authenticated') {
    // authenticated shows briefly while the redirect above fires
    return (
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>
        <p style={{ opacity: 0.6 }}>Loading...</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontWeight: 300, letterSpacing: '0.02em' }}>Connections are Assets.</h1>
      <p style={{ opacity: 0.7, marginTop: 12 }}>
        SPARX helps you turn the professional relationships you've already built into an active
        network you can thoughtfully cultivate.
      </p>
      <button onClick={() => signIn('google')} style={{ marginTop: 24 }}>
        Sign in with Google
      </button>
    </main>
  );
}
