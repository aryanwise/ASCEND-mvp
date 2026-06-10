'use client';
import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, PauseCircle, Play, Plus, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { area } from '@/lib/areas';
import type { Goal, Task } from '@/types';
import RecalModal from '@/components/goals/RecalModal';
import NewGoalModal from '@/components/goals/NewGoalModal';

type GWT = Goal & { tasks: Task[] };

export default function Goals() {
  const { user } = useAuth();
  const [goals, setGoals]           = useState<GWT[]>([]);
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());
  const [recalGoal, setRecalGoal]   = useState<GWT|null>(null);
  const [recalTask, setRecalTask]   = useState<Task|null>(null);
  const [newGoal, setNewGoal]       = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('goals').select('*, tasks(*)').eq('user_id', user.id).order('created_at', { ascending:false });
    if (data) setGoals(data as GWT[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setExpanded(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });
  const unpause = async (id: string) => {
    await supabase.from('goals').update({ status:'active' }).eq('id', id);
    setGoals(g => g.map(x => x.id===id ? { ...x, status:'active' } : x));
  };

  const active = goals.filter(g => g.status === 'active');
  const paused = goals.filter(g => g.status === 'paused');

  if (loading) return <Spinner />;

  return (
    <div style={{ padding:'0 16px', paddingTop:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, paddingTop:8 }}>
        <div>
          <h1 style={{ fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1815', margin:0 }}>Goals</h1>
          <div style={{ fontSize:12, color:'#6B6359', marginTop:3 }}>{active.length} active · {paused.length} paused</div>
        </div>
        <button onClick={() => setNewGoal(true)} style={{ display:'flex',alignItems:'center',gap:6,padding:'9px 14px',background:'#D9531E',color:'#fff',border:'none',borderRadius:12,fontSize:13,fontWeight:700,cursor:'pointer' }}>
          <Plus size={15} /> New goal
        </button>
      </div>

      {active.length === 0 && (
        <div style={{ background:'#fff',borderRadius:16,padding:'28px',border:'1px dashed rgba(26,24,21,0.12)',textAlign:'center',marginBottom:16 }}>
          <Sparkles size={22} color="#D9531E" style={{ marginBottom:10 }} />
          <div style={{ fontSize:14,fontWeight:700,color:'#1A1815',marginBottom:6 }}>No active goals</div>
          <div style={{ fontSize:13,color:'#6B6359' }}>Tap "New goal" to create your first one.</div>
        </div>
      )}

      {active.map(g => (
        <GoalCard key={g.id} goal={g} expanded={expanded.has(g.id)} onToggle={()=>toggle(g.id)}
          onRecal={t=>{ setRecalGoal(g); setRecalTask(t); }} />
      ))}

      {paused.length > 0 && (
        <>
          <div className="slabel" style={{ marginTop:20, display:'flex', alignItems:'center', gap:6 }}>
            <PauseCircle size={11} /> Paused
          </div>
          {paused.map(g => (
            <GoalCard key={g.id} goal={g} expanded={expanded.has(g.id)} onToggle={()=>toggle(g.id)}
              onRecal={t=>{ setRecalGoal(g); setRecalTask(t); }} dimmed onUnpause={()=>unpause(g.id)} />
          ))}
        </>
      )}

      {recalGoal && recalTask && (
        <RecalModal goal={recalGoal} task={recalTask} onClose={()=>{ setRecalGoal(null); setRecalTask(null); }} onDone={()=>{ load(); setRecalGoal(null); setRecalTask(null); }} />
      )}
      {newGoal && <NewGoalModal onClose={()=>setNewGoal(false)} onCreated={()=>{ load(); setNewGoal(false); }} />}
    </div>
  );
}

function GoalCard({ goal, expanded, onToggle, onRecal, dimmed=false, onUnpause }: {
  goal: GWT; expanded:boolean; onToggle:()=>void; onRecal:(t:Task)=>void; dimmed?:boolean; onUnpause?:()=>void;
}) {
  const a = area(goal.area);
  const missedTask = goal.tasks.find(t => t.consecutive_misses >= 2);

  return (
    <div style={{ background:'#fff', borderRadius:16, marginBottom:10, border:`${goal.needs_recalibration?'2px solid #D9531E':'1px solid rgba(26,24,21,0.08)'}`, opacity:dimmed?0.7:1, overflow:'hidden' }}>
      {dimmed && onUnpause && (
        <button onClick={onUnpause} style={{ display:'flex',alignItems:'center',gap:6,width:'100%',padding:'8px 14px',background:'#F8F5EF',border:'none',borderBottom:'1px solid rgba(26,24,21,0.06)',cursor:'pointer',fontSize:12,fontWeight:600,color:'#6B6359' }}>
          <Play size={12} /> Resume goal
        </button>
      )}
      {goal.needs_recalibration && missedTask && (
        <button onClick={()=>onRecal(missedTask)} style={{ display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 14px',background:'#FFE9DD',border:'none',borderBottom:'1px solid rgba(217,83,30,0.15)',cursor:'pointer',textAlign:'left' }}>
          <AlertTriangle size={15} color="#D9531E" style={{ flexShrink:0 }} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12,fontWeight:700,color:'#D9531E' }}>Needs recalibration</div>
            <div style={{ fontSize:11,color:'#B33E0E',marginTop:1 }}>"{missedTask.name}" missed {missedTask.consecutive_misses}× in a row</div>
          </div>
          <span style={{ fontSize:12,fontWeight:700,color:'#D9531E' }}>Fix →</span>
        </button>
      )}
      <button onClick={onToggle} style={{ display:'flex',alignItems:'flex-start',gap:12,width:'100%',padding:'14px',background:'none',border:'none',cursor:'pointer',textAlign:'left' }}>
        <div style={{ width:44,height:44,borderRadius:12,background:a.soft,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0 }}>
          {a.emoji}
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:15,fontWeight:700,color:'#1A1815',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{goal.title}</div>
          <div style={{ fontSize:12,fontWeight:700,color:a.color,marginTop:2 }}>{a.label} · {goal.duration}</div>
          <div style={{ marginTop:9 }}>
            <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
              <span style={{ fontSize:11,color:'#A8A095' }}>Completion</span>
              <span style={{ fontSize:11,fontWeight:700,color:goal.completion_pct>60?'#1B7A5C':goal.completion_pct>30?'#B8721C':'#D9531E' }}>{goal.completion_pct}%</span>
            </div>
            <div style={{ height:4,background:'#EBE5D6',borderRadius:2,overflow:'hidden' }}>
              <div style={{ height:'100%',width:`${goal.completion_pct}%`,background:a.color,borderRadius:2 }} />
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} color="#A8A095" style={{ marginTop:4 }} /> : <ChevronDown size={16} color="#A8A095" style={{ marginTop:4 }} />}
      </button>
      {expanded && (
        <div style={{ borderTop:'1px solid rgba(26,24,21,0.06)',padding:'12px 14px 14px' }}>
          <div className="slabel">Recurring tasks</div>
          {goal.tasks.map((t,i) => (
            <div key={t.id} style={{ display:'flex',alignItems:'flex-start',gap:10,paddingTop:i>0?10:0,borderTop:i>0?'1px solid rgba(26,24,21,0.05)':'none' }}>
              <div style={{ width:6,height:6,borderRadius:'50%',background:t.consecutive_misses>=2?'#D9531E':a.color,marginTop:5,flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13,fontWeight:600,color:'#1A1815' }}>{t.name}</div>
                <div style={{ fontSize:11,color:'#A8A095',marginTop:2 }}>{t.frequency}{t.duration?` · ${t.duration}`:''}</div>
              </div>
              {t.consecutive_misses>=2 && <span style={{ fontSize:9,fontWeight:700,background:'#FFE9DD',color:'#D9531E',padding:'2px 6px',borderRadius:4 }}>Missed {t.consecutive_misses}×</span>}
            </div>
          ))}
          {goal.motivation && (
            <div style={{ marginTop:12,background:a.soft,borderRadius:10,padding:'10px 12px' }}>
              <div style={{ fontSize:10,fontWeight:700,color:a.color,marginBottom:4 }}>Why you started</div>
              <div style={{ fontSize:12,color:'#1A1815',lineHeight:1.55,fontStyle:'italic' }}>"{goal.motivation}"</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60dvh' }}><Loader2 size={24} color="#D9531E" style={{ animation:'spin 1s linear infinite' }} /></div>;
}
