'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, X, CheckCircle2, Circle, Sparkles, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { area } from '@/lib/areas';
import { getQuote } from '@/lib/utils';
import type { Goal, Task, Priority, DayPlan, DayBlock } from '@/types';

const ENERGY = [
  { id:'low',    label:'🪫 Low',    ctx:'low energy, tired'         },
  { id:'medium', label:'🔋 Medium', ctx:'medium energy'             },
  { id:'high',   label:'⚡ High',   ctx:'high energy, fully focused' },
];
const HOURS = [{ id:'3',label:'< 4h' },{ id:'5',label:'4–6h' },{ id:'7',label:'6–8h' },{ id:'10',label:'Full day' }];
const MOOD  = [
  { id:'easy',   label:'😴 Easy wins',  ctx:'need easy wins, tired'   },
  { id:'focus',  label:'🎯 Deep focus', ctx:'want deep focus blocks'  },
  { id:'rushed', label:'⚡ Rushed',     ctx:'short on time'           },
  { id:'light',  label:'🌿 Light day',  ctx:'light tasks only'        },
];

export default function Home() {
  const { user } = useAuth();
  const [profile, setProfile]       = useState<{ first_name: string }|null>(null);
  const [goals, setGoals]           = useState<(Goal & { tasks: Task[] })[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [dayPlan, setDayPlan]       = useState<DayPlan|null>(null);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [formOpen, setFormOpen]     = useState(false);
  const [newPri, setNewPri]         = useState('');
  const [quoteIdx, setQuoteIdx]     = useState(0);
  const [selE, setSelE]             = useState<string|null>(null);
  const [selH, setSelH]             = useState<string|null>(null);
  const [selM, setSelM]             = useState<string|null>(null);
  const today = new Date().toISOString().split('T')[0];
  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [p, g, pr, dp] = await Promise.all([
      supabase.from('profiles').select('first_name').eq('id', user.id).single(),
      supabase.from('goals').select('*, tasks(*)').eq('user_id', user.id).eq('status', 'active'),
      supabase.from('priorities').select('*').eq('user_id', user.id).eq('date', today),
      supabase.from('day_plans').select('*').eq('user_id', user.id).eq('date', today).single(),
    ]);
    if (p.data) setProfile(p.data);
    if (g.data) setGoals(g.data as (Goal & { tasks: Task[] })[]);
    if (pr.data) setPriorities(pr.data);
    if (dp.data) setDayPlan({ advice: dp.data.advice, blocks: dp.data.blocks ?? [], deferred: dp.data.deferred ?? [] });
    setLoading(false);
  }, [user, today]);

  useEffect(() => { load(); }, [load]);

  const addPri = async () => {
    if (!newPri.trim() || !user) return;
    const { data } = await supabase.from('priorities').insert({ user_id: user.id, date: today, text: newPri.trim(), done: false }).select().single();
    if (data) setPriorities(p => [...p, data]);
    setNewPri('');
  };
  const togglePri = async (id: string, done: boolean) => {
    await supabase.from('priorities').update({ done: !done }).eq('id', id);
    setPriorities(p => p.map(x => x.id===id ? { ...x, done:!done } : x));
  };
  const delPri = async (id: string) => {
    await supabase.from('priorities').delete().eq('id', id);
    setPriorities(p => p.filter(x => x.id !== id));
  };

  const generate = async () => {
    if (!user) return;
    setGenerating(true); setFormOpen(false);
    const ctx = [
      ENERGY.find(e => e.id===selE)?.ctx ?? 'medium energy',
      MOOD.find(m => m.id===selM)?.ctx ?? '',
    ].filter(Boolean).join(', ');
    const res = await fetch('/api/day-plan', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ userId: user.id, goals: goals.map(g => ({ title:g.title, area:g.area, tasks:g.tasks.map(t=>t.name) })), context:ctx, hours:parseInt(selH??'8') }),
    });
    const plan = await res.json();
    setDayPlan(plan);
    setGenerating(false);
  };

  const toggleBlock = async (idx: number) => {
    if (!dayPlan || !user) return;
    const updated = dayPlan.blocks.map((b,i) => i===idx ? { ...b, done:!b.done } : b);
    setDayPlan({ ...dayPlan, blocks: updated });
    await supabase.from('day_plans').update({ blocks: updated }).eq('user_id', user.id).eq('date', today);
  };

  if (loading) return <Spinner />;

  const done = dayPlan?.blocks.filter(b=>b.done).length ?? 0;
  const total = dayPlan?.blocks.length ?? 0;

  return (
    <div style={{ padding:'0 16px' }}>

      {/* ── Header ─────────────────────────────── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:20, paddingTop:8 }}>
        <div>
          <div style={{ fontSize:13, color:'#6B6359' }}>{greet}{profile?.first_name ? `, ${profile.first_name}` : ''}</div>
          <button onClick={() => setQuoteIdx(i=>(i+1)%12)} style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', cursor:'pointer', padding:0 }}>
            <Logo size={28} />
            <span style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#1A1815', letterSpacing:'-0.3px' }}>ASCEND</span>
          </button>
          <div style={{ fontSize:12, color:'#A8A095', marginTop:3, fontStyle:'italic' }}>{getQuote(quoteIdx)}</div>
        </div>
        {total > 0 && (
          <div style={{ textAlign:'right' }}>
            <div style={{ fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1815', lineHeight:1 }}>{done}/{total}</div>
            <div style={{ fontSize:10, color:'#A8A095', marginTop:3 }}>done today</div>
          </div>
        )}
      </div>

      {/* ── Priorities ─────────────────────────── */}
      <div className="slabel">Today's Priorities</div>
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ display:'flex', gap:8, marginBottom:priorities.length>0?10:0 }}>
          <input value={newPri} onChange={e=>setNewPri(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addPri()} placeholder="What MUST happen today?"
            style={{ flex:1, padding:'9px 12px', borderRadius:10, border:'none', background:'#F8F5EF', fontSize:14, color:'#1A1815', outline:'none' }} />
          <button onClick={addPri} disabled={!newPri.trim()} style={{ width:36,height:36,borderRadius:10,background:'#D9531E',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:newPri.trim()?1:0.4,flexShrink:0 }}>
            <Plus size={16} color="#fff" />
          </button>
        </div>
        {priorities.length===0 && <div style={{ fontSize:12,color:'#A8A095',fontStyle:'italic',textAlign:'center',padding:'4px 0' }}>Pin 1–3 must-dos. The rest is bonus.</div>}
        {priorities.map((p,i) => (
          <div key={p.id} style={{ display:'flex',alignItems:'center',gap:9,paddingTop:10,borderTop:i>0?'1px solid rgba(26,24,21,0.06)':'none' }}>
            <button onClick={()=>togglePri(p.id,p.done)} style={{ background:'none',border:'none',cursor:'pointer',padding:0,flexShrink:0 }}>
              {p.done ? <CheckCircle2 size={20} color="#D9531E" fill="#FFE9DD" /> : <Circle size={20} color="#A8A095" />}
            </button>
            <div style={{ width:20,height:20,borderRadius:6,background:i===0?'#D9531E':i===1?'#B8721C':'#A8A095',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
              <span style={{ fontSize:9,fontWeight:700,color:'#fff' }}>P{i+1}</span>
            </div>
            <span style={{ flex:1,fontSize:14,color:p.done?'#A8A095':'#1A1815',textDecoration:p.done?'line-through':'none' }}>{p.text}</span>
            <button onClick={()=>delPri(p.id)} style={{ background:'none',border:'none',cursor:'pointer',opacity:0.3,padding:2,flexShrink:0 }}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* ── Day Plan ────────────────────────────── */}
      <div className="slabel">AI Day Plan</div>

      {/* Generate card */}
      <div className="card" style={{ marginBottom:12, overflow:'hidden' }}>
        <button onClick={()=>setFormOpen(f=>!f)} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',background:'none',border:'none',cursor:'pointer',padding:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <div style={{ width:36,height:36,borderRadius:10,background:'#FFE9DD',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
              <Sparkles size={16} color="#D9531E" />
            </div>
            <div style={{ textAlign:'left' }}>
              <div style={{ fontSize:14,fontWeight:700,color:'#1A1815' }}>{dayPlan?'Regenerate':'Generate Day Plan'}</div>
              <div style={{ fontSize:11,color:'#6B6359',marginTop:1 }}>Questions optional · tap to generate</div>
            </div>
          </div>
          {formOpen ? <ChevronUp size={16} color="#A8A095" /> : <ChevronDown size={16} color="#A8A095" />}
        </button>

        {formOpen && (
          <div style={{ borderTop:'1px solid rgba(26,24,21,0.06)',paddingTop:14,marginTop:12 }}>
            <QLabel>Energy?</QLabel>
            <div style={{ display:'flex',gap:6,marginBottom:12 }}>
              {ENERGY.map(e => <Chip key={e.id} label={e.label} active={selE===e.id} onClick={()=>setSelE(e.id)} />)}
            </div>
            <QLabel>Hours available?</QLabel>
            <div style={{ display:'flex',gap:6,marginBottom:12 }}>
              {HOURS.map(h => <Chip key={h.id} label={h.label} active={selH===h.id} onClick={()=>setSelH(h.id)} />)}
            </div>
            <QLabel>Anything specific?</QLabel>
            <div style={{ display:'flex',gap:6,flexWrap:'wrap',marginBottom:14 }}>
              {MOOD.map(m => <Chip key={m.id} label={m.label} active={selM===m.id} onClick={()=>setSelM(m.id)} />)}
            </div>
            <button onClick={generate} disabled={generating} className="btn-primary">
              {generating ? <><Loader2 size={15} style={{ animation:'spin 1s linear infinite' }} /> Building...</> : <><Sparkles size={15} /> Generate Day Plan</>}
            </button>
          </div>
        )}
      </div>

      {generating && <div style={{ display:'flex',alignItems:'center',gap:10,padding:'16px 0',color:'#6B6359' }}><Loader2 size={16} color="#D9531E" style={{ animation:'spin 1s linear infinite' }} /><span style={{ fontSize:13 }}>Building your day around your goals...</span></div>}

      {!generating && dayPlan && (
        <>
          <div style={{ background:'#FFE9DD',borderRadius:12,padding:'10px 14px',marginBottom:10,display:'flex',gap:8,alignItems:'flex-start' }}>
            <Sparkles size={13} color="#D9531E" style={{ marginTop:1,flexShrink:0 }} />
            <span style={{ fontSize:12,color:'#B33E0E',lineHeight:1.5 }}>{dayPlan.advice}</span>
          </div>
          {dayPlan.blocks.map((b,i) => <Block key={i} block={b} onToggle={()=>toggleBlock(i)} />)}
          {dayPlan.deferred.length>0 && (
            <>
              <div className="slabel" style={{ marginTop:10 }}>Deferred — honest</div>
              {dayPlan.deferred.map((d,i) => (
                <div key={i} style={{ background:'#F8F5EF',borderRadius:12,padding:'10px 14px',marginBottom:6,border:'1px solid rgba(26,24,21,0.06)' }}>
                  <div style={{ fontSize:13,fontWeight:600,color:'#6B6359',textDecoration:'line-through' }}>{d.task}</div>
                  <div style={{ fontSize:11,color:'#A8A095',marginTop:3 }}>{d.reason}</div>
                </div>
              ))}
            </>
          )}
          <button onClick={()=>setFormOpen(true)} style={{ display:'flex',alignItems:'center',gap:5,margin:'8px 0 24px',padding:'7px 12px',borderRadius:10,border:'1px solid rgba(26,24,21,0.1)',background:'#fff',cursor:'pointer',fontSize:12,fontWeight:600,color:'#6B6359' }}>
            <RefreshCw size={12} /> Regenerate
          </button>
        </>
      )}

      {!generating && !dayPlan && (
        <div style={{ background:'#fff',borderRadius:14,padding:'24px',border:'1px dashed rgba(217,83,30,0.3)',textAlign:'center',marginBottom:24 }}>
          <div style={{ fontSize:13,color:'#6B6359',marginBottom:12 }}>No plan yet — tap "Generate Day Plan" above.</div>
          <button onClick={()=>{ setFormOpen(false); generate(); }} style={{ display:'inline-flex',alignItems:'center',gap:6,background:'#D9531E',color:'#fff',border:'none',borderRadius:12,padding:'10px 20px',fontSize:13,fontWeight:700,cursor:'pointer' }}>
            <Sparkles size={13} /> Quick generate
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────
function Block({ block, onToggle }: { block: DayBlock; onToggle: ()=>void }) {
  const a = area(block.area);
  return (
    <button onClick={onToggle} style={{ display:'flex',alignItems:'center',gap:10,width:'100%',background:block.done?'#F8F5EF':'#fff',border:'1px solid rgba(26,24,21,0.08)',borderRadius:14,padding:'12px',marginBottom:8,cursor:'pointer',textAlign:'left' }}>
      <div style={{ textAlign:'right',width:40,flexShrink:0 }}>
        <span style={{ fontSize:11,fontWeight:700,color:'#A8A095' }}>{block.time}</span>
      </div>
      <div style={{ width:3,alignSelf:'stretch',borderRadius:2,background:a.color,flexShrink:0 }} />
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontSize:14,fontWeight:600,color:block.done?'#A8A095':'#1A1815',textDecoration:block.done?'line-through':'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{block.task}</div>
        <div style={{ fontSize:11,color:'#A8A095',marginTop:3 }}>
          <span style={{ background:a.soft,color:a.color,padding:'1px 6px',borderRadius:4,fontWeight:700,marginRight:5,fontSize:10 }}>{a.label}</span>
          {block.duration}
        </div>
      </div>
      {block.done ? <CheckCircle2 size={18} color={a.color} fill={a.soft} style={{ flexShrink:0 }} /> : <Circle size={18} color="#A8A095" style={{ flexShrink:0 }} />}
    </button>
  );
}
function Chip({ label, active, onClick }: { label:string; active:boolean; onClick:()=>void }) {
  return (
    <button onClick={onClick} style={{ flex:1,padding:'8px 4px',borderRadius:10,border:`1.5px solid ${active?'#D9531E':'rgba(26,24,21,0.1)'}`,background:active?'#FFE9DD':'#fff',cursor:'pointer',fontSize:12,fontWeight:600,color:active?'#D9531E':'#6B6359',whiteSpace:'nowrap' }}>
      {label}
    </button>
  );
}
function QLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:12,fontWeight:700,color:'#1A1815',marginBottom:8 }}>{children}</div>;
}
function Logo({ size=32 }: { size?: number }) {
  return (
    <div style={{ width:size,height:size,borderRadius:Math.round(size*0.26),background:'#D9531E',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
      <svg width={size*0.7} height={size*0.7} viewBox="0 0 38 38" fill="none">
        <path d="M10 28L19 10L28 28" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14.5 22H23.5" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    </div>
  );
}
function Spinner() {
  return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60dvh' }}><Loader2 size={24} color="#D9531E" style={{ animation:'spin 1s linear infinite' }} /></div>;
}
