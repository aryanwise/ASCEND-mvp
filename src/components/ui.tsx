'use client';
import React from 'react';
import ReactDOM from 'react-dom';
import { C, SERIF } from '@/lib/design';

export function Logo({ size = 38 }: { size?: number }) {
  const radius = Math.round(size * 0.26);
  return (
    <svg width={size} height={size} viewBox="0 0 1254 1254" style={{ borderRadius: radius, display: 'block', flexShrink: 0 }} aria-label="Ascend">
      <rect width="1254" height="1254" fill="#5A1022" />
      <g transform="translate(0,1254) scale(0.1,-0.1)" fill="#F3ECE2">
        <path d="M6256 10177 c-21 -56 -86 -223 -143 -372 -100 -257 -134 -347 -328 -860 -46 -121 -140 -371 -210 -555 -253 -668 -498 -1320 -582 -1545 -47 -126 -154 -414 -238 -640 -84 -225 -209 -561 -278 -745 -69 -184 -136 -366 -150 -405 -14 -38 -54 -149 -90 -245 -36 -96 -88 -236 -115 -310 -549 -1483 -580 -1553 -788 -1750 -157 -149 -348 -220 -662 -245 -77 -7 -83 -9 -80 -29 l3 -21 965 0 965 0 3 21 c3 20 -4 22 -125 33 -176 16 -327 52 -431 102 -229 111 -285 284 -206 638 44 197 90 330 441 1281 58 157 112 304 120 328 l15 42 1540 -2 1539 -3 150 -385 c534 -1374 542 -1397 543 -1595 1 -141 -14 -185 -87 -259 -88 -87 -210 -128 -439 -148 -131 -11 -139 -13 -136 -32 l3 -21 1150 -2 c633 -1 1205 0 1273 3 107 6 122 9 122 24 0 14 -17 19 -112 28 -224 23 -372 85 -484 204 -145 155 -214 295 -498 1013 -63 160 -184 466 -268 680 -85 215 -201 507 -258 650 -112 285 -241 610 -567 1430 -117 297 -281 709 -363 915 -898 2266 -1143 2880 -1150 2880 -3 0 -22 -46 -44 -103z m-122 -1972 c37 -93 80 -204 96 -245 16 -41 100 -255 185 -475 86 -220 178 -456 204 -525 27 -69 99 -255 161 -415 61 -159 149 -384 195 -500 254 -643 414 -1059 409 -1067 -3 -4 -683 -8 -1511 -8 -1429 0 -1505 1 -1498 18 4 9 53 143 110 297 214 579 674 1811 785 2105 140 369 532 1410 576 1530 3 8 54 -111 113 -265 59 -154 138 -356 175 -450z" />
      </g>
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
        color: C.onAccent,
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
      {loading && <Spinner size={18} color={C.onAccent} />}
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
          maxHeight: '90svh',
          marginBottom: 'var(--kb, 0px)',
          transition: 'margin-bottom 0.15s ease-out',
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

// Renders children via portal to document.body — used to anchor the bottom nav
// to the true device viewport so the keyboard simply covers it (instead of the
// nav floating up above the keyboard when the visual viewport shrinks).
export function BodyPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  if (!mounted || typeof document === 'undefined') return null;
  return ReactDOM.createPortal(children, document.body);
}
