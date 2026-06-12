'use client';
import React from 'react';
import { C, SERIF } from '@/lib/design';
import { Logo } from '@/components/ui';

export default function AssistantPage() {
  return (
    <div style={{ padding: 'max(20px, env(safe-area-inset-top)) 20px 20px', minHeight: 'calc(100dvh - 120px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 16 }}>
      <Logo size={48} />
      <h1 className="serif" style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>Assistant</h1>
      <div style={{ display: 'inline-block', padding: '7px 16px', borderRadius: 999, background: C.orangeSoft, color: C.orange, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>
        COMING SOON
      </div>
      <p style={{ color: C.muted, fontSize: 14.5, maxWidth: 280, lineHeight: 1.5, margin: 0 }}>
        A proactive assistant that plans your day, nudges you at the right moments, and handles the busywork. In the works.
      </p>
    </div>
  );
}
