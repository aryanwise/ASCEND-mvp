'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { detectPlatform, isInstalled, registerSW, subscribePush } from '@/lib/utils';
import type { AreaId, Archetype } from '@/types';

type Step = 'install'|'profile'|'archetype'|'goal_area'|'goal_questions'|'motivation';

const ARCHETYPES = [
  { id:'rigid_9to5',   emoji:'🗓️', label:'The 9-to-5',      desc:'Structured work, free evenings'         },
  { id:'nocturnal_dev',emoji:'🌙', label:'The Night Owl',    desc:'Late nights, fluid hours, chaotic mornings' },
  { id:'deep_worker',  emoji:'🎯', label:'The Deep Worker',  desc:'Large unstructured focus blocks'         },
  { id:'student',      emoji:'📖', label:'The Student',      desc:'Mixed schedule, deadlines drive everything' },
] as const;

const AREAS = [
  { id:'fitness', emoji:'💪', label:'Fitness' },{ id:'study', emoji:'📚', label:'Study' },
  { id:'career',  emoji:'💼', label:'Career'  },{ id:'diet',  emoji:'🥗', label:'Diet'  },
  { id:'mind',    emoji:'🧠', label:'Mind'    },{ id:'money', emoji:'💰', label:'Money' },
  { id:'health',  emoji:'❤️', label:'Health'  },{ id:'habits',emoji:'✨', label:'Habits'},
  { id:'custom',  emoji:'🎯', label:'Custom'  },
] as const;

export default function Onboard() {
  const { user } = useAuth();
  const router   = useRouter();
  const [step, setStep]             = useState<Step>(isInstalled() ? 'profile' : 'install');
  const [platform]                  = useState(detectPlatform);
  const [firstName, setFirstName]   = useState('');
  const [lastName, setLastName]     = useState('');
  const [age, setAge]               = useState('');
  const [archetype, setArchetype]   = useState<Archetype|null>(null);
  const [goalArea, setGoalArea]     = useState<AreaId|null>(null);
  const [goalText, setGoalText]     = useState('');
  const [questions, setQuestions]   = useState<string[]>([]);
  const [qIdx, setQIdx]             = useState(0);
  const [dialogue, setDialogue]     = useState<{role:'user'|'assistant';content:string}[]>([]);
  const [answer, setAnswer]         = useState('');
  const [motivation, setMotivation] = useState('');
  const [loadingQ, setLoadingQ]     = useState(false);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    if (step === 'goal_questions' && questions.length === 0) {
      setLoadingQ(true);
      fetch('/api/goal-questions', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ area: goalArea, goalText }),
      }).then(r => r.json()).then(d => { setQuestions(d.questions ?? []); setLoadingQ(false); });
    }
  }, [step]);

  const submitAnswer = () => {
    if (!answer.trim()) return;
    const updated = [
      ...dialogue,
      { role:'assistant' as const, content: questions[qIdx] },
      { role:'user'      as const, content: answer.trim()   },
    ];
    setDialogue(updated); setAnswer('');
    if (qIdx < questions.length - 1) setQIdx(i => i + 1);
    else setStep('motivation');
  };

  const finish = async () => {
    if (!user) return;
    setSaving(true);

    // Create profile + goal via API
    await fetch('/api/profile', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ userId: user.id, firstName, lastName, age: age ? parseInt(age) : null, archetype }),
    });

    await fetch('/api/goals/create', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ userId: user.id, area: goalArea, goalText, dialogue, motivation, archetype }),
    });

    // Push notifications (non-blocking)
    registerSW().then(async reg => {
      if (!reg) return;
      if (Notification.permission === 'default') await Notification.requestPermission();
      if (Notification.permission === 'granted') subscribePush(reg, user.id);
    });

    router.replace('/app');
  };

  const steps: Step[] = ['install','profile','archetype','goal_area','goal_questions','motivation'];
  const stepNum = steps.indexOf(step) + 1;

  return (
    <div className="shell" style={{ padding:'0 20px' }}>
      <div className="scroll pt-safe fade-up" style={{ paddingBottom:40 }}>

        {step !== 'install' && (
          <Progress current={stepNum - 1} total={steps.length - 1} />
        )}

        {/* ── INSTALL ─────────────────────────────────── */}
        {step === 'install' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'80dvh', textAlign:'center', gap:0 }}>
            <div style={{ width:64, height:64, borderRadius:16, background:'#D9531E', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
              <svg width="36" height="36" viewBox="0 0 38 38" fill="none">
                <path d="M10 28L19 10L28 28" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14.5 22H23.5" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <h1 style={{ fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:'#1A1815', marginBottom:10, letterSpacing:'-0.5px' }}>Add to home screen</h1>
            <p style={{ fontSize:14, color:'#6B6359', lineHeight:1.6, marginBottom:28, maxWidth:280 }}>
              For the full experience — no browser bars, push notifications, and feels like a native app.
            </p>
            {platform === 'ios' && (
              <div className="card" style={{ width:'100%', marginBottom:24, textAlign:'left' }}>
                <div className="slabel" style={{ color:'#D9531E' }}>On iPhone</div>
                {[['1','Tap','Share ⬆️ in Safari'],['2','Scroll and tap','"Add to Home Screen"'],['3','Tap','"Add"']].map(([n,a,b])=>(
                  <div key={n} style={{ display:'flex', gap:10, marginBottom:10, alignItems:'flex-start' }}>
                    <div style={{ width:22,height:22,borderRadius:6,background:'#D9531E',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                      <span style={{ fontSize:11,fontWeight:700,color:'#fff' }}>{n}</span>
                    </div>
                    <span style={{ fontSize:13,color:'#1A1815',lineHeight:1.5 }}>{a} <strong>{b}</strong></span>
                  </div>
                ))}
              </div>
            )}
            {platform === 'android' && (
              <div className="card" style={{ width:'100%', marginBottom:24, textAlign:'left' }}>
                <div className="slabel" style={{ color:'#D9531E' }}>On Android</div>
                {[['1','Tap menu ⋮','in Chrome'],['2','Tap','"Add to Home screen"'],['3','Tap','"Add"']].map(([n,a,b])=>(
                  <div key={n} style={{ display:'flex', gap:10, marginBottom:10, alignItems:'flex-start' }}>
                    <div style={{ width:22,height:22,borderRadius:6,background:'#D9531E',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                      <span style={{ fontSize:11,fontWeight:700,color:'#fff' }}>{n}</span>
                    </div>
                    <span style={{ fontSize:13,color:'#1A1815',lineHeight:1.5 }}>{a} <strong>{b}</strong></span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setStep('profile')} className="btn-primary">
              {isInstalled() ? 'Continue' : 'Skip for now'} <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── PROFILE ─────────────────────────────────── */}
        {step === 'profile' && (
          <div style={{ paddingTop:20 }}>
            <H2>What should we call you?</H2>
            <Sub>No password needed — you're already signed in.</Sub>
            <Row>
              <div style={{ flex:1 }}>
                <Label>First name</Label>
                <Input value={firstName} onChange={setFirstName} placeholder="Alex" />
              </div>
              <div style={{ flex:1 }}>
                <Label>Last name</Label>
                <Input value={lastName} onChange={setLastName} placeholder="Chen" />
              </div>
            </Row>
            <Label>Age <Opt /></Label>
            <Input value={age} onChange={setAge} placeholder="25" type="number" />
            <Spacer />
            <button onClick={() => setStep('archetype')} disabled={!firstName.trim()} className="btn-primary">
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── ARCHETYPE ───────────────────────────────── */}
        {step === 'archetype' && (
          <div style={{ paddingTop:20 }}>
            <H2>Which lifestyle fits you best?</H2>
            <Sub>Ascend assumes a baseline schedule. You can change it later.</Sub>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
              {ARCHETYPES.map(a => (
                <button key={a.id} onClick={() => setArchetype(a.id as Archetype)} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderRadius:16, border:`1.5px solid ${archetype===a.id?'#D9531E':'rgba(26,24,21,0.08)'}`, background:archetype===a.id?'#FFE9DD':'#fff', cursor:'pointer', textAlign:'left' }}>
                  <span style={{ fontSize:26 }}>{a.emoji}</span>
                  <div>
                    <div style={{ fontSize:15,fontWeight:700,color:archetype===a.id?'#D9531E':'#1A1815' }}>{a.label}</div>
                    <div style={{ fontSize:12,color:'#6B6359',marginTop:2 }}>{a.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <BtnRow onBack={() => setStep('profile')}>
              <button onClick={() => setStep('goal_area')} disabled={!archetype} className="btn-primary" style={{ flex:1 }}>
                Continue <ChevronRight size={16} />
              </button>
            </BtnRow>
          </div>
        )}

        {/* ── GOAL AREA ───────────────────────────────── */}
        {step === 'goal_area' && (
          <div style={{ paddingTop:20 }}>
            <H2>What's the one thing you want to work on?</H2>
            <Sub>Start with one goal. You can add more later.</Sub>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
              {AREAS.map(a => (
                <button key={a.id} onClick={() => setGoalArea(a.id as AreaId)} style={{ display:'flex', alignItems:'center', gap:10, padding:'14px', borderRadius:14, border:`1.5px solid ${goalArea===a.id?'#D9531E':'rgba(26,24,21,0.08)'}`, background:goalArea===a.id?'#FFE9DD':'#fff', cursor:'pointer' }}>
                  <span style={{ fontSize:20 }}>{a.emoji}</span>
                  <span style={{ fontSize:14,fontWeight:600,color:goalArea===a.id?'#D9531E':'#1A1815' }}>{a.label}</span>
                </button>
              ))}
            </div>
            {goalArea && (
              <>
                <Label>Describe what you want to achieve</Label>
                <textarea value={goalText} onChange={e => setGoalText(e.target.value)} rows={3} placeholder="Be specific and honest about your constraints..."
                  style={{ width:'100%', padding:'12px', borderRadius:12, border:'1px solid rgba(26,24,21,0.1)', background:'#fff', fontSize:14, color:'#1A1815', outline:'none', resize:'none', marginBottom:16, lineHeight:1.5 }} />
              </>
            )}
            <BtnRow onBack={() => setStep('archetype')}>
              <button onClick={() => setStep('goal_questions')} disabled={!goalArea || !goalText.trim()} className="btn-primary" style={{ flex:1 }}>
                Continue <ChevronRight size={16} />
              </button>
            </BtnRow>
          </div>
        )}

        {/* ── AI QUESTIONS ────────────────────────────── */}
        {step === 'goal_questions' && (
          <div style={{ paddingTop:20 }}>
            <H2>A few questions to build your plan.</H2>
            <Sub>Honest answers = a plan that fits your life. If you're unsure, just say "idk" and I'll rephrase.</Sub>

            {loadingQ ? (
              <div style={{ display:'flex', gap:10, alignItems:'center', color:'#6B6359', marginTop:20 }}>
                <Loader2 size={16} style={{ animation:'spin 1s linear infinite' }} color="#D9531E" />
                <span style={{ fontSize:13 }}>Preparing your questions...</span>
              </div>
            ) : (
              <>
                {/* Previous answers */}
                {dialogue.map((m,i) => (
                  <div key={i} style={{ marginBottom:10 }}>
                    <div style={{ padding:'10px 14px', borderRadius:12, background:m.role==='assistant'?'#FFE9DD':'#1A1815', color:m.role==='assistant'?'#B33E0E':'#fff', fontSize:13, lineHeight:1.55, maxWidth:'90%', marginLeft:m.role==='user'?'auto':'0' }}>
                      {m.content}
                    </div>
                  </div>
                ))}

                {/* Current question */}
                {questions[qIdx] && (
                  <div className="fade-up">
                    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10, marginTop:8 }}>
                      <Sparkles size={13} color="#D9531E" />
                      <span style={{ fontSize:11, color:'#D9531E', fontWeight:700 }}>Question {qIdx+1} of {questions.length}</span>
                    </div>
                    <div style={{ fontSize:16, fontWeight:600, color:'#1A1815', lineHeight:1.55, marginBottom:14 }}>
                      {questions[qIdx]}
                    </div>
                    <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={3} placeholder='Be honest — or just say "idk" if you\'re not sure'
                      style={{ width:'100%', padding:'12px', borderRadius:12, border:'1px solid rgba(26,24,21,0.1)', background:'#fff', fontSize:14, color:'#1A1815', outline:'none', resize:'none', marginBottom:12, lineHeight:1.5 }} />
                    <button onClick={submitAnswer} disabled={!answer.trim()} className="btn-primary">
                      {qIdx < questions.length-1 ? 'Next question' : 'Last one →'} <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── MOTIVATION ──────────────────────────────── */}
        {step === 'motivation' && (
          <div style={{ paddingTop:20 }}>
            <H2>Why does this matter to you?</H2>
            <Sub>This becomes your reminder when things get hard. Ascend will show it when you're about to quit.</Sub>
            <textarea value={motivation} onChange={e => setMotivation(e.target.value)} rows={5} placeholder='"I want to feel strong and be there for the people I love."'
              style={{ width:'100%', padding:'14px', borderRadius:14, border:'1.5px solid rgba(26,24,21,0.1)', background:'#fff', fontSize:14, color:'#1A1815', outline:'none', resize:'none', marginBottom:20, lineHeight:1.6, marginTop:8 }} />
            <button onClick={finish} disabled={saving} className="btn-primary">
              {saving ? <><Loader2 size={15} style={{ animation:'spin 1s linear infinite' }} /> Building your plan...</> : <><Sparkles size={15} /> Build my plan</>}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Mini components ──────────────────────────────────────────
function Progress({ current, total }: { current:number; total:number }) {
  return (
    <div style={{ display:'flex', gap:4, paddingTop:16, marginBottom:24 }}>
      {Array.from({ length:total }).map((_,i) => (
        <div key={i} style={{ height:3, flex:1, borderRadius:2, background:i<current?'#D9531E':'rgba(26,24,21,0.12)', transition:'background 0.3s' }} />
      ))}
    </div>
  );
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1815', letterSpacing:'-0.3px', lineHeight:1.25, marginBottom:8, marginTop:0 }}>{children}</h2>;
}
function Sub({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize:14, color:'#6B6359', lineHeight:1.6, marginBottom:20, marginTop:0 }}>{children}</p>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:12, fontWeight:600, color:'#6B6359', marginBottom:6, marginTop:14 }}>{children}</div>;
}
function Opt() { return <span style={{ color:'#A8A095', fontWeight:400 }}> (optional)</span>; }
function Input({ value, onChange, placeholder, type='text' }: { value:string; onChange:(v:string)=>void; placeholder?:string; type?:string }) {
  return <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} type={type}
    style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1px solid rgba(26,24,21,0.1)', background:'#fff', fontSize:14, color:'#1A1815', outline:'none' }} />;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display:'flex', gap:10 }}>{children}</div>;
}
function Spacer() { return <div style={{ flex:1, minHeight:24 }} />; }
function BtnRow({ children, onBack }: { children: React.ReactNode; onBack:()=>void }) {
  return (
    <div style={{ display:'flex', gap:10 }}>
      <button onClick={onBack} className="btn-secondary" style={{ width:52, flexShrink:0, borderRadius:14, padding:0 }}>
        <ChevronLeft size={18} />
      </button>
      {children}
    </div>
  );
}
