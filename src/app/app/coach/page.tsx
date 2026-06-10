'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Sparkles, Loader2, Plus, Menu, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Goal, ChatMessage } from '@/types';

const COMMANDS = [
  { cmd:'@modify',     desc:'Change anything in your day plan',     on:true  },
  { cmd:'@build',      desc:'Build a new goal by talking to coach', on:false },
  { cmd:'@reflect',    desc:"Log what's been getting in your way",  on:false },
  { cmd:'@check',      desc:'Ask why a goal is slipping',           on:false },
  { cmd:'@reschedule', desc:'Rearrange your week in one message',   on:false },
];

const SUGGESTIONS = [
  'What pattern do you see in my goals?',
  "I keep procrastinating — what should I do?",
  'Am I taking on too much right now?',
];

function sysPrompt(goals: Goal[], memory: string) {
  const list = goals.filter(g=>g.status==='active').map(g=>`[${g.area}] "${g.title}"`).join(', ') || 'none yet';
  return `You are Ascend — a direct, honest cognitive partner.
ACTIVE GOALS: ${list}${memory?`\nUSER MEMORY:\n${memory}`:''}
Speak directly. No generic advice. Max 3-4 sentences. Punchy. Actionable.
If user says "idk" or is unsure, acknowledge briefly then rephrase from a different angle with a concrete example.`;
}

function modifyPrompt(goals: Goal[]) {
  return `You are Ascend making a live plan change. Goals: ${goals.map(g=>`"${g.title}"`).join(', ')}
1-2 sentences. Decisive. Talk TO the user. End with: PLAN_CHANGE: [task] → [change]`;
}

interface Session { id:string; title:string; updated_at:string; }

export default function Coach() {
  const { user } = useAuth();
  const [goals, setGoals]         = useState<Goal[]>([]);
  const [memory, setMemory]       = useState('');
  const [sessionId, setSessionId] = useState(`s_${Date.now()}`);
  const [msgs, setMsgs]           = useState<ChatMessage[]>([]);
  const [sessions, setSessions]   = useState<Session[]>([]);
  const [input, setInput]         = useState('');
  const [thinking, setThinking]   = useState(false);
  const [showCmd, setShowCmd]     = useState(false);
  const [showHist, setShowHist]   = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('goals').select('*').eq('user_id',user.id).eq('status','active').then(({data})=>{ if(data) setGoals(data); });
    supabase.from('user_memory').select('key,value').eq('user_id',user.id).then(({data})=>{
      if(data) setMemory(data.map((r:{key:string;value:unknown})=>`- ${r.key}: ${JSON.stringify(r.value)}`).join('\n'));
    });
  }, [user]);

  useEffect(() => { scrollRef.current?.scrollTo(0,scrollRef.current.scrollHeight); }, [msgs,thinking]);

  const newChat = useCallback(() => { setSessionId(`s_${Date.now()}`); setMsgs([]); setShowHist(false); }, []);

  const loadHistory = async () => {
    if (!user) return;
    const { data } = await supabase.from('chat_logs').select('session_id,session_title,created_at').eq('user_id',user.id).order('created_at',{ascending:false});
    if (data) {
      const seen=new Set<string>(); const out:Session[]=[];
      (data as {session_id:string;session_title:string;created_at:string}[]).forEach(r=>{
        if(!seen.has(r.session_id)){seen.add(r.session_id);out.push({id:r.session_id,title:r.session_title||'Chat',updated_at:r.created_at});}
      });
      setSessions(out.slice(0,20));
    }
    setShowHist(true);
  };

  const loadSession = async (id:string) => {
    if (!user) return;
    const { data } = await supabase.from('chat_logs').select('*').eq('user_id',user.id).eq('session_id',id).order('created_at',{ascending:true});
    if (data) { setMsgs(data.map((r:{role:string;content:string})=>({role:r.role as 'user'|'assistant',content:r.content}))); setSessionId(id); }
    setShowHist(false);
  };

  const save = async (msg:ChatMessage) => {
    if (!user) return;
    await supabase.from('chat_logs').insert({user_id:user.id,session_id:sessionId,session_title:msgs.length===0&&msg.role==='user'?msg.content.slice(0,40):undefined,role:msg.role,content:msg.content});
  };

  const send = async (text:string) => {
    if (!text.trim()||thinking) return;
    setInput(''); setShowCmd(false);
    const userMsg:ChatMessage = {role:'user',content:text.trim()};
    const next = [...msgs,userMsg];
    setMsgs(next); await save(userMsg); setThinking(true);
    const isModify = text.toLowerCase().includes('@modify');
    try {
      const res = await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({system:isModify?modifyPrompt(goals):sysPrompt(goals,memory),messages:next.slice(-10)})});
      const {content} = await res.json();
      let reply = content??'';
      if(isModify&&reply.includes('PLAN_CHANGE:')) reply=reply.split('PLAN_CHANGE:')[0].trim();
      const aiMsg:ChatMessage={role:'assistant',content:reply};
      setMsgs([...next,aiMsg]); await save(aiMsg);
      // Extract memory in background
      if(next.length>=4){fetch('/api/memory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:user.id,conversation:[...next,aiMsg]})});}
    } catch {
      setMsgs(m=>[...m,{role:'assistant',content:"Server error. Try again."}]);
    }
    setThinking(false);
  };

  const handleInput = (v:string) => {
    setInput(v);
    setShowCmd(v.endsWith('@')||(v.includes('@')&&!v.includes('@modify')));
  };

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100dvh'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'16px 16px 12px',borderBottom:'1px solid rgba(26,24,21,0.06)',background:'#F8F5EF',flexShrink:0}}>
        <button onClick={loadHistory} style={{background:'none',border:'none',cursor:'pointer',padding:4}}><Menu size={20} color="#6B6359" /></button>
        <div style={{flex:1,display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:36,height:36,borderRadius:10,background:'#D9531E',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <Sparkles size={16} color="#fff" />
          </div>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:'#1A1815',fontFamily:'Georgia,serif'}}>Coach</div>
            <div style={{fontSize:10,color:'#A8A095'}}>Knows your goals · type <strong style={{color:'#D9531E'}}>@</strong> to modify & more</div>
          </div>
        </div>
        <button onClick={newChat} style={{background:'none',border:'none',cursor:'pointer',padding:4}}><Plus size={20} color="#6B6359" /></button>
      </div>

      {/* History */}
      {showHist && (
        <div style={{position:'absolute',inset:0,background:'#F8F5EF',zIndex:50,display:'flex',flexDirection:'column',maxWidth:430,margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',padding:'16px',borderBottom:'1px solid rgba(26,24,21,0.06)'}}>
            <div style={{flex:1,fontFamily:'Georgia,serif',fontSize:18,fontWeight:700,color:'#1A1815'}}>Chat history</div>
            <button onClick={()=>setShowHist(false)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={20} color="#6B6359" /></button>
          </div>
          <button onClick={newChat} style={{display:'flex',alignItems:'center',gap:10,padding:'14px 16px',background:'none',border:'none',borderBottom:'1px solid rgba(26,24,21,0.06)',cursor:'pointer'}}>
            <Plus size={16} color="#D9531E" /><span style={{fontSize:14,fontWeight:600,color:'#D9531E'}}>New conversation</span>
          </button>
          <div style={{flex:1,overflowY:'auto'}}>
            {sessions.map(s=>(
              <button key={s.id} onClick={()=>loadSession(s.id)} style={{display:'flex',alignItems:'center',padding:'14px 16px',width:'100%',background:'none',border:'none',borderBottom:'1px solid rgba(26,24,21,0.06)',cursor:'pointer',textAlign:'left'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:600,color:'#1A1815',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.title}</div>
                  <div style={{fontSize:11,color:'#A8A095',marginTop:2}}>{new Date(s.updated_at).toLocaleDateString()}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={{flex:1,overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:8}}>
        <div style={{alignSelf:'center',display:'inline-flex',alignItems:'center',gap:6,background:'#FFE9DD',borderRadius:99,padding:'4px 12px',marginBottom:4}}>
          <span style={{width:5,height:5,borderRadius:'50%',background:'#D9531E',flexShrink:0}} />
          <span style={{fontSize:10,fontWeight:700,color:'#D9531E'}}>Real AI · memory-enabled</span>
        </div>

        {msgs.length===0 && (
          <div className="fade-in">
            <div style={{fontSize:12,color:'#A8A095',marginBottom:12}}>Direct. Honest. Knows your goals.</div>
            {SUGGESTIONS.map((s,i)=>(
              <button key={i} onClick={()=>send(s)} style={{display:'block',width:'100%',textAlign:'left',padding:'12px 14px',background:'#fff',border:'1px solid rgba(26,24,21,0.08)',borderRadius:12,fontSize:14,color:'#1A1815',cursor:'pointer',marginBottom:8,fontWeight:500}}>
                {s}
              </button>
            ))}
            <div style={{marginTop:12,padding:'14px',background:'#fff',borderRadius:14,border:'1px solid rgba(26,24,21,0.06)'}}>
              <div className="slabel">Commands · type @</div>
              {COMMANDS.map((c,i)=>(
                <div key={i} style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:i<COMMANDS.length-1?10:0,opacity:c.on?1:0.45}}>
                  <code style={{background:c.on?'#FFE9DD':'#EBE5D6',color:c.on?'#D9531E':'#6B6359',fontSize:11,fontWeight:700,padding:'2px 7px',borderRadius:5,flexShrink:0}}>{c.cmd}</code>
                  <span style={{fontSize:12,color:'#6B6359',lineHeight:1.4}}>{c.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m,i)=>(
          <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
            {m.role==='assistant' && <div style={{width:26,height:26,borderRadius:7,background:'#D9531E',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginRight:8,marginTop:2}}><Sparkles size={12} color="#fff" /></div>}
            <div style={{maxWidth:'82%',padding:'10px 14px',borderRadius:m.role==='user'?'16px 16px 4px 16px':'4px 16px 16px 16px',background:m.role==='user'?'#1A1815':'#fff',border:m.role==='assistant'?'1px solid rgba(26,24,21,0.08)':'none',fontSize:14,color:m.role==='user'?'#fff':'#1A1815',lineHeight:1.6}}>
              {m.content}
            </div>
          </div>
        ))}

        {thinking && (
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:26,height:26,borderRadius:7,background:'#D9531E',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Sparkles size={12} color="#fff" /></div>
            <div style={{display:'flex',gap:4,padding:'8px 0'}}>
              {[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:'50%',background:'#A8A095',animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite`}} />)}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{padding:'10px 16px 16px',borderTop:'1px solid rgba(26,24,21,0.06)',background:'#F8F5EF',flexShrink:0,position:'relative'}}>
        {showCmd && (
          <div style={{position:'absolute',bottom:'100%',left:16,right:16,marginBottom:6,background:'#fff',border:'1px solid rgba(26,24,21,0.12)',borderRadius:14,overflow:'hidden',boxShadow:'0 8px 30px rgba(0,0,0,0.1)'}}>
            <div className="slabel" style={{padding:'8px 12px 6px',borderBottom:'1px solid rgba(26,24,21,0.06)'}}>Commands</div>
            {COMMANDS.filter(c=>c.on).map(c=>(
              <button key={c.cmd} onClick={()=>{setInput(c.cmd+' ');setShowCmd(false);setTimeout(()=>inputRef.current?.focus(),50);}}
                style={{display:'flex',alignItems:'flex-start',gap:10,width:'100%',padding:'12px 14px',background:'none',border:'none',cursor:'pointer',textAlign:'left'}}>
                <code style={{background:'#FFE9DD',color:'#D9531E',fontSize:11,fontWeight:700,padding:'2px 7px',borderRadius:5,flexShrink:0}}>{c.cmd}</code>
                <span style={{fontSize:13,color:'#1A1815'}}>{c.desc}</span>
              </button>
            ))}
          </div>
        )}
        <div style={{display:'flex',gap:8}}>
          <input ref={inputRef} value={input} onChange={e=>handleInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!showCmd)send(input);if(e.key==='Escape')setShowCmd(false);}} placeholder="Ask anything. Type @ to modify & more." disabled={thinking}
            style={{flex:1,padding:'12px 16px',borderRadius:24,border:'1px solid rgba(26,24,21,0.1)',background:'#fff',fontSize:14,color:'#1A1815',outline:'none'}} />
          <button onClick={()=>send(input)} disabled={!input.trim()||thinking}
            style={{width:44,height:44,borderRadius:'50%',background:input.trim()&&!thinking?'#1A1815':'#EBE5D6',border:'none',cursor:input.trim()&&!thinking?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <Send size={16} color={input.trim()&&!thinking?'#fff':'#A8A095'} />
          </button>
        </div>
      </div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-5px);opacity:1}}`}</style>
    </div>
  );
}
