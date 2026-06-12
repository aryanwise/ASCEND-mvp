'use client';
import React from 'react';
import ReactDOM from 'react-dom';
import { C, SERIF } from '@/lib/design';

export function Logo({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" fill="none">
      <rect width="38" height="38" rx="10" fill="#D9531E" />
      <path d="M10 28L19 10L28 28" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.5 22H23.5" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Spinner({ size = 22, color = C.orange }: { size?: number; color?: string }) {
  return (
    <span
      className="spin"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `2.5px solid ${color}33`,
        borderTopColor: color,
        borderRadius: '50%',
      }}
    />
  );
}

export function FullLoader({ label }: { label?: string }) {
  return (
    <div className="shell" style={{ alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <Logo size={54} />
      <div className="serif" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '0.04em' }}>Ascend</div>
      {label && <div style={{ color: C.muted, fontSize: 14 }}>{label}</div>}
      <Spinner />
    </div>
  );
}

export function PrimaryButton({
  children, onClick, disabled, loading, style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: '100%',
        padding: '15px',
        borderRadius: 14,
        background: disabled || loading ? C.faint : C.orange,
        color: '#fff',
        fontSize: 16,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        transition: 'transform 0.1s, background 0.2s',
        ...style,
      }}
    >
      {loading && <Spinner size={18} color="#fff" />}
      {children}
    </button>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 18,
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export const headingStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontSize: 24,
  fontWeight: 600,
  color: C.dark,
  margin: 0,
};

// Bottom sheet that renders via portal to document.body, escaping the shell's
// scroll/transform context so position:fixed truly anchors to the viewport.
// Caps at the visible height and scrolls internally — never gets cut off.
export function BottomSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  if (!mounted || typeof document === 'undefined') return null;
  return ReactDOM.createPortal(
    <div onClick={onClose} className="fadein"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(26,24,21,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 430,
          maxHeight: 'calc(var(--app-vh, 100svh) - 40px)',
          display: 'flex', flexDirection: 'column',
          background: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26,
          boxShadow: '0 -8px 40px rgba(0,0,0,0.25)',
        }}>
        <div style={{ flexShrink: 0, padding: '12px 0 0' }}>
          <div style={{ width: 40, height: 4, background: C.sand, borderRadius: 3, margin: '0 auto' }} />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '12px 20px max(24px, env(safe-area-inset-bottom))' }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
