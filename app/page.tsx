"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AlertTriangle, Play, Trash2, Settings } from 'lucide-react';

const mainMenuItems = [
  { title: "Start Workout", href: "/start-workout" },
  { title: "Create Template", href: "/create-template" },
  { title: "Hub", href: "/hub" }, 
  { title: "Statistics", href: "/statistics" },
  { title: "Nutrition", href: "/nutrition" },
];

export default function Home() {
  const router = useRouter();
  const [nickname, setNickname] = useState<string>("");
  const [showRescueModal, setShowRescueModal] = useState(false);
  
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (!session || error) {
        router.replace('/login');
        return; 
      }

      if (session.user.user_metadata?.nickname) {
        setNickname(session.user.user_metadata.nickname);
      }

      const savedWorkout = localStorage.getItem("gymking_active_workout");
      if (savedWorkout) {
        setShowRescueModal(true);
      }

      setIsAuthenticating(false);
    };

    initializeApp();
  }, [router]);

  const handleResumeWorkout = () => {
    setShowRescueModal(false);
    router.push("/active-workout?resume=true");
  };

  const handleDiscardWorkout = () => {
    localStorage.removeItem("gymking_active_workout");
    setShowRescueModal(false);
  };

  if (isAuthenticating) {
    return (
      <main className="flex h-[100dvh] items-center justify-center bg-base text-main relative overflow-hidden">
        <div className="flex flex-col items-center gap-6 z-10">
          <div className="w-16 h-16 relative flex items-center justify-center animate-pulse">
             <img src="/logoG.png" alt="Caricamento" className="w-full h-full object-contain dark:hidden" />
             <img src="/logo.png" alt="Caricamento" className="w-full h-full object-contain hidden dark:block" />
          </div>
          <div className="w-8 h-8 border-4 border-line border-t-brand rounded-full animate-spin"></div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-[100dvh] flex-col items-center pt-8 px-4 pb-6 transition-colors duration-300 relative overflow-hidden bg-base">
      
      {/* GHIRIGORI DECORATIVI */}
      <div className="absolute top-12 left-[-10%] w-64 h-64 opacity-30 dark:opacity-10 pointer-events-none">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path fill="none" stroke="currentColor" strokeWidth="1.5" className="text-line" d="M10,100 C50,20 150,20 190,100" />
        </svg>
      </div>
      <div className="absolute top-64 right-[-15%] w-96 h-96 opacity-30 dark:opacity-10 pointer-events-none">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
           <path fill="none" stroke="currentColor" strokeWidth="1" className="text-line" d="M10,10 C50,150 150,150 190,10" />
        </svg>
      </div>

      {/* HEADER */}
      <div className="w-full max-w-md shrink-0 flex flex-col items-center gap-2 mb-4 pb-6 border-b-4 border-line transition-colors duration-300 relative z-10">
        <h1 className="font-heading text-5xl sm:text-6xl font-black tracking-tighter uppercase transition-colors duration-300">
           <span className="text-main">GYM</span>
           <span className="text-brand">KING</span>
        </h1>
        
        <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted mt-1 bg-surface px-4 py-1 border-2 border-line shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#804CD9]">
          BENTORNATO, {nickname || "RE"}
        </span>

        <div className="w-32 h-32 relative flex items-center justify-center mt-2">
           <img src="/logoG.png" alt="King Gym Logo Chiaro" className="w-full h-full object-contain dark:hidden scale-125" />
           <img src="/logo.png" alt="King Gym Logo Scuro" className="w-full h-full object-contain hidden dark:block scale-125" />
        </div>
      </div>

      {/* MENU DINAMICO ORA TOTALMENTE UNIFORME */}
      <div className="w-full max-w-md flex-1 overflow-y-auto flex flex-col gap-4 relative z-10 pb-4 scrollbar-hide">
        {mainMenuItems.map((item, index) => (
          <Link href={item.href} key={index} className="group outline-none shrink-0">
            <div className="w-full py-4 px-6 bg-surface border-2 border-line 
                            shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] 
                            transition-all duration-200 
                            group-hover:translate-x-[2px] group-hover:translate-y-[2px] 
                            group-hover:shadow-[2px_2px_0px_#000000] dark:group-hover:shadow-[2px_2px_0px_#804CD9] 
                            active:translate-x-[4px] active:translate-y-[4px] active:shadow-none 
                            flex items-center justify-between">
              <span className="font-sans text-lg font-black uppercase tracking-widest text-main transition-colors duration-300">
                {item.title}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* FOOTER ANCORATO */}
      <div className="w-full max-w-md shrink-0 pt-4 border-t-4 border-line relative z-10 mt-auto bg-base">
        <Link href="/settings" className="w-full group outline-none flex">
          <div className="w-full py-3 px-6 bg-surface border-2 border-line shadow-[4px_4px_0px_#000000] transition-all duration-200 group-hover:bg-main group-hover:text-base active:translate-x-[4px] active:translate-y-[4px] active:shadow-none flex justify-center items-center gap-2">
             <Settings size={18} strokeWidth={2.5} className="text-muted group-hover:text-base transition-colors" />
             <span className="font-sans text-sm font-black uppercase tracking-widest text-muted group-hover:text-base transition-colors duration-300">
                Impostazioni
             </span>
          </div>
        </Link>
      </div>

      {/* MODALE RESCUE (ALLENAMENTO SOSPESO) */}
      {showRescueModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-base border-4 border-brand p-6 shadow-[12px_12px_0px_#000000] flex flex-col gap-6 animate-in zoom-in-95 duration-200">
            
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-16 h-16 bg-brand flex items-center justify-center border-4 border-line shadow-[4px_4px_0px_#000000] mb-2">
                <AlertTriangle size={32} strokeWidth={3} className="text-base" />
              </div>
              <h2 className="font-heading text-3xl font-black text-main uppercase tracking-tighter leading-tight">Sessione<br/>In Sospeso</h2>
              <p className="text-xs font-bold text-muted uppercase tracking-widest mt-2 px-2">
                Hai un allenamento attivo in background. Vuoi riprenderlo da dove avevi lasciato?
              </p>
            </div>

            <div className="flex flex-col gap-3 mt-4">
              <button 
                onClick={handleResumeWorkout}
                className="w-full py-5 bg-brand border-2 border-line text-base font-black uppercase tracking-widest shadow-[4px_4px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-2 outline-none"
              >
                <Play size={20} strokeWidth={3} /> RIPRENDI
              </button>
              
              <button 
                onClick={handleDiscardWorkout}
                className="w-full py-4 bg-surface border-2 border-line text-main font-black uppercase tracking-widest shadow-[4px_4px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-2 hover:bg-[#ff331f] hover:text-white outline-none"
              >
                <Trash2 size={18} strokeWidth={2.5} /> ANNULLA SESSIONE
              </button>
            </div>

          </div>
        </div>
      )}
      
    </main>
  );
}