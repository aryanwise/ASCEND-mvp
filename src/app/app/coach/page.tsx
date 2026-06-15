'use client';
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { waitForSession } from '@/lib/session';
import { C, SERIF } from '@/lib/design';
import { Logo, BottomSheet } from '@/components/ui';
import type { ChatMessage } from '@/lib/types';

interface Session { session_id: string; session_title: string; }

const SUGGESTIONS = [
  'I keep skipping my workouts — help me figure out why.',
  'Plan my week so I actually hit my goals.',
  'I feel behind. Talk me through it.',
];

const COMMANDS = [
  { cmd: '@modify', desc: 'Adjust a goal or task', active: true },
  { cmd: '@build', desc: 'Create a new goal', active: false },
  { cmd: '@reflect', desc: 'Process a setback', active: false },
  { cmd: '@check', desc: 'Review progress', active: false },
  { cmd: '@reschedule', desc: 'Move things around', active: false },
];

export default function CoachPage() {
  const [userId, setUserId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sending, setSending] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showCmds, setShowCmds] = useState(false);
  const [inbox, setInbox] = useState<{ id: string; text: string; kind: string; created_at: string; read: boolean }[]>([]);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(false);
  const inboxUnread = inbox.filter((i) => !i.read).length;
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    waitForSession().then((session) => {
      if (!session) { window.location.href = '/auth'; return; }
      const id = session.user.id;
      setUserId(id);
      setSessionId(`s_${Date.now()}`);
      loadSessions(id);
      loadInbox(id);
    });
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  // Keep the latest message visible when the keyboard opens.
  useEffect(() => {
    const onFocus = () => setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 350);
    document.addEventListener('focusin', onFocus);
    return () => document.removeEventListener('focusin', onFocus);
  }, []);

  async function loadSessions(id: string) {
    try {
      const res = await fetch('/api/coach-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id }),
      });
      const data = await res.json();
      setSessions((data.sessions as Session[]) || []);
    } catch { /* ignore */ }
  }

  async function loadSession(sid: string) {
    try {
      const res = await fetch('/api/coach-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sessionId: sid }),
      });
      const data = await res.json();
      setMessages((data.messages || []).map((r: { role: string; content: string }) => ({ role: r.role as 'user' | 'assistant', content: r.content })));
    } catch { /* ignore */ }
    setSessionId(sid);
    setSidebar(false);
  }

  function newChat() {
    setMessages([]);
    setSessionId(`s_${Date.now()}`);
    setSidebar(false);
  }

  async function loadInbox(id: string) {
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id, action: 'list' }),
      });
      const data = await res.json();
      setInbox(data.items || []);
    } catch { /* ignore */ }
  }

  async function openInbox() {
    setInboxOpen(true);
    // Mark read so the dot clears.
    if (inboxUnread > 0) {
      setInbox((cur) => cur.map((i) => ({ ...i, read: true })));
      fetch('/api/inbox', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'read' }),
      }).catch(() => {});
    }
  }

  async function generateInsights() {
    if (!userId || inboxLoading) return;
    setInboxLoading(true);
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'generate' }),
      });
      const data = await res.json();
      setInbox((data.items || []).map((i: { read: boolean }) => ({ ...i, read: true })));
      fetch('/api/inbox', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'read' }),
      }).catch(() => {});
    } catch { /* ignore */ }
    setInboxLoading(false);
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput('');
    setShowCmds(false);
    const userMsg: ChatMessage = { role: 'user', content };
    const next = [...messages, userMsg];
    setMessages(next);
    setSending(true);

    const title = messages.length === 0 ? content.slice(0, 40) : undefined;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, messages: next, sessionId, sessionTitle: title }),
      });
      const data = await res.json();
      const updated = [...next, { role: 'assistant' as const, content: data.reply || '…' }];
      setMessages(updated);

      // Background memory distillation — decoupled from the reply, fire-and-forget.
      // Runs every 6 user turns so it doesn't fire on every message.
      const userTurns = updated.filter((m) => m.role === 'user').length;
      if (userTurns > 0 && userTurns % 6 === 0) {
        fetch('/api/memory/distill', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, messages: updated }),
        }).catch(() => {});
      }
      if (messages.length === 0) loadSessions(userId);
    } catch {
      setMessages([...next, { role: 'assistant', content: 'I hit a snag — try again in a moment.' }]);
    }
    setSending(false);
  }

  function onInputChange(v: string) {
    setInput(v);
    setShowCmds(v.startsWith('@'));
  }

  return (
    <div style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)', top: 0,
      width: '100%', maxWidth: 430,
      height: 'calc(100svh - var(--kb, 0px))',
      transition: 'height 0.2s ease-out',
      display: 'flex', flexDirection: 'column',
      background: C.bg,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'max(18px, env(safe-area-inset-top)) 18px 14px', borderBottom: `1px solid ${C.border}` }}>
        <button onClick={() => setSidebar(true)} style={{ fontSize: 22, color: C.dark }}>☰</button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Logo size={26} />
          <span className="serif" style={{ fontSize: 19, fontWeight: 600 }}>Coach</span>
        </div>
        <button onClick={openInbox} aria-label="Inbox" style={{ position: 'relative', width: 38, height: 38, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.dark }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-6l-2 3h-4l-2-3H2" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          </svg>
          {inboxUnread > 0 && (
            <span style={{ position: 'absolute', top: 5, right: 5, minWidth: 8, height: 8, borderRadius: 4, background: C.orange }} />
          )}
        </button>
      </div>

      {/* Messages */}
      <div className="scrollarea no-scrollbar" style={{ flex: 1, padding: 16 }}>
        {messages.length === 0 ? (
          <div style={{ paddingTop: 30 }}>
            <div style={{ textAlign: 'center', color: C.muted, fontSize: 15, marginBottom: 22 }}>
              I&apos;m your accountability coach. What&apos;s on your mind?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} style={{ textAlign: 'left', padding: '14px 16px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, fontSize: 14, color: C.dark }}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '82%', padding: '11px 15px', borderRadius: 18, fontSize: 14.5, lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  background: m.role === 'user' ? C.orange : '#fff',
                  color: m.role === 'user' ? '#fff' : C.dark,
                  border: m.role === 'user' ? 'none' : `1px solid ${C.border}`,
                  borderBottomRightRadius: m.role === 'user' ? 5 : 18,
                  borderBottomLeftRadius: m.role === 'user' ? 18 : 5,
                }}>{m.content}</div>
              </div>
            ))}
            {sending && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '13px 17px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, borderBottomLeftRadius: 5, display: 'flex', gap: 5 }}>
                  {[0, 1, 2].map((d) => (<span key={d} className="dot" style={{ width: 7, height: 7, borderRadius: '50%', background: C.faint }} />))}
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Command palette */}
      {showCmds && (
        <div style={{ padding: '0 14px 8px' }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
            {COMMANDS.map((c) => (
              <button key={c.cmd} onClick={() => c.active && setInput(c.cmd + ' ')}
                style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: c.active ? 1 : 0.45, borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 14 }}><b style={{ color: C.orange }}>{c.cmd}</b> <span style={{ color: C.muted }}>{c.desc}</span></span>
                {!c.active && <span style={{ fontSize: 11, color: C.faint }}>soon</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input — sits at the bottom of the column. The column shrinks by --kb
          when the keyboard opens, so this lands just above the keyboard. The
          marginBottom clears the fixed bottom nav when the keyboard is closed. */}
      <div style={{
        padding: '10px 14px 10px',
        marginBottom: 'max(0px, calc(84px + env(safe-area-inset-bottom) - var(--kb, 0px)))',
        borderTop: `1px solid ${C.border}`, background: C.bg,
        display: 'flex', gap: 9, alignItems: 'flex-end',
        flexShrink: 0,
      }}>
        <textarea value={input} onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1} placeholder="Message your coach…"
          style={{ flex: 1, padding: '12px 14px', borderRadius: 16, border: `1px solid ${C.border}`, background: C.card, fontSize: 16, outline: 'none', maxHeight: 110 }} />
        <button onClick={() => send()} disabled={!input.trim() || sending}
          style={{ width: 44, height: 44, borderRadius: '50%', background: input.trim() ? C.orange : C.faint, color: C.onAccent, fontSize: 19, flexShrink: 0 }}>↑</button>
      </div>

      {/* Sidebar */}
      {sidebar && (
        <div onClick={() => setSidebar(false)} className="fadein" style={{ position: 'absolute', inset: 0, zIndex: 80, background: 'rgba(26,24,21,0.4)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 280, height: '100%', background: C.bg, padding: 'max(20px, env(safe-area-inset-top)) 18px 20px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, marginBottom: 16 }}>History</div>
            <button onClick={newChat} style={{ background: C.orange, color: C.onAccent, borderRadius: 12, padding: '11px', fontWeight: 600, marginBottom: 14 }}>+ New conversation</button>
            <div className="scrollarea no-scrollbar" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sessions.length === 0 && <div style={{ color: C.faint, fontSize: 13.5 }}>No past conversations.</div>}
              {sessions.map((s) => (
                <button key={s.session_id} onClick={() => loadSession(s.session_id)}
                  style={{ textAlign: 'left', padding: '11px 13px', borderRadius: 11, background: s.session_id === sessionId ? C.orangeSoft : '#fff', border: `1px solid ${C.border}`, fontSize: 13.5, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.session_title || 'Conversation'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Inbox — AI observations & suggestions */}
      {inboxOpen && (
        <BottomSheet onClose={() => setInboxOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 className="serif" style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>From your coach</h2>
              <button onClick={generateInsights} disabled={inboxLoading}
                style={{ fontSize: 13, fontWeight: 600, color: C.onAccent, background: C.orange, borderRadius: 10, padding: '8px 13px', whiteSpace: 'nowrap' }}>
                {inboxLoading ? 'Thinking…' : '✦ Refresh'}
              </button>
            </div>

            {inbox.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: C.muted }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: C.dark }}>No messages yet</div>
                <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>Tap Refresh and your coach will look at your goals and recent activity, then share what it notices.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {inbox.map((item) => {
                  const tag = item.kind === 'suggestion' ? { label: 'Suggestion', color: '#3D4D8A', soft: '#E8EBF8' }
                    : item.kind === 'nudge' ? { label: 'Nudge', color: C.orange, soft: C.orangeSoft }
                    : { label: 'Observation', color: '#1B7A5C', soft: '#D9F0E5' };
                  return (
                    <div key={item.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 15, padding: '14px 15px' }}>
                      <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: tag.color, background: tag.soft, padding: '3px 9px', borderRadius: 7, marginBottom: 8 }}>{tag.label}</span>
                      <div style={{ fontSize: 14.5, lineHeight: 1.5, color: C.dark }}>{item.text}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
