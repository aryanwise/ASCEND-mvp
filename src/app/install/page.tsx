'use client';
import React, { useEffect, useState } from 'react';
import { C, SERIF } from '@/lib/design';
import { Logo, PrimaryButton } from '@/components/ui';
import { isStandalone, detectPlatform } from '@/lib/session';

export default function InstallPage() {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [notYet, setNotYet] = useState(false);

  useEffect(() => {
    if (isStandalone()) { window.location.href = '/auth'; return; }
    setPlatform(detectPlatform());
  }, []);

  function proceed() {
    if (isStandalone()) {
      window.location.href = '/auth';
    } else {
      setNotYet(true);
    }
  }

  const steps =
    platform === 'ios'
      ? [
          'Tap the Share icon in Safari (square with an arrow pointing up).',
          'Scroll down and tap "Add to Home Screen".',
          'Tap "Add" in the top-right corner.',
          'Close Safari and open Ascend from your home screen.',
        ]
      : platform === 'android'
      ? [
          'Tap the ⋮ menu in Chrome (top-right).',
          'Tap "Add to Home screen" or "Install app".',
          'Confirm by tapping "Install".',
          'Open Ascend from your home screen.',
        ]
      : [
          'Open this page on your phone for the full experience.',
          'In your browser menu, choose "Install" or "Add to Home Screen".',
          'Install Ascend as an app.',
          'Open Ascend from your home screen.',
        ];

  return (
    <div className="shell">
      <div className="scrollarea" style={{ padding: '0 24px' }}>
        <div style={{ paddingTop: 'max(56px, env(safe-area-inset-top))', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Logo size={52} />
          <div className="serif" style={{ fontSize: 27, fontWeight: 600, textAlign: 'center' }}>Add Ascend to your home screen</div>
          <div style={{ color: C.muted, fontSize: 14.5, textAlign: 'center', maxWidth: 310, lineHeight: 1.5 }}>
            Ascend needs to be installed to send you reminders and keep you accountable. This only takes a few seconds.
          </div>
        </div>

        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: C.orangeSoft, color: C.orange, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF }}>{i + 1}</div>
              <div style={{ fontSize: 14.5, color: C.dark, lineHeight: 1.45 }}>{s}</div>
            </div>
          ))}
        </div>

        {notYet && (
          <div className="fadein" style={{ marginTop: 18, padding: '13px 15px', background: '#FDDEDE', borderRadius: 13, fontSize: 13.5, color: '#C62828', lineHeight: 1.5 }}>
            You&apos;re still in the browser. Finish the steps above, then open <b>Ascend from your home screen</b> to continue — not from here.
          </div>
        )}

        <div style={{ marginTop: 24, paddingBottom: 32 }}>
          <PrimaryButton onClick={proceed}>I&apos;ve added it — continue</PrimaryButton>
        </div>
      </div>
    </div>
  );
}