'use client';
import { useState } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Goal, Task } from '@/types';

const REASONS = [
  {id:'tired',label:'😴 Too tired'},{id:'busy',label:'💼 Unexpected work'},
  {id:'forgot',label:'🔔 Forgot'},{id:'unwell',label:'🤒 Not feeling well'},
  {id:'time',label:'⏰ Ran out of time'},{id:'unmotiv',label:'😶 Lost motivation'},
  {id:'other',label:'✏️ Other'},
];

export default function RecalModal({ goal, task, onClose, onDone }:{goal:Goal;task:Task;onClose:()=>void;onDone:()=>void}) {
  const { user } = useAuth();
  const [sel, setSel]       = useState<string[]>([]);
  const [other, setOther]   = useState('');
  const [proposal, setP]    = useState('');
  const [loading, setL]     = useState(false);
  const [applied, setA]     = useState(false);

  const toggle = (id:string) => setSel(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);

  const getProposal = async () => {
    setL(true);
    const reasons = [...sel.map(r=>REASONS.find(x=>x.id===r)?.label??r), other].filter(Boolean).join(', ');
    const res = await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      system:`You are Ascend. User missed "${task.name}" (goal: "${goal.title}") ${task.consecutive_misses} times. Reasons: ${reasons}.
Propose ONE specific plan change in 2-3 sentences. Start with brief empathy then propose concretely (e.g. "3x per week instead of daily"). End with "Want me to update your plan?"`,
      messages:[{role:'user',content:'Give me your proposal.'}]
    })});
    const data = await res.json();
    setP(data.content??''); setL(false);
  };

  const apply = async () => {
    if (!user) return; setA(true);
    await supabase.from('recalibrations').insert({task_id:task.id,user_id:user.id,reason:sel.join(','),ai_proposal:proposal,accepted:true});
    await supabase.from('goals').update({needs_recalibration:false}).eq('id',goal.id);
    await supabase.from('tasks').update({consecutive_misses:0}).eq('id',task.id);
    setTimeout(()=>onDone(),600);
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(26,24,21,0.5)',zIndex:100,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
      <div className="slide-up" style={{background:'#F8F5EF',borderRadius:'20px 20px 0 0',padding:'24px 20px',width:'100%',maxWidth:430,maxHeight:'90dvh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
          <div>
            <div style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:700,color:'#1A1815'}}>Let's recalibrate.</div>
            <div style={{fontSize:13,color:'#6B6359',marginTop:4,lineHeight:1.5}}>This isn't failure. "{task.name}" missed {task.consecutive_misses}× — that's a signal.</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',padding:4}}><X size={20} color="#A8A095" /></button>
        </div>

        {!proposal ? (
          <>
            <div style={{fontSize:14,fontWeight:700,color:'#1A1815',marginBottom:12}}>What's been getting in the way?</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
              {REASONS.map(r=>(
                <button key={r.id} onClick={()=>toggle(r.id)} style={{padding:'8px 12px',borderRadius:99,border:`1.5px solid ${sel.includes(r.id)?'#D9531E':'rgba(26,24,21,0.1)'}`,background:sel.includes(r.id)?'#FFE9DD':'#fff',cursor:'pointer',fontSize:13,fontWeight:600,color:sel.includes(r.id)?'#D9531E':'#6B6359'}}>
                  {r.label}
                </button>
              ))}
            </div>
            {sel.includes('other') && (
              <textarea value={other} onChange={e=>setOther(e.target.value)} rows={2} placeholder="What's actually happening..."
                style={{width:'100%',padding:'12px',borderRadius:12,border:'1px solid rgba(26,24,21,0.1)',background:'#fff',fontSize:14,color:'#1A1815',outline:'none',resize:'none',marginBottom:12}} />
            )}
            <button onClick={getProposal} disabled={sel.length===0||loading} className="btn-primary" style={{opacity:sel.length===0?0.4:1}}>
              {loading ? <><Loader2 size={15} style={{animation:'spin 1s linear infinite'}} /> Getting proposal...</> : <><Sparkles size={15} /> Get AI proposal</>}
            </button>
          </>
        ) : (
          <div className="fade-up">
            <div style={{background:'#1A1815',borderRadius:14,padding:'16px',marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:700,color:'#D9531E',letterSpacing:'1.5px',textTransform:'uppercase',marginBottom:8}}>Ascend's Proposal</div>
              <div style={{fontSize:14,color:'rgba(255,255,255,0.9)',lineHeight:1.6}}>{proposal}</div>
            </div>
            {applied
              ? <div style={{textAlign:'center',padding:'12px',fontSize:15,fontWeight:700,color:'#1B7A5C'}}>✓ Plan updated</div>
              : <div style={{display:'flex',gap:10}}>
                  <button onClick={onClose} className="btn-secondary" style={{flex:1}}>Not now</button>
                  <button onClick={apply} className="btn-primary" style={{flex:2}}>Yes, update plan</button>
                </div>
            }
          </div>
        )}
      </div>
    </div>
  );
}
