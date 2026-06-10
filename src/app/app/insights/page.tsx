'use client';
import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Loader2, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { area } from '@/lib/areas';
import type { Goal } from '@/types';

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export default function Insights() {
  const { user } = useAuth();
  const [goals, setGoals]     = useState<Goal[]>([]);
  const [week, setWeek]       = useState<number[]>([0,0,0,0,0,0,0]);
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(true);
  const [iLoad, setILoad]     = useState(false);
  const [bars, setBars]       = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const dates: string[] = [];
    for (let i=6;i>=0;i--) { const d=new Date(); d.setDate(d.getDate()-i); dates.push(d.toISOString().split('T')[0]); }
    const [g, c] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id',user.id).eq('status','active'),
      supabase.from('daily_check_ins').select('*').eq('user_id',user.id).gte('date',dates[0]).lte('date',dates[6]),
    ]);
    if (g.data) setGoals(g.data);
    if (c.data) {
      setWeek(dates.map(date => {
        const day = (c.data as {date:string;completed:boolean}[]).filter(x=>x.date===date);
        if (!day.length) return 0;
        return Math.round(day.filter(x=>x.completed).length/day.length*100);
      }));
    }
    setLoading(false);
    setTimeout(()=>setBars(true),100);
    if (g.data?.length) {
      setILoad(true);
      const names = (g.data as Goal[]).map(x=>`${x.title} (${x.area})`).join(', ');
      fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        system:`One sharp insight about the user's goals: ${names}. 1 sentence. No encouragement. State the pattern honestly. Reference goal names.`,
        messages:[{role:'user',content:'What pattern do you see?'}]
      })}).then(r=>r.json()).then(d=>{ setInsight(d.content?.replace(/^["'""]|["'""]$/g,'')||''); setILoad(false); });
    }
  }, [user]);

  useEffect(()=>{ load(); },[load]);

  const avg  = Math.round(week.reduce((a,b)=>a+b,0)/7);
  const best = week.indexOf(Math.max(...week));

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60dvh'}}><Loader2 size={24} color="#D9531E" style={{animation:'spin 1s linear infinite'}} /></div>;

  return (
    <div style={{padding:'0 16px',paddingTop:8}}>
      <h1 style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,color:'#1A1815',marginBottom:4,marginTop:8}}>Insights</h1>
      <div style={{fontSize:13,color:'#6B6359',marginBottom:20}}>What the data is telling you.</div>

      <div style={{background:'#1A1815',borderRadius:16,padding:'16px',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:10}}>
          <Sparkles size={13} color="#D9531E" />
          <span style={{fontSize:10,fontWeight:700,color:'#D9531E',letterSpacing:'1.5px',textTransform:'uppercase'}}>AI Observation</span>
        </div>
        {iLoad
          ? <div style={{display:'flex',alignItems:'center',gap:8}}><Loader2 size={13} color="#6B6359" style={{animation:'spin 1s linear infinite'}} /><span style={{fontSize:13,color:'#6B6359'}}>Analysing patterns...</span></div>
          : <p style={{fontSize:14,color:'rgba(255,255,255,0.88)',lineHeight:1.65,margin:0,fontStyle:'italic',fontFamily:'Georgia,serif'}}>"{insight||'Keep checking in — insights improve with more data.'}"</p>
        }
      </div>

      <div className="slabel">This week</div>
      <div className="card" style={{marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
          <div><div style={{fontFamily:'Georgia,serif',fontSize:32,fontWeight:700,color:'#1A1815',lineHeight:1}}>{avg}%</div><div style={{fontSize:11,color:'#A8A095',marginTop:4}}>avg completion</div></div>
          <div style={{textAlign:'right'}}><div style={{fontSize:14,fontWeight:700,color:'#1B7A5C'}}>{DAYS[best]}</div><div style={{fontSize:11,color:'#A8A095',marginTop:4}}>best day</div></div>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'flex-end',height:64}}>
          {week.map((pct,i)=>(
            <div key={DAYS[i]} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
              <div style={{width:'100%',height:52,display:'flex',alignItems:'flex-end'}}>
                <div style={{width:'100%',height:bars?`${Math.max(pct/100*52,pct>0?4:0)}px`:'0px',borderRadius:'4px 4px 0 0',background:i===6?'#D9531E':pct>=80?'#1B7A5C':pct>=50?'#B8721C':'#EBE5D6',transition:`height 0.5s ease ${i*0.06}s`}} />
              </div>
              <span style={{fontSize:10,color:i===6?'#D9531E':'#A8A095',fontWeight:i===6?700:500}}>{DAYS[i].slice(0,1)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="slabel">Goal health</div>
      <div className="card" style={{marginBottom:16}}>
        {goals.length===0
          ? <div style={{fontSize:13,color:'#A8A095',textAlign:'center',padding:'8px 0'}}>No active goals yet.</div>
          : goals.map((g,i)=>{
              const a=area(g.area); const pct=g.completion_pct;
              const status=pct>=70?'On track':pct>=40?'Slipping':'At risk';
              const color=pct>=70?'#1B7A5C':pct>=40?'#B8721C':'#D9531E';
              return (
                <div key={g.id} style={{paddingTop:i>0?14:0,borderTop:i>0?'1px solid rgba(26,24,21,0.06)':'none',marginTop:i>0?14:0}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0,flex:1}}>
                      <span style={{fontSize:16,flexShrink:0}}>{a.emoji}</span>
                      <span style={{fontSize:13,fontWeight:600,color:'#1A1815',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{g.title}</span>
                    </div>
                    <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0,marginLeft:8}}>
                      <span style={{fontSize:11,fontWeight:700,color}}>{status}</span>
                      <span style={{fontSize:13,fontWeight:700,color}}>{pct}%</span>
                    </div>
                  </div>
                  <div style={{height:5,background:'#EBE5D6',borderRadius:3,overflow:'hidden'}}>
                    <div style={{height:'100%',width:bars?`${pct}%`:'0%',background:color,borderRadius:3,transition:`width 0.7s ease ${i*0.15}s`}} />
                  </div>
                </div>
              );
            })
        }
      </div>

      {avg>0 && (
        <div style={{background:'#FFE9DD',borderRadius:12,padding:'12px 14px',marginBottom:24,display:'flex',gap:8}}>
          <TrendingUp size={14} color="#D9531E" style={{marginTop:1,flexShrink:0}} />
          <span style={{fontSize:12,color:'#B33E0E',lineHeight:1.5}}>Schedule your hardest tasks on {DAYS[best]} — that's when you actually show up.</span>
        </div>
      )}
    </div>
  );
}
