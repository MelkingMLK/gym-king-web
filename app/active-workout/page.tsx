"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Check, Trophy, X, Plus, MoreHorizontal, PlayCircle, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Fuse from "fuse.js";

const LOCAL_STORAGE_KEY = "gymking_active_workout";

// === 1. CLESSIDRA ROTANTE ===
const SpinningHourglass = ({ isActive, className = "w-8 h-8 md:w-10 md:h-10" }: { isActive: boolean, className?: string }) => {
  return (
    <div className={`relative ${className}`}>
      <style>{`
        @keyframes brutalSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(180deg); } }
        .animate-brutal-spin { animation: brutalSpin 1s cubic-bezier(0.8, 0, 0.2, 1) infinite; }
      `}</style>
      <svg viewBox="0 0 100 100" className={`w-full h-full fill-current ${isActive ? 'animate-brutal-spin' : ''}`}>
        <path d="M10 10 L90 10 L50 50 Z" className={isActive ? "opacity-100" : "opacity-30"} />
        <path d="M10 90 L90 90 L50 50 Z" className={isActive ? "opacity-30" : "opacity-100"} />
        <rect x="10" y="5" width="80" height="5" className="opacity-100" />
        <rect x="10" y="90" width="80" height="5" className="opacity-100" />
      </svg>
    </div>
  );
};

// === 2. CLESSIDRA A SABBIA ===
const SandHourglass = ({ progress, isActive, className = "w-32 h-32" }: { progress: number, isActive: boolean, className?: string }) => {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div className={`relative ${className}`}>
      <style>{`
        @keyframes sandFall { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 6; } }
        .animate-sand { animation: sandFall 0.3s linear infinite; }
      `}</style>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <clipPath id="top-clip"><rect x="0" y={50 - 40 * p} width="100" height={40 * p} /></clipPath>
          <clipPath id="bottom-clip"><rect x="0" y={90 - 40 * (1 - p)} width="100" height={40 * (1 - p)} /></clipPath>
        </defs>
        <path d="M10 10 L90 10 L50 50 Z" className="fill-current opacity-10" />
        <path d="M10 90 L90 90 L50 50 Z" className="fill-current opacity-10" />
        <path d="M10 10 L90 10 L50 50 Z" className="fill-current opacity-100 transition-all duration-1000 ease-linear" clipPath="url(#top-clip)" />
        <path d="M10 90 L90 90 L50 50 Z" className="fill-current opacity-100 transition-all duration-1000 ease-linear" clipPath="url(#bottom-clip)" />
        {isActive && p > 0 && p < 1 && (<line x1="50" y1="50" x2="50" y2={90 - 40 * (1 - p)} stroke="currentColor" strokeWidth="2" strokeDasharray="4 2" className="animate-sand" />)}
        <path d="M10 10 L90 10 L50 50 Z" className="stroke-current fill-none" strokeWidth="4" strokeLinejoin="miter" />
        <path d="M10 90 L90 90 L50 50 Z" className="stroke-current fill-none" strokeWidth="4" strokeLinejoin="miter" />
        <rect x="5" y="5" width="90" height="5" className="fill-current" />
        <rect x="5" y="90" width="90" height="5" className="fill-current" />
      </svg>
    </div>
  );
};

// === TIPI STRUTTURATI ===
type SetData = { 
  id: string; 
  reps: string; 
  weight: string; 
  completed: boolean; 
  workDurationSec?: number | null; 
  actualRestSec?: number | null;    
  wasteDurationSec?: number | null; 
  completedAt?: number; 
};

type ExerciseLog = { 
  id_scheda_esercizio?: number; 
  id_esercizio: number; 
  nome: string; 
  gif_url?: string; 
  recupero_sec: number; 
  target_serie: number; 
  target_reps: string; 
  unita_misura: string; 
  sets: SetData[]; 
};

type EsercizioBase = { id_esercizio: number; nome: string; gif_url?: string; };

type ActiveSet = { exIndex: number; setIndex: number; phase: 'prep' | 'work'; startPrepTime: number; startWorkTime: number | null; };
type RestingSet = { exIndex: number; setIndex: number; startTs: number; }; 

export default function WorkoutTracker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dayId = searchParams.get("day");
  const templateId = searchParams.get("template");

  const [isLoading, setIsLoading] = useState(true);
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);
  const [workoutName, setWorkoutName] = useState<string>("Allenamento Libero");
  
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTimeDisplay, setElapsedTimeDisplay] = useState(0);
  
  const [restTotalTime, setRestTotalTime] = useState<number | null>(null); 
  const [restEndTime, setRestEndTime] = useState<number | null>(null);
  const [extraStartTime, setExtraStartTime] = useState<number | null>(null);
  const [restTimeDisplay, setRestTimeDisplay] = useState<number | null>(null);
  const [isRestModalOpen, setIsRestModalOpen] = useState(false);

  const [activeSet, setActiveSet] = useState<ActiveSet | null>(null);
  const [restingSet, setRestingSet] = useState<RestingSet | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [soundSrc, setSoundSrc] = useState("sounds/gong.mp3");

  const [tuttiEsercizi, setTuttiEsercizi] = useState<EsercizioBase[]>([]);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [exerciseToReplaceIndex, setExerciseToReplaceIndex] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [previewExercise, setPreviewExercise] = useState<ExerciseLog | null>(null);

  const formattedDate = useMemo(() => {
    if (!startTime) return "";
    return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(startTime));
  }, [startTime]);

  // === NOTIFICHE NATIVE E AUDIO MAPPING ===
  const playGong = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.log("Riproduzione audio bloccata dal sistema operativo:", e));
    }
  };

  const scheduleNativeRestGong = (recuperoSec: number) => {
    // In produzione con Capacitor:
    // LocalNotifications.schedule({ notifications: [{ title: "Recupero Terminato!", body: "Torna a spingere Re!", id: 1, schedule: { at: new Date(Date.now() + recuperoSec * 1000) }, sound: soundSrc }] });
    console.log(`[Capacitor Bridge] Notifica programmata tra ${recuperoSec} secondi.`);
  };

  const cancelNativeRestGong = () => {
    // In produzione con Capacitor:
    // LocalNotifications.cancel({ notifications: [{ id: 1 }] });
    console.log(`[Capacitor Bridge] Notifica push nativa rimossa.`);
  };

  // === PAGE VISIBILITY API: PREVIENE IL CONGELAMENTO DEI TIMER IN BACKGROUND ===
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (startTime) setElapsedTimeDisplay(Math.floor((now - startTime) / 1000));

        if (restEndTime) {
          const remaining = Math.ceil((restEndTime - now) / 1000);
          if (remaining <= 0) {
            // Il recupero è scaduto mentre l'utente era fuori dall'app
            setRestEndTime(null);
            setRestTimeDisplay(null);
            setExtraStartTime(now);
            setIsRestModalOpen(false);
            playGong();
          } else {
            setRestTimeDisplay(remaining);
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [startTime, restEndTime]);

  // CARICAMENTO INIZIALE
  useEffect(() => {
    async function loadWorkout() {
      setIsLoading(true);
      setSoundSrc(localStorage.getItem('gymking_sound') || 'sounds/gong.mp3');

      const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed.dayId === dayId || !dayId) {
            setWorkoutName(parsed.workoutName); 
            setExercises(parsed.exercises); 
            setStartTime(parsed.startTime); 
            setRestEndTime(parsed.restEndTime); 
            setExtraStartTime(parsed.extraStartTime);
            setRestTotalTime(parsed.restTotalTime || null); 
            setActiveSet(parsed.activeSet || null);
            setRestingSet(parsed.restingSet || null);
            setIsLoading(false);
            const { data: catData } = await supabase.from('Esercizi').select('id_esercizio, nome, gif_url').order('nome');
            if (catData) setTuttiEsercizi(catData as EsercizioBase[]);
            return; 
          }
        } catch (e) { console.error(e); }
      }

      if (!dayId) { setIsLoading(false); return; }
      try {
        setStartTime(Date.now());
        const { data: dayData } = await supabase.from('Giorni_Template').select('nome_giorno').eq('id_giorno', dayId).single();
        if (dayData) setWorkoutName(dayData.nome_giorno);

        const { data: exData } = await supabase.from('Scheda_Esercizi').select('*, Esercizi(nome, gif_url)').eq('id_giorno', dayId).order('ordine');
        if (exData) {
          setExercises(exData.map((ex: any) => ({
            id_scheda_esercizio: ex.id_scheda_esercizio, 
            id_esercizio: ex.id_esercizio, 
            nome: ex.Esercizi?.nome || "Esercizio", 
            gif_url: ex.Esercizi?.gif_url,
            recupero_sec: ex.recupero_sec || 90, 
            unita_misura: ex.unita_misura || 'KG', 
            target_serie: parseInt(ex.serie) || 1, 
            target_reps: ex.ripetizioni,
            sets: Array.from({ length: parseInt(ex.serie) || 1 }).map((_, i) => ({
              id: `${ex.id_scheda_esercizio}-${i}`, 
              reps: ex.ripetizioni || "", 
              weight: "", 
              completed: false,
            }))
          })));
        }
        const { data: catData } = await supabase.from('Esercizi').select('id_esercizio, nome, gif_url').order('nome');
        if (catData) setTuttiEsercizi(catData as EsercizioBase[]);
      } catch (error) { console.error(error); } finally { setIsLoading(false); }
    }
    loadWorkout();
  }, [dayId]);

  // PERSISTENZA STATO LOCALE
  useEffect(() => {
    if (isLoading || !startTime) return;
    const stateToSave = { templateId, dayId, workoutName, exercises, startTime, restEndTime, extraStartTime, restTotalTime, activeSet, restingSet };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
  }, [exercises, restEndTime, extraStartTime, startTime, workoutName, dayId, templateId, isLoading, restTotalTime, activeSet, restingSet]);

  // INTERVALLO DI TICK DEI TIMER
  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setElapsedTimeDisplay(Math.floor((now - startTime) / 1000));

      if (restEndTime) {
        const remaining = Math.ceil((restEndTime - now) / 1000);
        if (remaining <= 0) {
          setRestEndTime(null); 
          setRestTimeDisplay(null); 
          setExtraStartTime(now); 
          setIsRestModalOpen(false); 
          playGong();
        } else {
          setRestTimeDisplay(remaining);
        }
      }

      setActiveSet(prev => {
        if (prev && prev.phase === 'prep') {
          if (now - prev.startPrepTime >= 15000) { 
            return { ...prev, phase: 'work', startWorkTime: now };
          }
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, restEndTime]);

  const commitRestPhase = () => {
    cancelNativeRestGong();
    if (restingSet) {
      setExercises(prev => {
        const next = [...prev];
        const targetEx = next[restingSet.exIndex];
        if (!targetEx) return next;
        
        const newSets = [...targetEx.sets];
        const targetSet = { ...newSets[restingSet.setIndex] };

        const now = Date.now();
        const totalRestPassedSec = Math.floor((now - restingSet.startTs) / 1000);
        const targetRestSec = targetEx.recupero_sec;

        targetSet.actualRestSec = Math.min(totalRestPassedSec, targetRestSec);
        targetSet.wasteDurationSec = Math.max(0, totalRestPassedSec - targetRestSec);

        newSets[restingSet.setIndex] = targetSet;
        next[restingSet.exIndex] = { ...targetEx, sets: newSets };
        return next;
      });
      setRestingSet(null);
    }
    
    setRestTotalTime(null);
    setRestEndTime(null);
    setExtraStartTime(null);
    setIsRestModalOpen(false);
  };

  const updateSet = (exIndex: number, setIndex: number, field: 'reps' | 'weight', value: string) => {
    setExercises(prev => {
      const next = [...prev];
      const newSets = [...next[exIndex].sets];
      newSets[setIndex] = { ...newSets[setIndex], [field]: value };
      next[exIndex] = { ...next[exIndex], sets: newSets };
      return next;
    });
  };

  const startPrepSet = (exIndex: number, setIndex: number) => {
    commitRestPhase();
    setActiveSet({ exIndex, setIndex, phase: 'prep', startPrepTime: Date.now(), startWorkTime: null });
  };

  const toggleSetCompletion = (exIndex: number, setIndex: number) => {
    setExercises(prev => {
      const next = [...prev];
      const newSets = [...next[exIndex].sets];
      const targetSet = { ...newSets[setIndex] };
      
      targetSet.completed = !targetSet.completed;
      
      if (targetSet.completed) {
        targetSet.completedAt = Date.now();

        if (activeSet && activeSet.exIndex === exIndex && activeSet.setIndex === setIndex) {
          const workEnd = Date.now();
          const workStart = activeSet.startWorkTime || workEnd; 
          targetSet.workDurationSec = Math.floor((workEnd - workStart) / 1000);
          setActiveSet(null);
        } else {
          targetSet.workDurationSec = targetSet.workDurationSec || null; 
        }

        targetSet.actualRestSec = null;
        targetSet.wasteDurationSec = null;

        const recSec = next[exIndex].recupero_sec;
        setRestTotalTime(recSec);
        setRestEndTime(Date.now() + recSec * 1000);
        setExtraStartTime(null);
        setRestingSet({ exIndex, setIndex, startTs: Date.now() });

        scheduleNativeRestGong(recSec);

        if (audioRef.current) {
          audioRef.current.volume = 0;
          audioRef.current.play().then(() => {
            audioRef.current!.pause(); audioRef.current!.currentTime = 0; audioRef.current!.volume = 1;
          }).catch(() => {});
        }
      } else {
        targetSet.completedAt = undefined;
        cancelNativeRestGong();
        if (restingSet?.exIndex === exIndex && restingSet?.setIndex === setIndex) {
          setRestingSet(null);
          setRestTotalTime(null); 
          setRestEndTime(null); 
          setExtraStartTime(null);
        }
      }

      newSets[setIndex] = targetSet;
      next[exIndex] = { ...next[exIndex], sets: newSets };
      return next;
    });
  };
  
  const handleReplace = (nuovoEs: EsercizioBase) => {
    if (exerciseToReplaceIndex === null) return;
    setExercises(prev => {
      const next = [...prev];
      next[exerciseToReplaceIndex] = { ...next[exerciseToReplaceIndex], id_esercizio: nuovoEs.id_esercizio, nome: nuovoEs.nome, gif_url: nuovoEs.gif_url };
      return next;
    });
    setIsReplaceModalOpen(false);
    setSearchText("");
  };

  const clearAndRedirect = () => { localStorage.removeItem(LOCAL_STORAGE_KEY); router.push("/start-workout"); };
  
  const finishWorkout = () => {
    if (confirm("Terminare l'allenamento e generare i grafici?")) {
      commitRestPhase();
      const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        parsed.endTime = Date.now();
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
      }
      router.push("/workout-summary");
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const hourglassProgress = restTimeDisplay !== null && restTotalTime ? restTimeDisplay / restTotalTime : 0;

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-base text-main">Loading...</div>;

  return (
    <div className="flex flex-col min-h-screen bg-base relative overflow-x-hidden pb-32">
      <audio ref={audioRef} src={"/" + soundSrc} preload="auto" />
      <div className="sticky top-0 z-40 bg-surface border-b-4 border-line p-4 flex justify-between items-center shadow-[0px_4px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center gap-2">
          <button onClick={() => confirm("Annullare?") && clearAndRedirect()} className="p-1"><ChevronLeft size={32} strokeWidth={3}/></button>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-brand uppercase tracking-widest animate-pulse">Live</span>
            <h1 className="font-heading text-lg md:text-xl font-black uppercase line-clamp-1 max-w-[200px]">
              {workoutName} <span className="text-xs font-bold text-muted lowercase">del {formattedDate}</span>
            </h1>
          </div>
        </div>
        <div className="bg-base border-2 border-line px-3 py-1 shadow-[2px_2px_0px_#000000] shrink-0">
          <span className="font-mono text-xl font-black">{formatTime(elapsedTimeDisplay)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-8 p-4 mt-4">
        {exercises.map((ex, exIndex) => (
          <div key={ex.id_scheda_esercizio || exIndex} className="bg-surface border-4 border-line shadow-[8px_8px_0px_#000000] flex flex-col">
            <div className="p-4 border-b-4 border-line bg-base flex justify-between items-center">
              <h2 className="font-heading text-xl font-black uppercase leading-tight line-clamp-1">{exIndex + 1}. {ex.nome}</h2>
              <div className="flex gap-2">
                <button onClick={() => setPreviewExercise(ex)} className="w-9 h-9 bg-brand border-2 border-line flex items-center justify-center font-black shadow-[2px_2px_0px_#000000]">?</button>
                <button onClick={() => { setExerciseToReplaceIndex(exIndex); setIsReplaceModalOpen(true); }} className="w-9 h-9 bg-surface border-2 border-line flex items-center justify-center shadow-[2px_2px_0px_#000000]"><MoreHorizontal size={20}/></button>
              </div>
            </div>
            
            <div className="grid grid-cols-[3.5rem_1fr_1fr_3.5rem] gap-2 p-3 border-b-2 border-line bg-surface/50 text-[10px] font-black uppercase tracking-widest text-muted text-center">
              <div>Set</div><div>{ex.unita_misura}</div><div>Reps</div><div>Fatto</div>
            </div>

            <div className="flex flex-col">
              {ex.sets.map((set, setIndex) => {
                const isThisSetActive = activeSet?.exIndex === exIndex && activeSet?.setIndex === setIndex;
                
                return (
                  <div key={set.id} className="relative w-full border-b-2 border-line last:border-b-0 bg-base p-3 grid grid-cols-[3.5rem_1fr_1fr_3.5rem] gap-3 items-center">
                    <div className="flex items-center justify-center">
                      {!set.completed && !isThisSetActive && (
                        <button 
                          onClick={() => { if (restTimeDisplay !== null) return; startPrepSet(exIndex, setIndex); }} 
                          disabled={restTimeDisplay !== null}
                          className={`flex items-center gap-1 outline-none ${restTimeDisplay !== null ? 'cursor-not-allowed' : 'group'}`}
                        >
                          <span className={`font-heading text-lg font-black transition-colors ${restTimeDisplay !== null ? 'text-muted/40' : 'text-muted group-hover:text-main'}`}>{setIndex + 1}</span>
                          {restTimeDisplay === null && <PlayCircle size={16} className="text-brand shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />}
                        </button>
                      )}
                      {!set.completed && isThisSetActive && (
                        <div className="flex items-center gap-1">
                          <span className="font-heading text-lg font-black text-main">{setIndex + 1}</span>
                          <div className={`w-3 h-3 rounded-full animate-pulse shadow-[1px_1px_0px_#000000] ${activeSet.phase === 'prep' ? 'bg-[#ffde59]' : 'bg-[#ff331f]'}`} />
                        </div>
                      )}
                      {set.completed && (
                        <span className="font-heading text-lg font-black text-muted/40 line-through decoration-brand decoration-2">{setIndex + 1}</span>
                      )}
                    </div>
                    <input type="number" value={set.weight} onChange={(e) => updateSet(exIndex, setIndex, 'weight', e.target.value)} className={`w-full bg-surface border-2 border-line p-2 text-center font-bold outline-none focus:shadow-[2px_2px_0px_#000000] ${set.completed ? 'text-muted' : 'text-main'}`} />
                    <input type="number" value={set.reps} onChange={(e) => updateSet(exIndex, setIndex, 'reps', e.target.value)} className={`w-full bg-surface border-2 border-line p-2 text-center font-bold outline-none focus:shadow-[2px_2px_0px_#000000] ${set.completed ? 'text-muted' : 'text-main'}`} />
                    <div className="flex justify-center">
                      <button onClick={() => toggleSetCompletion(exIndex, setIndex)} className={`w-10 h-10 border-2 border-line flex items-center justify-center shadow-[2px_2px_0px_#000000] transition-all ${set.completed ? 'bg-brand shadow-none translate-x-[2px] translate-y-[2px]' : 'bg-surface'}`}>
                        <Check size={20} strokeWidth={4} className={set.completed ? "text-base" : "text-line/20"} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => { 
              setExercises(prev => {
                const next = [...prev];
                const nxEx = { ...next[exIndex] };
                nxEx.sets = [...nxEx.sets, { id: Date.now().toString(), reps: nxEx.target_reps, weight: "", completed: false }];
                next[exIndex] = nxEx;
                return next;
              });
            }} className="p-3 bg-surface border-t-2 border-line text-[10px] font-black uppercase tracking-widest text-muted flex justify-center items-center gap-2"><Plus size={14}/> Aggiungi Serie</button>
          </div>
        ))}
      </div>

      <div className="w-full px-4 mt-12 mb-12"><button onClick={finishWorkout} className="w-full py-6 bg-[#ff331f] border-4 border-line text-white font-black uppercase tracking-widest text-2xl shadow-[6px_6px_0px_#000000] flex items-center justify-center gap-3"><Trophy size={28} /> Termina</button></div>

      {restTimeDisplay !== null && (
        <div onClick={() => setIsRestModalOpen(true)} className="fixed bottom-0 left-0 right-0 z-50 border-t-4 border-line p-4 animate-in slide-in-from-bottom-full duration-300 bg-brand cursor-pointer active:scale-[0.99] transition-transform">
          <div className="flex flex-col w-full max-w-2xl mx-auto gap-4 pointer-events-none">
            <div className="flex justify-between items-center w-full">
              <div className="flex items-center gap-4 text-base">
                <SpinningHourglass isActive={true} className="w-8 h-8 md:w-10 md:h-10 text-base" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest leading-none">Recupero</span>
                  <span className="font-heading text-4xl font-black tabular-nums leading-none mt-1">{formatTime(restTimeDisplay)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isRestModalOpen && restTimeDisplay !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-base border-4 border-line shadow-[12px_12px_0px_#000000] p-8 flex flex-col items-center text-center gap-8 relative animate-in zoom-in-95">
            <button onClick={() => setIsRestModalOpen(false)} className="absolute top-4 right-4 text-muted hover:text-main transition-colors"><ChevronDown size={32} strokeWidth={3} /></button>
            <div className="flex flex-col items-center gap-2 mt-4">
              <span className="text-brand font-black uppercase tracking-widest text-sm">Recupero</span>
              <span className="font-heading text-7xl font-black tabular-nums text-main leading-none">{formatTime(restTimeDisplay)}</span>
            </div>
            <div className="my-2"><SandHourglass progress={hourglassProgress} isActive={true} className="w-32 h-32 text-brand" /></div>
            <div className="w-full grid grid-cols-2 gap-4">
              <button onClick={() => { setRestEndTime(prev => prev ? prev - 30000 : null); setRestTotalTime(prev => prev ? Math.max(1, prev - 30) : null); }} className="py-4 bg-surface border-2 border-line text-main font-black text-xl shadow-[4px_4px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all">-30s</button>
              <button onClick={() => { setRestEndTime(prev => prev ? prev + 30000 : null); setRestTotalTime(prev => prev ? prev + 30 : null); }} className="py-4 bg-surface border-2 border-line text-main font-black text-xl shadow-[4px_4px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all">+30s</button>
            </div>
            <button onClick={() => { commitRestPhase(); }} className="w-full py-5 bg-brand border-2 border-line text-base font-black uppercase tracking-widest text-xl shadow-[4px_4px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all">SKIP</button>
          </div>
        </div>
      )}

      {previewExercise && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6" onClick={() => setPreviewExercise(null)}>
          <div className="relative w-full max-w-sm bg-base border-4 border-line shadow-[12px_12px_0px_#000000] p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewExercise(null)} className="absolute -top-5 -right-5 w-12 h-12 bg-[#ff331f] border-4 border-line flex items-center justify-center text-white"><X size={28} strokeWidth={4}/></button>
            <h3 className="font-heading text-2xl font-black uppercase border-b-2 border-line pb-2">{previewExercise.nome}</h3>
            {previewExercise.gif_url ? <img src={previewExercise.gif_url} className="w-full h-auto border-2 border-line bg-white" /> : <div className="h-40 bg-surface flex items-center justify-center uppercase font-black">No Img</div>}
          </div>
        </div>
      )}

      {isReplaceModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-base border-4 border-line shadow-[12px_12px_0px_#000000] flex flex-col h-[80vh]">
            <div className="p-4 border-b-4 border-line bg-surface flex justify-between items-center">
              <h2 className="font-heading text-xl font-black uppercase">Sostituisci</h2>
              <button onClick={() => setIsReplaceModalOpen(false)} className="w-10 h-10 bg-[#ff331f] border-2 border-line flex items-center justify-center text-white"><X size={20}/></button>
            </div>
            <div className="p-4 border-b-2 border-line bg-base"><input autoFocus type="text" placeholder="Cerca nuovo esercizio..." value={searchText} onChange={e => setSearchText(e.target.value)} className="w-full p-4 bg-surface border-2 border-line font-bold uppercase outline-none" /></div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {searchText.trim() !== "" ? (
                new Fuse(tuttiEsercizi, { keys: ['nome'], threshold: 0.35 }).search(searchText).map(r => r.item).map(es => (
                  <button key={es.id_esercizio} onClick={() => handleReplace(es)} className="w-full p-4 bg-surface border-2 border-line text-left font-black uppercase hover:bg-brand transition-colors flex justify-between items-center">{es.nome} <Plus size={20}/></button>
                ))
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}