"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, User, Globe, Calendar, Clock, Dumbbell, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Spinner from "@/components/Spinner";
// === SPINNER ===
const CleanSpinner = ({ size = 24 }: { size?: number }) => {
  return (
    <div style={{ width: size, height: size, position: 'relative', color: "currentColor", margin: "0 auto" }}>
      <style>{`@keyframes cleanSpinnerRotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } .spinner-ring { box-sizing: border-box; display: block; position: absolute; width: 100%; height: 100%; border: ${size * 0.15}px solid currentColor; border-radius: 50%; animation: cleanSpinnerRotate 1s cubic-bezier(0.5, 0, 0.5, 1) infinite; border-color: currentColor transparent transparent transparent; } .spinner-ring-track { box-sizing: border-box; display: block; position: absolute; width: 100%; height: 100%; border: ${size * 0.15}px solid currentColor; border-radius: 50%; opacity: 0.15; }`}</style>
      <div className="spinner-ring-track"></div>
      <div className="spinner-ring"></div>
    </div>
  );
};

type SessioneStorico = {
  id_sessione: string;
  nome_allenamento: string;
  inizio_ts: string;
  durata_totale_sec: number;
};

export default function StatisticsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"personal" | "public">("personal");
  const [storico, setStorico] = useState<SessioneStorico[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (activeTab !== "personal") return;

    const fetchStorico = async () => {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('Storico_Allenamenti')
          .select('id_sessione, nome_allenamento, inizio_ts, durata_totale_sec')
          .eq('user_id', user.id)
          .order('inizio_ts', { ascending: false })
          .limit(30);

        if (error) throw error;
        if (data) setStorico(data);
      } catch (error) {
        console.error("Errore nel caricamento dello storico:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStorico();
  }, [activeTab]);

  const formatData = (isoString: string) => {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  };

  const formatOra = (isoString: string) => {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(d);
  };

  const formatDurata = (secondi: number) => {
    const h = Math.floor(secondi / 3600);
    const m = Math.floor((secondi % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <main className="flex min-h-screen flex-col items-center pt-12 px-4 pb-20 relative overflow-x-hidden bg-base transition-colors duration-300">
      
      <div className="w-full max-w-2xl flex justify-between items-center mb-8 relative z-10">
        <Link href="/">
          <div className="w-12 h-12 bg-surface flex items-center justify-center border-2 border-line shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none">
            <ChevronLeft className="text-main" size={24} strokeWidth={3} />
          </div>
        </Link>
        <h1 className="font-heading text-3xl font-black uppercase text-main tracking-tighter absolute left-1/2 -translate-x-1/2">
          Statistiche
        </h1>
        <div className="w-12 h-12" />
      </div>

      <div className="w-full max-w-2xl flex flex-col gap-6 relative z-10">
        
        <div className="flex border-4 border-line bg-surface shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#804CD9]">
          <button 
            onClick={() => setActiveTab("personal")}
            className={`flex-1 py-4 flex items-center justify-center gap-2 font-black uppercase tracking-widest text-sm transition-all outline-none ${activeTab === "personal" ? 'bg-main text-base' : 'text-main hover:bg-base/50'}`}
          >
            {/* L'icona dell'omino (sagoma) che volevi */}
            <User size={18} strokeWidth={2.5} /> Personal
          </button>
          <button 
            onClick={() => setActiveTab("public")}
            className={`flex-1 py-4 flex items-center justify-center gap-2 font-black uppercase tracking-widest text-sm transition-all outline-none ${activeTab === "public" ? 'bg-brand text-base' : 'text-main hover:bg-base/50'}`}
          >
            <Globe size={18} strokeWidth={2.5} /> Public
          </button>
        </div>

        {activeTab === "personal" && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
            
            <div className="bg-brand border-4 border-line p-4 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9]">
              <h2 className="font-heading text-2xl font-black uppercase text-base tracking-tighter flex items-center gap-2">
                <Dumbbell size={24} strokeWidth={3} /> Storico Allenamenti
              </h2>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-20 text-main">
                <Spinner size={48} />
              </div>
            ) : storico.length === 0 ? (
              <div className="text-center p-10 bg-surface border-4 border-dashed border-line">
                <p className="text-muted font-black uppercase tracking-widest text-sm">Nessun allenamento registrato.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {storico.map((sessione) => (
                  <button 
                    key={sessione.id_sessione}
                    onClick={() => router.push(`/session/${sessione.id_sessione}`)}
                    className="w-full bg-surface border-4 border-line p-4 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#000000] dark:hover:shadow-[2px_2px_0px_#804CD9] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-between group outline-none"
                  >
                    <div className="flex flex-col text-left gap-2">
                      <span className="font-heading text-xl font-black uppercase text-main leading-tight truncate">
                        {sessione.nome_allenamento}
                      </span>
                      
                      <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} className="text-brand" strokeWidth={2.5} />
                          {formatData(sessione.inizio_ts)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock size={14} className="text-brand" strokeWidth={2.5} />
                          {formatDurata(sessione.durata_totale_sec)} ({formatOra(sessione.inizio_ts)})
                        </div>
                      </div>
                    </div>
                    
                    <ChevronRight size={24} strokeWidth={3} className="text-line/30 group-hover:text-brand transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "public" && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center p-10 bg-surface border-4 border-dashed border-line">
              <Globe size={48} className="text-muted mx-auto mb-4" strokeWidth={2} />
              <h2 className="font-heading text-2xl font-black uppercase text-main tracking-tighter mb-2">Feed Globale</h2>
              <p className="text-muted font-bold uppercase tracking-widest text-xs">La classifica dei Re arriverà presto.</p>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}