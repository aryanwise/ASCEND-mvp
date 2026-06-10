'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Target, Plus, X, Sparkles, BarChart3, Feather } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const FAB_ITEMS = [
  { icon: Sparkles, label: 'Coach',    path: '/app/coach',    color: '#D9531E' },
  { icon: BarChart3, label: 'Insights', path: '/app/insights', color: '#3D4D8A' },
  { icon: Feather,   label: 'Reflect',  path: '/app/reflect',  color: '#1B7A5C' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const [fabOpen, setFabOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth');
  }, [user, loading, router]);

  if (loading) return null;

  const isActive = (p: string) => pathname === p;

  return (
    <div className="shell">
      {/* Content */}
      <div className="scroll pt-safe">
        {children}
      </div>

      {/* FAB overlay */}
      {fabOpen && (
        <div onClick={() => setFabOpen(false)} style={{ position:'absolute', inset:0, background:'rgba(248,245,239,0.88)', backdropFilter:'blur(12px)', zIndex:40, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', paddingBottom:100 }}>
          {FAB_ITEMS.map((item, i) => {
            const Icon = item.icon;
            return (
              <button key={item.path} onClick={e => { e.stopPropagation(); setFabOpen(false); router.push(item.path); }}
                className="fade-up"
                style={{ display:'flex', alignItems:'center', gap:12, background:'#1A1815', color:'#fff', border:'none', borderRadius:20, padding:'13px 28px', marginBottom:10, fontSize:15, fontWeight:700, cursor:'pointer', minWidth:180, justifyContent:'center', animationDelay:`${i*0.04}s` }}>
                <Icon size={18} color={item.color} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom nav */}
      <div className="nav">
        <NavBtn label="Home"  icon={<Home  size={22} />} active={isActive('/app')}        onClick={() => router.push('/app')} />
        <NavBtn label="Goals" icon={<Target size={22} />} active={isActive('/app/goals')} onClick={() => router.push('/app/goals')} />

        {/* FAB */}
        <div style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center', paddingTop:4, paddingBottom:4 }}>
          <button onClick={() => setFabOpen(f => !f)} style={{ width:52, height:52, borderRadius:'50%', background:'#D9531E', border:'3px solid #F8F5EF', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 4px 16px rgba(217,83,30,0.4)', transition:'transform 0.2s', transform:fabOpen?'rotate(45deg)':'rotate(0)' }}>
            <Plus size={24} color="#fff" />
          </button>
        </div>

        {/* Empty slots for balance */}
        <div style={{ flex:1 }} />
        <div style={{ flex:1 }} />
      </div>
    </div>
  );
}

function NavBtn({ label, icon, active, onClick }: { label:string; icon:React.ReactNode; active:boolean; onClick:()=>void }) {
  return (
    <button onClick={onClick} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, paddingTop:10, paddingBottom:6, background:'none', border:'none', cursor:'pointer', color:active?'#D9531E':'#A8A095' }}>
      {icon}
      <span style={{ fontSize:10, fontWeight:active?700:500 }}>{label}</span>
    </button>
  );
}
