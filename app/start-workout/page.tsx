"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Play, Dumbbell, CheckCircle2, X, GripVertical, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Spinner from "@/components/Spinner";
import { initAudioContext, loadAudioFile, unlockAudio } from "@/utils/audioEngine";

type Giorno = { id_giorno: number; nome_giorno: string; ordine: number; id_template: string; };
type Template = { id_template: string; nome_template: string; id_categoria: string | null; Giorni_Template: Giorno[]; };

// ==========================================
// COMPONENTE CARTA TEMPLATE (Con Drag & Drop Vettoriale)
// ==========================================
const TemplateCard = ({ 
  template, 
  giorniCompletati, 
  handleDayClick 
}: { 
  template: Template; 
  giorniCompletati: number[]; 
  handleDayClick: (tId: string, dId: number, nome: string) => void; 
}) => {
  
  const [doneDays, setDoneDays] = useState<Giorno[]>([]);
  const [todoDays, setTodoDays] = useState<Giorno[]>([]);

  // === REFS PER IL DRAG & DROP VETTORIALE ===
  const dragItem = useRef<number | null>(null);
  const listRef = useRef(todoDays);

  useEffect(() => {
    listRef.current = todoDays;
  }, [todoDays]);

  useEffect(() => {
    const ordinati = [...(template.Giorni_Template || [])].sort((a, b) => a.ordine - b.ordine);
    setDoneDays(ordinati.filter(g => giorniCompletati.includes(g.id_giorno)));
    setTodoDays(ordinati.filter(g => !giorniCompletati.includes(g.id_giorno)));
  }, [template, giorniCompletati]);

  if (template.Giorni_Template.length === 0) return null;

  // Salvataggio nel database a fine trascinamento
  const commitReorder = async () => {
    if (dragItem.current === null) return;
    dragItem.current = null;

    const currentList = listRef.current;
    const baseOrdine = doneDays.length;
    
    const updates = currentList.map((g, idx) => ({
      id_giorno: g.id_giorno,
      id_template: template.id_template,
      nome_giorno: g.nome_giorno,
      ordine: baseOrdine + idx
    }));

    await supabase.from('Giorni_Template').upsert(updates);
  };

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading text-5xl md:text-6xl font-black text-main uppercase tracking-tighter leading-none mb-4">
        {template.nome_template}
      </h2>
      
      <div className="flex flex-col gap-4">
        
        {/* === GIORNI COMPLETATI === */}
        {doneDays.map((giorno) => (
          <div key={`done-${giorno.id_giorno}`} className="w-full border-2 border-line p-5 flex items-center justify-between bg-surface opacity-40 grayscale select-none transition-all">
            <span className="font-heading text-2xl font-black uppercase tracking-tight text-main line-through decoration-brand decoration-4">
              {giorno.nome_giorno}
            </span>
            <CheckCircle2 size={32} strokeWidth={3} className="text-brand shrink-0" />
          </div>
        ))}

        {/* === GIORNI DA FARE === */}
        {todoDays.map((giorno, index) => {
          const isNext = index === 0; 
          return (
            <div 
  key={`todo-${giorno.id_giorno}`}
  data-drag-index={index}
  onDragOver={(e) => e.preventDefault()}
  className={`group w-full border-2 p-6 flex items-center gap-4 transition-transform duration-300 outline-none select-none
    ${isNext 
      ? 'bg-brand border-line shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#804CD9] relative z-10 animate-smooth-scale' 
      : 'bg-surface border-line shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] hover:-translate-y-1 hover:shadow-[6px_6px_0px_#000000] dark:hover:shadow-[6px_6px_0px_#804CD9]'
    }
  `}
>
              
              {/* MANIGLIA DRAG & DROP ISOLATA VETTORIALE */}
              <div 
                onTouchStart={(e) => { e.stopPropagation(); dragItem.current = index; }}
                onTouchMove={(e) => {
                  if (dragItem.current === null) return;
                  const touch = e.touches[0];
                  const elementTarget = document.elementFromPoint(touch.clientX, touch.clientY);
                  const rowContainer = elementTarget?.closest("[data-drag-index]");
                  if (rowContainer) {
                    const hoverIndex = parseInt(rowContainer.getAttribute("data-drag-index") || "");
                    if (!isNaN(hoverIndex) && hoverIndex !== dragItem.current) {
                      setTodoDays(prev => {
                        const newTodo = [...prev];
                        const dragged = newTodo[dragItem.current!];
                        newTodo.splice(dragItem.current!, 1);
                        newTodo.splice(hoverIndex, 0, dragged);
                        dragItem.current = hoverIndex;
                        return newTodo;
                      });
                    }
                  }
                }}
                onTouchEnd={(e) => { e.stopPropagation(); commitReorder(); }}
                className="shrink-0 text-main/50 cursor-grab active:cursor-grabbing hover:text-main transition-colors touch-none p-2 -ml-2"
              >
                <GripVertical size={28} strokeWidth={2.5} />
              </div>

              <button 
                onClick={() => handleDayClick(template.id_template, giorno.id_giorno, giorno.nome_giorno)}
                className="flex-1 flex items-center justify-between text-left outline-none"
              >
                <span className={`font-heading text-3xl font-black uppercase tracking-tight ${isNext ? 'text-base' : 'text-main'}`}>
                  {giorno.nome_giorno}
                </span>
                
                <div className={`w-14 h-14 flex items-center justify-center border-2 border-line shrink-0 shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#804CD9] transition-transform ${isNext ? 'bg-main scale-110' : 'bg-base group-hover:scale-110'}`}>
                  <Play size={24} strokeWidth={3} className="text-brand ml-1" />
                </div>
              </button>
            </div>
          );
        })}

        {/* FEEDBACK COMPLETAMENTO SETTIMANA */}
        {todoDays.length === 0 && doneDays.length > 0 && (
          <div className="w-full p-6 bg-surface border-4 border-line flex flex-col items-center justify-center gap-4 shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#804CD9] animate-in zoom-in">
            <Trophy size={48} className="text-brand" strokeWidth={2} />
            <span className="font-heading text-2xl font-black uppercase tracking-widest text-main text-center">Settimana<br/>Dominata</span>
            <span className="text-xs font-bold text-muted uppercase tracking-widest text-center mt-2">In attesa del reset di lunedì.</span>
          </div>
        )}

      </div>
    </div>
  );
};

// ==========================================
// PAGINA PRINCIPALE
// ==========================================
export default function StartWorkoutPage() {
  const router = useRouter();
  const [templateCorrente, setTemplateCorrente] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [giorniCompletati, setGiorniCompletati] = useState<number[]>([]);

  const [previewDay, setPreviewDay] = useState<{ templateId: string, dayId: number, nomeGiorno: string } | null>(null);
  const [previewExercises, setPreviewExercises] = useState<any[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  const [hasSavedWorkout, setHasSavedWorkout] = useState(false);

  const getMostRecentMondayISO = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - (day === 0 ? 6 : day - 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString();
  };

  useEffect(() => {
    const savedSession = localStorage.getItem("gymking_active_workout"); // <-- FIX: Chiave corretta
    if (savedSession) {
      setHasSavedWorkout(true);
    }

    async function fetchDashboardData() {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: tData } = await supabase
          .from('Template_Schede')
          .select('*, Giorni_Template(*)')
          .eq('is_favorite', true)
          .single();
          
        if (tData) {
          setTemplateCorrente(tData as Template);
          const lastMondayISO = getMostRecentMondayISO();

          const { data: storico } = await supabase
            .from('Storico_Allenamenti')
            .select('id_giorno')
            .eq('user_id', user.id)
            .eq('id_template', tData.id_template)
            .not('id_giorno', 'is', null)
            .gte('inizio_ts', lastMondayISO);

          if (storico) {
            const completati = [...new Set(storico.map(s => s.id_giorno))];
            setGiorniCompletati(completati as number[]);
          }
        }
      } catch (error) {
        console.error("Errore recupero dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      router.push(`/active-workout?template=${previewDay?.templateId}&day=${previewDay?.dayId}`);
      setCountdown(null);
      setPreviewDay(null);
      return;
    }

    const timer = setInterval(() => setCountdown((prev) => prev! - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown, previewDay, router]);

  const handleDayClick = async (templateId: string, dayId: number, nomeGiorno: string) => {
    setPreviewDay({ templateId, dayId, nomeGiorno });
    setIsLoadingPreview(true);
    try {
      const { data } = await supabase
        .from('Scheda_Esercizi')
        .select('*, Esercizi(nome)')
        .eq('id_giorno', dayId)
        .order('ordine');
      if (data) setPreviewExercises(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingPreview(false);
    }
  };

const startFreeWorkout = () => {
    unlockAudio(); 
    const preferredSound = localStorage.getItem('gymking_sound') || 'sounds/gong.mp3';
    loadAudioFile(preferredSound.startsWith('/') ? preferredSound : `/${preferredSound}`);
    localStorage.removeItem("gymking_active_workout"); // <-- FIX: Chiave corretta
    router.push(`/active-workout`);
  };

  const handleStartTemplateWorkout = () => {
    unlockAudio(); 
    const preferredSound = localStorage.getItem('gymking_sound') || 'sounds/gong.mp3';
    loadAudioFile(preferredSound.startsWith('/') ? preferredSound : `/${preferredSound}`);
    localStorage.removeItem("gymking_active_workout"); // <-- FIX: Chiave corretta
    setCountdown(5);
  };

  const handleResumeWorkout = () => {
    unlockAudio(); 
    const preferredSound = localStorage.getItem('gymking_sound') || 'sounds/gong.mp3';
    loadAudioFile(preferredSound.startsWith('/') ? preferredSound : `/${preferredSound}`);
    router.push("/active-workout?resume=true"); // <-- FIX: Aggiunto resume=true
  };

  return (
    <main className="flex min-h-screen flex-col items-center pt-12 px-4 pb-24 relative overflow-x-hidden bg-base transition-colors duration-300">
      
      <style>{`
        @keyframes smoothScale {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        .animate-smooth-scale {
          animation: smoothScale 2.5s ease-in-out infinite;
        }
      `}</style>

      <div className="w-full max-w-2xl flex justify-between items-center mb-10 relative z-10">
        <Link href="/">
          <div className="w-12 h-12 bg-surface flex items-center justify-center border-2 border-line shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none">
            <ChevronLeft className="text-main" size={24} strokeWidth={3} />
          </div>
        </Link>
      </div>

      <div className="w-full max-w-2xl flex flex-col gap-14 relative z-10">
        
        {hasSavedWorkout && (
          <div className="border-4 border-brand bg-brand/10 p-5 shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#804CD9] flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-brand"></span>
              </span>
              <h2 className="text-xl font-black uppercase font-heading text-main">
                Allenamento Sospeso
              </h2>
            </div>
            <p className="text-sm font-bold text-muted">
              L'applicazione è stata chiusa in precedenza. Riprendi da dove hai lasciato senza perdere i dati.
            </p>
            <button
              onClick={handleResumeWorkout}
              className="mt-2 w-full border-2 border-line bg-main text-base p-4 font-black uppercase tracking-widest shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all"
            >
              Riprendi Sessione
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center mt-20"><Spinner size={64} /></div>
        ) : !templateCorrente ? (
          <div className="text-center mt-8 p-10 bg-surface border-4 border-line border-dashed">
            <p className="text-main font-black uppercase tracking-widest text-lg mb-2">Nessun allenamento attivo.</p>
            <p className="text-muted font-bold text-sm uppercase tracking-widest mb-6">Assicurati di aver impostato una scheda come "Preferita" (Stella) in Create Template.</p>
            <Link href="/create-template" className="text-base bg-brand border-2 border-line shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] px-6 py-4 font-black uppercase tracking-widest inline-block active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all">
              Gestisci Schede
            </Link>
          </div>
        ) : (
          <TemplateCard 
            template={templateCorrente} 
            giorniCompletati={giorniCompletati} 
            handleDayClick={handleDayClick} 
          />
        )}

        {!isLoading && (
          <div className="mt-4 border-t-2 border-line pt-8">
            <button 
              onClick={startFreeWorkout}
              className="w-full py-5 bg-transparent border-2 border-dashed border-muted text-muted flex items-center justify-center gap-3 transition-colors hover:bg-surface hover:border-main hover:text-main"
            >
              <Dumbbell size={24} strokeWidth={2.5} />
              <span className="font-black uppercase tracking-widest text-sm">Allenamento (Libero)</span>
            </button>
          </div>
        )}

      </div>

      {/* MODALE PREVIEW */}
      {previewDay && (
        <div className="fixed inset-0 bg-base z-[100] flex flex-col animate-in slide-in-from-bottom-full duration-300">
          
          {countdown !== null ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-brand transition-colors duration-500">
               <h2 className="font-heading text-[12rem] font-black text-base leading-none animate-in zoom-in duration-300">
                 {countdown}
               </h2>
               <p className="font-black uppercase tracking-widest text-base mt-4 animate-pulse text-2xl">
                 Preparati...
               </p>
            </div>
          ) : (
            
            <div className="flex-1 flex flex-col p-6 overflow-hidden h-full">
              
              <div className="flex justify-between items-center mb-8 shrink-0 pt-4">
                <h2 className="font-heading text-4xl font-black uppercase text-main tracking-tighter line-clamp-2">
                  {previewDay.nomeGiorno}
                </h2>
                <button 
                  onClick={() => { setPreviewDay(null); setPreviewExercises([]); }} 
                  className="w-12 h-12 shrink-0 bg-surface flex items-center justify-center border-2 border-line shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all ml-4"
                >
                  <X size={24} strokeWidth={3} className="text-main"/>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col gap-4 pb-6">
                 {isLoadingPreview ? (
                   <div className="flex justify-center mt-20"><Spinner size={56} /></div>
                 ) : previewExercises.length === 0 ? (
                   <div className="text-center mt-10 p-6 border-2 border-dashed border-line">
                     <p className="text-muted font-bold uppercase tracking-widest text-sm">Giorno di rest o scheda vuota.</p>
                   </div>
                 ) : (
                   previewExercises.map((es) => (
                     <div key={es.id_scheda_esercizio} className="bg-surface border-2 border-line p-5 flex items-center justify-between shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9]">
                       <span className="font-heading text-xl font-black uppercase text-main truncate mr-4">
                         {es.Esercizi?.nome || "Esercizio"}
                       </span>
                       <span className="font-black text-brand uppercase tracking-widest shrink-0 text-lg">
                         {es.serie} <span className="text-muted mx-1">x</span> {es.ripetizioni}
                       </span>
                     </div>
                   ))
                 )}
              </div>

              <div className="pt-4 shrink-0 pb-6">
                 <button 
                   onClick={handleStartTemplateWorkout} 
                   disabled={isLoadingPreview || previewExercises.length === 0} 
                   className="w-full py-6 bg-brand border-2 border-line text-base font-black uppercase tracking-widest text-3xl shadow-[8px_8px_0px_#000000] dark:shadow-[8px_8px_0px_#804CD9] hover:-translate-y-1 hover:shadow-[10px_10px_0px_#000000] dark:hover:shadow-[10px_10px_0px_#804CD9] active:translate-x-[8px] active:translate-y-[8px] active:shadow-none transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[8px_8px_0px_#000000] disabled:active:translate-x-0 disabled:active:translate-y-0"
                 >
                   START
                 </button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}