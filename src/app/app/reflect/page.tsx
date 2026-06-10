'use client';
import { useState } from 'react';
import { Sparkles, Loader2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const TAGS = ['😴 Fatigue','💼 Work overload','🌀 Lack of focus','🤒 Unwell','😶 Unmotivated','🌊 Overwhelmed','⏰ No time','📵 Distracted'];

export default function Reflect() {
  const { user } = useAuth();
  const [sel, setSel]         = useState<string[]>([]);
  const [free, setFree]       = useState('');
  const [reply, setReply]     = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved]     = useState(false);

  const toggle = (t:string) => setSel(s=>s.includes(t)?s.filter(x=>x!==t):[...s,t]);

  const reflect = async () => {
    if (sel.length===0&&!free.trim()) return;
    setLoading(true);
    const ctx = [...sel, free].filter(Boolean).join(', ');
    const res = await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      system:`You are Ascend. User is reflecting on blockers: ${ctx}. Respond in 2-3 sentences: acknowledge honestly then give ONE concrete reframe or action. No generic advice. No "that's okay!" filler.`,
      messages:[{role:'user',content:'Here is what has been getting in my way.'}]
    })});
    const data = await res.json();
    setReply(data.content??'');
    if (user) await supabase.from('recalibrations').insert({user_id:user.id,reason:ctx,ai_proposal:data.content,accepted:false});
    setLoading(false); setSaved(true);
  };

  const reset = () => { setSel([]); setFree(''); setReply(''); setSaved(false); };

  return (
    <div style={{padding:'0 16px',paddingTop:8}}>
      <h1 style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,color:'#1A1815',marginBottom:4,marginTop:8}}>Reflect</h1>
      <div style={{fontSize:13,color:'#6B6359',marginBottom:20,lineHeight:1.5}}>Log what's been getting in your way. Patterns become insights.</div>

      {!reply ? (
        <>
          <div style={{fontSize:14,fontWeight:700,color:'#1A1815',marginBottom:12}}>What's been blocking you?</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
            {TAGS.map(t=>(
              <button key={t} onClick={()=>toggle(t)} style={{padding:'8px 12px',borderRadius:99,border:`1.5px solid ${sel.includes(t)?'#D9531E':'rgba(26,24,21,0.1)'}`,background:sel.includes(t)?'#FFE9DD':'#fff',cursor:'pointer',fontSize:13,fontWeight:600,color:sel.includes(t)?'#D9531E':'#6B6359'}}>
                {t}
              </button>
            ))}
          </div>
          <div style={{fontSize:14,fontWeight:700,color:'#1A1815',marginBottom:8}}>Anything else?</div>
          <textarea value={free} onChange={e=>setFree(e.target.value)} rows={3} placeholder="Write anything on your mind..."
            style={{width:'100%',padding:'12px',borderRadius:14,border:'1px solid rgba(26,24,21,0.1)',background:'#fff',fontSize:14,color:'#1A1815',outline:'none',resize:'none',marginBottom:16,lineHeight:1.5}} />
          <button onClick={reflect} disabled={(sel.length===0&&!free.trim())||loading} className="btn-primary" style={{opacity:(sel.length===0&&!free.trim())?0.4:1}}>
            {loading ? <><Loader2 size={15} style={{animation:'spin 1s linear infinite'}} /> Getting insight...</> : <><Sparkles size={15} /> Get AI insight</>}
          </button>
        </>
      ) : (
        <div className="fade-up">
          <div style={{background:'#1A1815',borderRadius:16,padding:'18px',marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
              <Sparkles size={13} color="#D9531E" />
              <span style={{fontSize:10,fontWeight:700,color:'#D9531E',letterSpacing:'1.5px',textTransform:'uppercase'}}>Ascend's take</span>
            </div>
            <div style={{fontSize:14,color:'rgba(255,255,255,0.9)',lineHeight:1.65,fontFamily:'Georgia,serif',fontStyle:'italic'}}>"{reply}"</div>
          </div>
          {saved && (
            <div style={{display:'flex',alignItems:'center',gap:6,background:'#D9F0E5',borderRadius:10,padding:'10px 14px',marginBottom:16}}>
              <Check size={14} color="#1B7A5C" />
              <span style={{fontSize:12,fontWeight:600,color:'#1B7A5C'}}>Saved — Ascend will look for patterns over time</span>
            </div>
          )}
          <button onClick={reset} className="btn-secondary">Reflect again</button>
        </div>
      )}
    </div>
  );
}
