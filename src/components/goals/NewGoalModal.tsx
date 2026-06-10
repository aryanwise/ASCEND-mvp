'use client';
import { useState, useEffect } from 'react';
import { X, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { AreaId } from '@/types';

const AREAS = [
  {id:'fitness',emoji:'💪',label:'Fitness'},{id:'study',emoji:'📚',label:'Study'},
  {id:'career',emoji:'💼',label:'Career'},{id:'diet',emoji:'🥗',label:'Diet'},
  {id:'mind',emoji:'🧠',label:'Mind'},{id:'money',emoji:'💰',label:'Money'},
  {id:'health',emoji:'❤️',label:'Health'},{id:'habits',emoji:'✨',label:'Habits'},
  {id:'custom',emoji:'🎯',label:'Custom'},
] as const;

type Step = 'area'|'questions'|'motivation';

export default function NewGoalModal({ onClose, onCreated }:{onClose:()=>void;onCreated:()=>void}) {
  const { user } = useAuth();
  const [step, setStep]       = useState<Step>('area');
  const [area, setArea]       = useState<AreaId|null>(null);
  const [text, setText]       = useState('');
  const [questions, setQs]    = useState<string[]>([]);
  const [qIdx, setQIdx]       = useState(0);
  const [dialogue, setDl]     = useState<{role:'user'|'assistant';content:string}[]>([]);
  const [answer, setAnswer]   = useState('');
  const [motivation, setMot]  = useState('');
  const [loadQ, setLoadQ]     = useState(false);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (step==='questions'&&questions.length===0) {
      setLoadQ(true);
      fetch('/api/goal-questions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({area,goalText:text})})
        .then(r=>r.json()).then(d=>{setQs(d.questions??[]);setLoadQ(false);});
    }
  },[step]);

  const submit = () => {
    if (!answer.trim()) return;
    setDl(d=>[...d,{role:'assistant',content:questions[qIdx]},{role:'user',content:answer.trim()}]);
    setAnswer('');
    if (qIdx<questions.length-1) setQIdx(i=>i+1); else setStep('motivation');
  };

  const create = async () => {
    if (!user) return; setSaving(true);
    await fetch('/api/goals/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:user.id,area,goalText:text,dialogue,motivation})});
    setSaving(false); onCreated();
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(26,24,21,0.5)',zIndex:100,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
      <div className="slide-up" style={{background:'#F8F5EF',borderRadius:'20px 20px 0 0',padding:'24px 20px',width:'100%',maxWidth:430,maxHeight:'90dvh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:700,color:'#1A1815'}}>New goal</div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer'}}><X size={20} color="#A8A095" /></button>
        </div>

        {step==='area' && (
          <div className="fade-up">
            <div style={{fontSize:13,color:'#6B6359',marginBottom:14}}>Pick a life area</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
              {AREAS.map(a=>(
                <button key={a.id} onClick={()=>setArea(a.id as AreaId)} style={{display:'flex',alignItems:'center',gap:8,padding:'12px',borderRadius:12,border:`1.5px solid ${area===a.id?'#D9531E':'rgba(26,24,21,0.08)'}`,background:area===a.id?'#FFE9DD':'#fff',cursor:'pointer'}}>
                  <span style={{fontSize:18}}>{a.emoji}</span>
                  <span style={{fontSize:13,fontWeight:600,color:area===a.id?'#D9531E':'#1A1815'}}>{a.label}</span>
                </button>
              ))}
            </div>
            {area && <>
              <div style={{fontSize:13,fontWeight:600,color:'#1A1815',marginBottom:8}}>Describe what you want to achieve</div>
              <textarea value={text} onChange={e=>setText(e.target.value)} rows={3} placeholder="Be specific and honest about constraints..."
                style={{width:'100%',padding:'12px',borderRadius:12,border:'1px solid rgba(26,24,21,0.1)',background:'#fff',fontSize:14,color:'#1A1815',outline:'none',resize:'none',marginBottom:14,lineHeight:1.5}} />
            </>}
            <button onClick={()=>setStep('questions')} disabled={!area||!text.trim()} className="btn-primary" style={{opacity:!area||!text.trim()?0.4:1}}>
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}

        {step==='questions' && (
          <div className="fade-up">
            {loadQ ? <div style={{display:'flex',gap:10,alignItems:'center',color:'#6B6359'}}><Loader2 size={16} color="#D9531E" style={{animation:'spin 1s linear infinite'}} /><span style={{fontSize:13}}>Preparing questions...</span></div>
              : questions[qIdx] && <>
                <div style={{fontSize:11,color:'#A8A095',marginBottom:8}}>Question {qIdx+1} of {questions.length}</div>
                <div style={{fontSize:16,fontWeight:600,color:'#1A1815',lineHeight:1.55,marginBottom:14}}>{questions[qIdx]}</div>
                <textarea value={answer} onChange={e=>setAnswer(e.target.value)} rows={3} placeholder='Be honest — or say "idk" if unsure'
                  style={{width:'100%',padding:'12px',borderRadius:12,border:'1px solid rgba(26,24,21,0.1)',background:'#fff',fontSize:14,color:'#1A1815',outline:'none',resize:'none',marginBottom:12,lineHeight:1.5}} />
                <button onClick={submit} disabled={!answer.trim()} className="btn-primary" style={{opacity:!answer.trim()?0.4:1}}>
                  {qIdx<questions.length-1?'Next question':'Last one →'} <ChevronRight size={16} />
                </button>
              </>
            }
          </div>
        )}

        {step==='motivation' && (
          <div className="fade-up">
            <div style={{fontSize:16,fontWeight:700,color:'#1A1815',marginBottom:8}}>Why does this matter?</div>
            <div style={{fontSize:13,color:'#6B6359',marginBottom:14}}>This becomes your reminder when things get hard.</div>
            <textarea value={motivation} onChange={e=>setMot(e.target.value)} rows={4} placeholder='"I want to feel strong and show up for the people I love."'
              style={{width:'100%',padding:'12px',borderRadius:12,border:'1px solid rgba(26,24,21,0.1)',background:'#fff',fontSize:14,color:'#1A1815',outline:'none',resize:'none',marginBottom:16,lineHeight:1.5}} />
            <button onClick={create} disabled={saving} className="btn-primary">
              {saving?<><Loader2 size={15} style={{animation:'spin 1s linear infinite'}} /> Building plan...</>:<><Sparkles size={15} /> Create goal</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
