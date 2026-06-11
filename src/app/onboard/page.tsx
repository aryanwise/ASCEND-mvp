'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { detectPlatform, isInstalled, registerSW, subscribePush } from '@/lib/utils';
import type { AreaId, Archetype } from '@/types';
import { supabase } from '@/lib/supabase';

type Step = 'install'|'profile'|'archetype'|'goal_area'|'goal_questions'|'motivation';

const ARCHETYPES = [
  { id:'rigid_9to5',   emoji:'🗓️', label:'The 9-to-5',     desc:'Structured work, free evenings'            },
  { id:'nocturnal_dev',emoji:'🌙', label:'The Night Owl',   desc:'Late nights, fluid hours, chaotic mornings' },
  { id:'deep_worker',  emoji:'🎯', label:'The Deep Worker', desc:'Large unstructured focus blocks'            },
  { id:'student',      emoji:'📖', label:'The Student',     desc:'Mixed schedule, deadlines drive everything'  },
] as const;

const AREAS = [
  { id:'fitness',emoji:'💪',label:'Fitness' },{ id:'study',  emoji:'📚',label:'Study'  },
  { id:'career', emoji:'💼',label:'Career'  },{ id:'diet',   emoji:'🥗',label:'Diet'   },
  { id:'mind',   emoji:'🧠',label:'Mind'    },{ id:'money',  emoji:'💰',label:'Money'  },
  { id:'health', emoji:'❤️',label:'Health' },{ id:'habits', emoji:'✨',label:'Habits' },
  { id:'custom', emoji:'🎯',label:'Custom'  },
] as const;

export default function Onboard() {
  const { user }   = useAuth();
  const router     = useRouter();
  const platform   = detectPlatform();
  const installed  = isInstalled();

  const [step, setStep] = useState<Step>('profile');
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [age,       setAge]       = useState('');
  const [archetype, setArchetype] = useState<Archetype|null>(null);
  const [goalArea,  setGoalArea]  = useState<AreaId|null>(null);
  const [goalText,  setGoalText]  = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [qIdx,      setQIdx]      = useState(0);
  const [dialogue,  setDialogue]  = useState<{role:'user'|'assistant';content:string}[]>([]);
  const [answer,    setAnswer]    = useState('');
  const [motivation,setMotivation]= useState('');
  const [loadingQ,  setLoadingQ]  = useState(false);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    if (step === 'goal_questions' && questions.length === 0) {
      setLoadingQ(true);
      fetch('/api/goal-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area: goalArea, goalText }),
      })
        .then(r => r.json())
        .then(d => { setQuestions(d.questions ?? []); setLoadingQ(false); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const submitAnswer = async () => {
  if (!answer.trim()) return;
  const isIdk = /^(idk|i don't know|not sure|unsure|no idea|idk|dunno|maybe|hmm)/i.test(answer.trim());

  if (isIdk) {
    // Rephrase the same question
    const res = await fetch('/api/goal-questions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area: goalArea, goalText, rephrase: true, previousQuestion: questions[qIdx] }),
    });
    const data = await res.json();
    const newQ = data.questions?.[0] ?? questions[qIdx];
    const updated = [...questions];
    updated[qIdx] = newQ;
    setQuestions(updated);
    setAnswer('');
    return;
  }

  setDialogue(d => [...d,
    { role: 'assistant', content: questions[qIdx] },
    { role: 'user', content: answer.trim() },
  ]);
  setAnswer('');
  if (qIdx < questions.length - 1) setQIdx(i => i + 1);
  else setStep('motivation');
};

  const finish = async () => {
  setSaving(true);

  // Get userId directly from session (more reliable than context)
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;

  if (!userId) {
    setSaving(false);
    window.location.href = '/auth';
    return;
  }

  await fetch('/api/profile', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, firstName, lastName, age: age ? parseInt(age) : null, archetype }),
  });

  await fetch('/api/goals/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, area: goalArea, goalText, dialogue, motivation, archetype }),
  });

  window.location.href = '/app';
};

  const stepsList: Step[] = ['profile','archetype','goal_area','goal_questions','motivation'];
  const stepNum = stepsList.indexOf(step);

  return (
    <div className="shell" style={{ padding: '0 20px' }}>
      <div className="scroll pt-safe" style={{ paddingBottom: 40 }}>

        {step !== 'install' && (
          <div style={{ display:'flex', gap:4, paddingTop:16, marginBottom:24 }}>
            {stepsList.slice(1).map((_, i) => (
              <div key={i} style={{ height:3, flex:1, borderRadius:2, background: i < stepNum ? '#D9531E' : 'rgba(26,24,21,0.12)' }} />
            ))}
          </div>
        )}

        {/* INSTALL */}
        {step === 'install' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'80dvh', textAlign:'center' }}>
            <div style={{ width:64, height:64, borderRadius:16, background:'#D9531E', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
              <svg width="36" height="36" viewBox="0 0 38 38" fill="none">
                <path d="M10 28L19 10L28 28" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14.5 22H23.5" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <h1 style={{ fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:'#1A1815', marginBottom:10 }}>Add to home screen</h1>
            <p style={{ fontSize:14, color:'#6B6359', lineHeight:1.6, marginBottom:28, maxWidth:280 }}>
              For push notifications, no browser bars, and a native feel.
            </p>
            {platform === 'ios' && (
              <div className="card" style={{ width:'100%', marginBottom:24, textAlign:'left' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#D9531E', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:10 }}>On iPhone</div>
                {[['1','Tap Share ⬆️','in Safari'],['2','Tap','Add to Home Screen'],['3','Tap','Add']].map(([n,a,b]) => (
                  <div key={n} style={{ display:'flex', gap:10, marginBottom:8, alignItems:'flex-start' }}>
                    <div style={{ width:22, height:22, borderRadius:6, background:'#D9531E', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{n}</span>
                    </div>
                    <span style={{ fontSize:13, color:'#1A1815' }}>{a} <strong>{b}</strong></span>
                  </div>
                ))}
              </div>
            )}
            {platform === 'android' && (
              <div className="card" style={{ width:'100%', marginBottom:24, textAlign:'left' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#D9531E', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:10 }}>On Android</div>
                {[['1','Tap menu ⋮','in Chrome'],['2','Tap','Add to Home screen'],['3','Tap','Add']].map(([n,a,b]) => (
                  <div key={n} style={{ display:'flex', gap:10, marginBottom:8, alignItems:'flex-start' }}>
                    <div style={{ width:22, height:22, borderRadius:6, background:'#D9531E', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{n}</span>
                    </div>
                    <span style={{ fontSize:13, color:'#1A1815' }}>{a} <strong>{b}</strong></span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setStep('profile')} className="btn-primary">
              {installed ? 'Continue' : 'Skip for now'} <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* PROFILE */}
        {step === 'profile' && (
          <div style={{ paddingTop:20 }}>
            <h2 style={{ fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1815', marginBottom:8 }}>What should we call you?</h2>
            <p style={{ fontSize:14, color:'#6B6359', marginBottom:20, lineHeight:1.5 }}>No password needed — you're already signed in.</p>
            <div style={{ display:'flex', gap:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#6B6359', marginBottom:6 }}>First name</div>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Alex"
                  style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1px solid rgba(26,24,21,0.1)', background:'#fff', fontSize:14, color:'#1A1815', outline:'none' }} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#6B6359', marginBottom:6 }}>Last name</div>
                <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Chen"
                  style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1px solid rgba(26,24,21,0.1)', background:'#fff', fontSize:14, color:'#1A1815', outline:'none' }} />
              </div>
            </div>
            <div style={{ fontSize:12, fontWeight:600, color:'#6B6359', marginBottom:6, marginTop:14 }}>Age <span style={{ color:'#A8A095', fontWeight:400 }}>(optional)</span></div>
            <input value={age} onChange={e => setAge(e.target.value)} placeholder="25" type="number"
              style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1px solid rgba(26,24,21,0.1)', background:'#fff', fontSize:14, color:'#1A1815', outline:'none', marginBottom:24 }} />
            <button onClick={() => setStep('archetype')} disabled={!firstName.trim()} className="btn-primary">
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ARCHETYPE */}
        {step === 'archetype' && (
          <div style={{ paddingTop:20 }}>
            <h2 style={{ fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1815', marginBottom:8 }}>Which lifestyle fits you?</h2>
            <p style={{ fontSize:14, color:'#6B6359', marginBottom:20, lineHeight:1.5 }}>Ascend uses this to schedule tasks realistically.</p>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
              {ARCHETYPES.map(a => (
                <button key={a.id} onClick={() => setArchetype(a.id as Archetype)}
                  style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderRadius:16, border:`1.5px solid ${archetype===a.id?'#D9531E':'rgba(26,24,21,0.08)'}`, background:archetype===a.id?'#FFE9DD':'#fff', cursor:'pointer', textAlign:'left' }}>
                  <span style={{ fontSize:26 }}>{a.emoji}</span>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:archetype===a.id?'#D9531E':'#1A1815' }}>{a.label}</div>
                    <div style={{ fontSize:12, color:'#6B6359', marginTop:2 }}>{a.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setStep('profile')} className="btn-secondary" style={{ width:52, flexShrink:0, padding:0 }}>
                <ChevronLeft size={18} />
              </button>
              <button onClick={() => setStep('goal_area')} disabled={!archetype} className="btn-primary" style={{ flex:1 }}>
                Continue <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* GOAL AREA */}
        {step === 'goal_area' && (
          <div style={{ paddingTop:20 }}>
            <h2 style={{ fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1815', marginBottom:8 }}>What do you want to work on?</h2>
            <p style={{ fontSize:14, color:'#6B6359', marginBottom:20, lineHeight:1.5 }}>Start with one goal. You can add more later.</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
              {AREAS.map(a => (
                <button key={a.id} onClick={() => setGoalArea(a.id as AreaId)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'14px', borderRadius:14, border:`1.5px solid ${goalArea===a.id?'#D9531E':'rgba(26,24,21,0.08)'}`, background:goalArea===a.id?'#FFE9DD':'#fff', cursor:'pointer' }}>
                  <span style={{ fontSize:20 }}>{a.emoji}</span>
                  <span style={{ fontSize:14, fontWeight:600, color:goalArea===a.id?'#D9531E':'#1A1815' }}>{a.label}</span>
                </button>
              ))}
            </div>
            {goalArea && (
              <>
                <div style={{ fontSize:12, fontWeight:600, color:'#6B6359', marginBottom:8 }}>Describe what you want to achieve</div>
                <textarea value={goalText} onChange={e => setGoalText(e.target.value)} rows={3}
                  placeholder="Be specific and honest about your constraints..."
                  style={{ width:'100%', padding:'12px', borderRadius:12, border:'1px solid rgba(26,24,21,0.1)', background:'#fff', fontSize:14, color:'#1A1815', outline:'none', resize:'none', marginBottom:16, lineHeight:1.5 }} />
              </>
            )}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setStep('archetype')} className="btn-secondary" style={{ width:52, flexShrink:0, padding:0 }}>
                <ChevronLeft size={18} />
              </button>
              <button onClick={() => setStep('goal_questions')} disabled={!goalArea || !goalText.trim()} className="btn-primary" style={{ flex:1 }}>
                Continue <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* QUESTIONS */}
        {step === 'goal_questions' && (
          <div style={{ paddingTop:20 }}>
            <h2 style={{ fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1815', marginBottom:8 }}>A few questions.</h2>
            <p style={{ fontSize:14, color:'#6B6359', marginBottom:20, lineHeight:1.5 }}>
              Honest answers = plan that fits your life. Say <strong>"idk"</strong> if unsure — I'll rephrase.
            </p>
            {loadingQ ? (
              <div style={{ display:'flex', alignItems:'center', gap:10, color:'#6B6359' }}>
                <Loader2 size={16} color="#D9531E" style={{ animation:'spin 1s linear infinite' }} />
                <span style={{ fontSize:13 }}>Preparing your questions...</span>
              </div>
            ) : (
              <>
                {dialogue.map((m, i) => (
                  <div key={i} style={{ marginBottom:10, display:'flex', justifyContent: m.role==='user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ padding:'10px 14px', borderRadius:12, background: m.role==='assistant' ? '#FFE9DD' : '#1A1815', color: m.role==='assistant' ? '#B33E0E' : '#fff', fontSize:13, lineHeight:1.55, maxWidth:'90%' }}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {questions[qIdx] && (
                  <div className="fade-up">
                    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
                      <Sparkles size={13} color="#D9531E" />
                      <span style={{ fontSize:11, color:'#D9531E', fontWeight:700 }}>Question {qIdx+1} of {questions.length}</span>
                    </div>
                    <div style={{ fontSize:16, fontWeight:600, color:'#1A1815', lineHeight:1.55, marginBottom:14 }}>
                      {questions[qIdx]}
                    </div>
                    <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={3}
                      placeholder="Be honest — or say 'idk' if you're not sure"
                      style={{ width:'100%', padding:'12px', borderRadius:12, border:'1px solid rgba(26,24,21,0.1)', background:'#fff', fontSize:14, color:'#1A1815', outline:'none', resize:'none', marginBottom:12, lineHeight:1.5 }} />
                    <button onClick={submitAnswer} disabled={!answer.trim()} className="btn-primary">
                      {qIdx < questions.length - 1 ? 'Next question' : 'Last one'} <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* MOTIVATION */}
        {step === 'motivation' && (
          <div style={{ paddingTop:20 }}>
            <h2 style={{ fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1815', marginBottom:8 }}>Why does this matter to you?</h2>
            <p style={{ fontSize:14, color:'#6B6359', marginBottom:20, lineHeight:1.5 }}>
              This becomes your reminder when things get hard.
            </p>
            <textarea value={motivation} onChange={e => setMotivation(e.target.value)} rows={5}
              placeholder='"I want to feel strong and be there for the people I love."'
              style={{ width:'100%', padding:'14px', borderRadius:14, border:'1.5px solid rgba(26,24,21,0.1)', background:'#fff', fontSize:14, color:'#1A1815', outline:'none', resize:'none', marginBottom:20, lineHeight:1.6 }} />
            <button onClick={finish} disabled={saving} className="btn-primary">
              {saving
                ? <><Loader2 size={15} style={{ animation:'spin 1s linear infinite' }} /> Building your plan...</>
                : <><Sparkles size={15} /> Build my plan</>
              }
            </button>
          </div>
        )}

      </div>
    </div>
  );
}