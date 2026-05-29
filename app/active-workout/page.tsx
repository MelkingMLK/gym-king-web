"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Check, Trophy, Plus, MoreHorizontal, PlayCircle, ChevronDown, CheckCircle, Trash2, X, AlertCircle, History, Dumbbell, Search, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Fuse from "fuse.js";
import { playSound } from "@/utils/audioEngine";

const LOCAL_STORAGE_KEY = "gymking_active_workout";

// === COMPONENTI DI UTILITÀ VISIVA ===
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

const CleanSpinner = ({ size = 24 }: { size?: number }) => {
  const strokeWidth = Math.max(2, Math.round(size * 0.1));
  return (
    <div className="relative flex items-center justify-center animate-spin" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full border-main opacity-10" style={{ borderWidth: strokeWidth }} />
      <div className="absolute inset-0 rounded-full border-transparent border-t-brand" style={{ borderWidth: strokeWidth }} />
    </div>
  );
};

// === TIPI STRUTTURATI ===
type SetData = { id: string; reps: string; weight: string; completed: boolean; workDurationSec?: number | null; actualRestSec?: number | null; wasteDurationSec?: number | null; completedAt?: number; pastWeight?: string; pastReps?: string; };
type ExerciseLog = { id_scheda_esercizio?: number; id_esercizio: number; nome: string; gif_url?: string; recupero_sec: number; target_serie: number; target_reps: string; unita_misura: string; sets: SetData[]; };
type EsercizioBase = { id_esercizio: number; id?: number; nome: string; gif_url?: string; };
type ActiveSet = { exIndex: number; setIndex: number; phase: 'prep' | 'work'; startPrepTime: number; startWorkTime: number | null; };
type RestingSet = { exIndex: number; setIndex: number; startTs: number; }; 
type Muscolo = { id_gruppo?: number; id?: number; nome: string; };
type Attrezzo = { id_attrezzo?: number; id?: number; nome: string; };
type RelazioneMuscolo = { id_esercizio?: number; id_gruppo?: number; };
type RelazioneAttrezzo = { id_esercizio?: number; id_attrezzo?: number; };

// === FUNZIONE PRIVATA (NON ESPORTATA) ===
function WorkoutTrackerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const urlDayId = searchParams.get("day");
  const urlTemplateId = searchParams.get("template");

  const [dayId, setDayId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);

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
  
  const [swipedSetId, setSwipedSetId] = useState<string | null>(null);

  // Cataloghi e Sostituzione Estesa
  const [tuttiEsercizi, setTuttiEsercizi] = useState<EsercizioBase[]>([]);
  const [muscoli, setMuscoli] = useState<Muscolo[]>([]);
  const [attrezzi, setAttrezzi] = useState<Attrezzo[]>([]);
  const [relMuscoli, setRelMuscoli] = useState<RelazioneMuscolo[]>([]);
  const [relAttrezzi, setRelAttrezzi] = useState<RelazioneAttrezzo[]>([]);

  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [focusedExIndex, setFocusedExIndex] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [previewExercise, setPreviewExercise] = useState<ExerciseLog | null>(null);

  const [isMuscoliOpen, setIsMuscoliOpen] = useState(false);
  const [isAttrezziOpen, setIsAttrezziOpen] = useState(false);
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);

  // Storico Analitico
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [exerciseRecords, setExerciseRecords] = useState({ maxWeight: 0, maxWeightReps: 0, estimated1RM: 0 });

  const masterTimerRef = useRef<NodeJS.Timeout | null>(null);

  const formattedDate = useMemo(() => {
    if (!startTime) return "";
    return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(startTime));
  }, [startTime]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && startTime) {
        const now = Date.now();
        setElapsedTimeDisplay(Math.floor((now - startTime) / 1000));

        if (restEndTime) {
          const remaining = Math.ceil((restEndTime - now) / 1000);
          if (remaining <= 0) {
            playSound();
            setRestEndTime(null);
            setRestTimeDisplay(null);
            setExtraStartTime(now);
            setIsRestModalOpen(false);
          } else {
            setRestTimeDisplay(remaining);
          }
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [startTime, restEndTime]);

  // Caricamento Dati e Ghosting
  useEffect(() => {
    async function loadWorkout() {
      setIsLoading(true);
      const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      
      // Idratazione dei cataloghi per i filtri di sostituzione (Punto Critico)
      try {
        const { data: catData } = await supabase.from('Esercizi').select('id_esercizio, nome, gif_url').order('nome');
        if (catData) setTuttiEsercizi(catData as EsercizioBase[]);

        const { data: mData } = await supabase.from('GruppiMuscolari').select('*').order('nome');
        if (mData) setMuscoli(mData as Muscolo[]);

        const { data: aData } = await supabase.from('Attrezzi').select('*').order('nome');
        if (aData) setAttrezzi(aData as Attrezzo[]);

        let { data: relMData, error: relMErr } = await supabase.from('Esercizio_Muscolo').select('*');
        if (relMErr) {
            const fallback = await supabase.from('esercizio_muscolo').select('*');
            relMData = fallback.data;
        }
        if (relMData) setRelMuscoli(relMData as RelazioneMuscolo[]);

        const { data: relAData } = await supabase.from('Esercizio_Attrezzo').select('*');
        if (relAData) setRelAttrezzi(relAData as RelazioneAttrezzo[]);
      } catch (err) { console.error("Errore fetch cataloghi:", err); }

      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          const currentDayId = parsed.dayId || urlDayId;
          const currentTemplateId = parsed.templateId || urlTemplateId;
          
          setDayId(currentDayId);
          setTemplateId(currentTemplateId);

          if (currentDayId === urlDayId || !urlDayId) {
            setWorkoutName(parsed.workoutName); 
            setExercises(parsed.exercises); 
            setStartTime(parsed.startTime); 
            setRestEndTime(parsed.restEndTime); 
            setExtraStartTime(parsed.extraStartTime);
            setRestTotalTime(parsed.restTotalTime || null); 
            setActiveSet(parsed.activeSet || null);
            setRestingSet(parsed.restingSet || null);
            if (parsed.restEndTime) {
              const remaining = Math.ceil((parsed.restEndTime - Date.now()) / 1000);
              setRestTimeDisplay(remaining > 0 ? remaining : null);
            }
            setIsLoading(false);
            return; 
          }
        } catch (e) { console.error(e); }
      }

      if (!urlDayId) { setIsLoading(false); return; }

      setDayId(urlDayId);
      setTemplateId(urlTemplateId);

      try {
        setStartTime(Date.now());
        const { data: dayData } = await supabase.from('Giorni_Template').select('nome_giorno').eq('id_giorno', urlDayId).single();
        if (dayData) setWorkoutName(dayData.nome_giorno);

        let pastSets: any[] = [];
        
        const { data: lastSession } = await supabase
          .from('Storico_Allenamenti')
          .select('id_sessione')
          .eq('id_giorno', urlDayId)
          .order('inizio_ts', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastSession) {
          const { data: storiche } = await supabase
            .from('Storico_Serie')
            .select('id_esercizio, ordine_serie, reps, weight')
            .eq('id_sessione', lastSession.id_sessione);
          if (storiche) pastSets = storiche;
        }

        const { data: exData } = await supabase.from('Scheda_Esercizi').select('*, Esercizi(nome, gif_url)').eq('id_giorno', urlDayId).order('ordine');
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
            sets: Array.from({ length: parseInt(ex.serie) || 1 }).map((_, i) => {
              const historicRecord = pastSets.find(ps => ps.id_esercizio === ex.id_esercizio && ps.ordine_serie === (i + 1));
              return {
                id: `${ex.id_scheda_esercizio}-${i}`, 
                reps: ex.ripetizioni || "", 
                weight: "", 
                completed: false,
                pastWeight: historicRecord?.weight || "", 
                pastReps: historicRecord?.reps || ""
              };
            })
          })));
        }
      } catch (error) { console.error(error); } finally { setIsLoading(false); }
    }
    loadWorkout();
  }, [urlDayId, urlTemplateId]);

  // Generazione Dati Analitici per la Modale Storico
  useEffect(() => {
    if (isHistoryModalOpen && focusedExIndex !== null) {
      const idEsercizio = exercises[focusedExIndex].id_esercizio;
      fetchHistoryForExercise(idEsercizio);
    }
  }, [isHistoryModalOpen, focusedExIndex]);

  const fetchHistoryForExercise = async (id_esercizio: number) => {
    setIsHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('Storico_Serie')
        .select('weight, reps, completata_il, Storico_Allenamenti(inizio_ts)')
        .eq('id_esercizio', id_esercizio)
        .not('weight', 'is', null)
        .not('reps', 'is', null)
        .order('completata_il', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        let maxW = 0; let repsAtMaxW = 0; let max1RM = 0;
        const sessionsMap = new Map();

        data.forEach((row: any) => {
           const w = parseFloat(row.weight) || 0;
           const r = parseInt(row.reps) || 0;

           if (w > maxW) { maxW = w; repsAtMaxW = r; }
           // Formula Epley rigorosa
           const oneRM = w * (1 + r / 30);
           if (oneRM > max1RM) max1RM = oneRM;

           const dateStr = row.Storico_Allenamenti?.inizio_ts || row.completata_il;
           if (!dateStr) return;
           const dateObj = new Date(dateStr);
           const dayKey = dateObj.toISOString().split('T')[0];

           if (!sessionsMap.has(dayKey)) sessionsMap.set(dayKey, { date: dateObj, sets: [] });
           sessionsMap.get(dayKey).sets.push({ weight: w, reps: r });
        });

        setExerciseRecords({ maxWeight: maxW, maxWeightReps: repsAtMaxW, estimated1RM: Math.round(max1RM) });

        const historyList = Array.from(sessionsMap.values())
           .sort((a: any, b: any) => b.date.getTime() - a.date.getTime())
           .slice(0, 10);
        setHistoryData(historyList);
      } else {
        setHistoryData([]);
        setExerciseRecords({ maxWeight: 0, maxWeightReps: 0, estimated1RM: 0 });
      }
    } catch (err) { console.error(err); } finally { setIsHistoryLoading(false); }
  };

  useEffect(() => {
    if (isLoading || !startTime) return;
    const stateToSave = { templateId, dayId, workoutName, exercises, startTime, restEndTime, extraStartTime, restTotalTime, activeSet, restingSet };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
  }, [exercises, restEndTime, extraStartTime, startTime, workoutName, dayId, templateId, isLoading, restTotalTime, activeSet, restingSet]);

  useEffect(() => {
    if (!startTime) return;
    if (masterTimerRef.current) clearInterval(masterTimerRef.current);

    masterTimerRef.current = setInterval(() => {
      const now = Date.now();
      setElapsedTimeDisplay(Math.floor((now - startTime) / 1000));

      if (restEndTime) {
        const remaining = Math.ceil((restEndTime - now) / 1000);
        if (remaining <= 0) {
          playSound();
          setRestEndTime(null); 
          setRestTimeDisplay(null); 
          setExtraStartTime(now); 
          setIsRestModalOpen(false); 
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

    return () => { if (masterTimerRef.current) clearInterval(masterTimerRef.current); };
  }, [startTime, restEndTime]);

  const commitRestPhase = () => {
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
    setRestTimeDisplay(null); 
    setExtraStartTime(null);
    setIsRestModalOpen(false);
  };

  const updateSet = (exIndex: number, setIndex: number, field: 'reps' | 'weight', value: string) => {
    const sanitizedValue = field === 'weight' ? value.replace(',', '.') : value;

    setExercises(prev => {
      const next = [...prev];
      const newSets = [...next[exIndex].sets];
      newSets[setIndex] = { ...newSets[setIndex], [field]: sanitizedValue };
      next[exIndex] = { ...next[exIndex], sets: newSets };
      return next;
    });
  };

  const deleteSet = (exIndex: number, setIndex: number) => {
    setExercises(prev => {
      const next = [...prev];
      const targetEx = { ...next[exIndex] };
      if (targetEx.sets.length > 1) { 
        targetEx.sets = targetEx.sets.filter((_, idx) => idx !== setIndex);
        next[exIndex] = targetEx;
      }
      return next;
    });
    setSwipedSetId(null);
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
        }

        const recSec = next[exIndex].recupero_sec;
        setRestTotalTime(recSec);
        setRestEndTime(Date.now() + recSec * 1000);
        setRestingSet({ exIndex, setIndex, startTs: Date.now() });
      } else {
        targetSet.completedAt = undefined;
        if (restingSet?.exIndex === exIndex && restingSet?.setIndex === setIndex) {
          setRestingSet(null);
          setRestTotalTime(null); 
          setRestEndTime(null);
          setRestTimeDisplay(null);
        }
      }

      newSets[setIndex] = targetSet;
      next[exIndex] = { ...next[exIndex], sets: newSets };
      return next;
    });
  };
  
  // === LOGICA FILTRI VETTORIALE IDENTICA A DAY/[ID] ===
  const toggleMuscle = (id: string) => {
    setSelectedMuscles(prev => prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]);
  };

  let risultatiFinali: EsercizioBase[] = [];
  const hasSearch = searchText.trim() !== "";
  const hasMuscles = selectedMuscles.length > 0;
  const hasEquipment = selectedEquipment !== null;

  if (hasSearch || hasMuscles || hasEquipment) {
    let filtratiBase = tuttiEsercizi.filter(es => {
      const esId = String(es.id_esercizio ?? es.id);
      const matchesMuscles = !hasMuscles || selectedMuscles.every(mId => 
        relMuscoli.some(rm => String(rm.id_esercizio ?? (rm as any).esercizio_id) === esId && String(rm.id_gruppo ?? (rm as any).gruppo_id) === mId)
      );
      const matchesEquipment = !hasEquipment || relAttrezzi.some(ra => 
          String(ra.id_esercizio ?? (ra as any).esercizio_id) === esId && String(ra.id_attrezzo ?? (ra as any).attrezzo_id) === selectedEquipment
      );
      return matchesMuscles && matchesEquipment;
    });

    if (hasSearch) {
      const parole = searchText.toLowerCase().trim().split(/\s+/);
      parole.forEach(parola => {
        const fuse = new Fuse(filtratiBase, { keys: ['nome'], threshold: 0.35, ignoreLocation: true });
        filtratiBase = fuse.search(parola).map(r => r.item);
      });
    }
    risultatiFinali = filtratiBase;
  }

  const handleReplace = (nuovoEs: EsercizioBase) => {
    if (focusedExIndex === null) return;
    setExercises(prev => {
      const next = [...prev];
      next[focusedExIndex] = { ...next[focusedExIndex], id_esercizio: nuovoEs.id_esercizio, nome: nuovoEs.nome, gif_url: nuovoEs.gif_url };
      return next;
    });
    setIsReplaceModalOpen(false);
    setFocusedExIndex(null);
    setSearchText("");
    setSelectedMuscles([]);
    setSelectedEquipment(null);
    setIsMuscoliOpen(false);
    setIsAttrezziOpen(false);
  };

  const clearAndRedirect = () => { localStorage.removeItem(LOCAL_STORAGE_KEY); router.push("/start-workout"); };
  
  const finishWorkout = () => {
    if (confirm("Terminare l'allenamento e generare i grafici?")) {
      commitRestPhase();
      
      const normalizedExercises = exercises.map(ex => ({
        ...ex,
        sets: ex.sets.map(s => ({
          ...s,
          weight: s.completed && s.weight.trim() !== "" ? s.weight : "0",
          reps: s.completed && s.reps.trim() !== "" ? s.reps : "0",
        }))
      }));

      const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        parsed.endTime = Date.now();
        parsed.exercises = normalizedExercises; 
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

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-base text-main"><CleanSpinner size={64} /></div>;

  return (
    <div className="flex flex-col min-h-screen bg-base relative overflow-x-hidden pb-32">
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
        {exercises.map((ex, exIndex) => {
          const totalSets = ex.sets.length;
          const completedCount = ex.sets.filter(s => s.completed).length;
          
          const isExCompleted = totalSets > 0 && completedCount === totalSets;
          const isExPartial = completedCount > 0 && completedCount < totalSets && (!activeSet || activeSet.exIndex !== exIndex);

          return (
            <div 
              key={ex.id_scheda_esercizio || exIndex} 
              className={`bg-surface border-4 border-line shadow-[8px_8px_0px_#000000] flex flex-col transition-all duration-300 
                ${isExCompleted ? 'border-emerald-500 shadow-[8px_8px_0px_#10b981] bg-emerald-50/5 dark:bg-emerald-950/5' : ''}
                ${isExPartial ? 'border-orange-500 shadow-[8px_8px_0px_#f97316] bg-orange-50/5 dark:bg-orange-950/5' : ''}`}
            >
              <div className={`p-4 border-b-4 border-line bg-base flex justify-between items-center transition-colors
                ${isExCompleted ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500' : ''}
                ${isExPartial ? 'bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500' : ''}`}
              >
                <h2 className="font-heading text-xl font-black uppercase leading-tight line-clamp-1 flex items-center gap-2">
                  {exIndex + 1}. {ex.nome}
                  {isExCompleted && <CheckCircle size={18} strokeWidth={3} className="text-emerald-500 animate-in zoom-in" />}
                  {isExPartial && <AlertCircle size={18} strokeWidth={3} className="text-orange-500 animate-in zoom-in" />}
                </h2>
                <div className="flex gap-2">
                  <button onClick={() => setPreviewExercise(ex)} className="w-9 h-9 bg-brand text-black border-2 border-line flex items-center justify-center font-black shadow-[2px_2px_0px_#000000]">?</button>
                  <button onClick={() => { setFocusedExIndex(exIndex); setIsOptionsModalOpen(true); }} className="w-9 h-9 bg-surface text-main border-2 border-line flex items-center justify-center shadow-[2px_2px_0px_#000000]"><MoreHorizontal size={20}/></button>
                </div>
              </div>
              
              <div className="grid grid-cols-[3rem_1fr_1fr_3rem] gap-2 p-3 border-b-2 border-line bg-surface/50 text-[10px] font-black uppercase tracking-widest text-muted text-center">
                <div>Set</div><div>{ex.unita_misura}</div><div>Reps</div><div>Fatto</div>
              </div>

              <div className="flex flex-col">
                {ex.sets.map((set, setIndex) => {
                  const isThisSetActive = activeSet?.exIndex === exIndex && activeSet?.setIndex === setIndex;
                  let startX = 0;
                  let startY = 0;
                  
                  return (
                    <div key={set.id} className="relative w-full border-b-2 border-line last:border-b-0 bg-base overflow-hidden">
                      
                      <div className="absolute top-0 bottom-0 right-0 w-24 flex items-center justify-center bg-red-100 dark:bg-red-950/30">
                        <button 
                          onClick={() => deleteSet(exIndex, setIndex)} 
                          disabled={ex.sets.length <= 1} 
                          className="w-full h-full flex items-center justify-center text-red-600 dark:text-red-400 disabled:opacity-20 transition-all outline-none"
                        >
                          <Trash2 size={24} strokeWidth={2.5} />
                        </button>
                      </div>

                      <div 
                        onTouchStart={(e) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; }}
                        onTouchEnd={(e) => {
                          const deltaX = startX - e.changedTouches[0].clientX;
                          const deltaY = Math.abs(startY - e.changedTouches[0].clientY);
                          if (deltaY < 30) {
                            if (deltaX > 40) setSwipedSetId(set.id); 
                            else if (deltaX < -40) setSwipedSetId(null); 
                          }
                        }}
                        className={`relative z-10 w-full p-3 grid grid-cols-[3rem_1fr_1fr_3rem] gap-3 items-center bg-base transition-transform duration-200 ease-out ${swipedSetId === set.id ? '-translate-x-24' : 'translate-x-0'}`}
                      >
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

                        <input 
                          type="number" 
                          value={set.weight} 
                          placeholder={set.pastWeight || "0"} 
                          onChange={(e) => updateSet(exIndex, setIndex, 'weight', e.target.value)} 
                          onFocus={() => { if (swipedSetId === set.id) setSwipedSetId(null); }}
                          className={`w-full bg-surface border-2 border-line p-2 text-center font-bold outline-none focus:shadow-[2px_2px_0px_#000000] placeholder:text-main/20 dark:placeholder:text-white/20 ${set.completed ? 'text-muted' : 'text-main'}`} 
                        />
                        <input 
                          type="number" 
                          value={set.reps} 
                          placeholder={set.pastReps || ex.target_reps || "0"} 
                          onChange={(e) => updateSet(exIndex, setIndex, 'reps', e.target.value)} 
                          onFocus={() => { if (swipedSetId === set.id) setSwipedSetId(null); }}
                          className={`w-full bg-surface border-2 border-line p-2 text-center font-bold outline-none focus:shadow-[2px_2px_0px_#000000] placeholder:text-main/20 dark:placeholder:text-white/20 ${set.completed ? 'text-muted' : 'text-main'}`} 
                        />
                        
                        <div className="flex justify-center">
                          <button onClick={() => toggleSetCompletion(exIndex, setIndex)} className={`w-10 h-10 border-2 border-line flex items-center justify-center shadow-[2px_2px_0px_#000000] transition-all ${set.completed ? 'bg-brand shadow-none translate-x-[2px] translate-y-[2px]' : 'bg-surface'}`}>
                            <Check size={20} strokeWidth={4} className={set.completed ? "text-base" : "text-line/20"} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => { 
                setExercises(prev => {
                  const next = [...prev];
                  const nxEx = { ...next[exIndex] };
                  nxEx.sets = [...nxEx.sets, { id: Date.now().toString(), reps: nxEx.target_reps, weight: "", completed: false, pastWeight: "", pastReps: "" }];
                  next[exIndex] = nxEx;
                  return next;
                });
              }} className="p-3 bg-surface border-t-2 border-line text-[10px] font-black uppercase tracking-widest text-muted flex justify-center items-center gap-2"><Plus size={14}/> Aggiungi Serie</button>
            </div>
          );
        })}
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
            <button onClick={() => { playSound(); commitRestPhase(); }} className="w-full py-5 bg-brand border-2 border-line text-base font-black uppercase tracking-widest text-xl shadow-[4px_4px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all">SKIP</button>
          </div>
        </div>
      )}

      {isOptionsModalOpen && focusedExIndex !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-base w-full max-w-sm border-4 border-line p-6 flex flex-col gap-4 shadow-[12px_12px_0px_#000000]">
            <div className="flex justify-between items-center border-b-2 border-line pb-2">
              <h3 className="font-heading text-lg font-black uppercase truncate max-w-[80%]">{exercises[focusedExIndex].nome}</h3>
              <button onClick={() => { setIsOptionsModalOpen(false); setFocusedExIndex(null); }}><X size={20} strokeWidth={3}/></button>
            </div>
            <div className="flex flex-col gap-3 mt-2">
              <button 
                onClick={() => { setIsOptionsModalOpen(false); setIsReplaceModalOpen(true); }}
                className="w-full text-left p-4 bg-surface border-2 border-line font-black uppercase tracking-wide flex justify-between items-center hover:bg-brand active:translate-x-[2px] active:translate-y-[2px]"
              >
                Sostituisci Esercizio <MoreHorizontal size={18}/>
              </button>
              <button 
                onClick={() => { setIsOptionsModalOpen(false); setIsHistoryModalOpen(true); }}
                className="w-full text-left p-4 bg-surface border-2 border-line font-black uppercase tracking-wide flex justify-between items-center hover:bg-brand active:translate-x-[2px] active:translate-y-[2px]"
              >
                Storico Pesi & Record <History size={18}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {isHistoryModalOpen && focusedExIndex !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[160] flex items-center justify-center p-4">
          <div className="bg-base w-full max-w-md border-4 border-line p-6 flex flex-col gap-6 shadow-[12px_12px_0px_#000000] max-h-[80vh]">
            <div className="flex justify-between items-center border-b-4 border-line pb-2">
              <div className="flex items-center gap-2 text-brand">
                <History size={24} strokeWidth={3}/>
                <h3 className="font-heading text-xl font-black uppercase truncate max-w-[280px]">{exercises[focusedExIndex].nome}</h3>
              </div>
              <button onClick={() => { setIsHistoryModalOpen(false); setFocusedExIndex(null); }} className="w-8 h-8 bg-surface border-2 border-line flex items-center justify-center"><X size={16} strokeWidth={3}/></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface border-2 border-line p-3 flex flex-col shadow-[2px_2px_0px_#000000]">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted">Carico Max</span>
                <span className="text-xl font-black text-main mt-1">{exerciseRecords.maxWeight > 0 ? exerciseRecords.maxWeight : '--'} <span className="text-xs text-muted">{exercises[focusedExIndex].unita_misura}</span></span>
                <span className="text-[9px] font-bold uppercase text-muted mt-0.5">Max Reps: {exerciseRecords.maxWeightReps > 0 ? exerciseRecords.maxWeightReps : '--'}</span>
              </div>
              <div className="bg-brand/10 border-2 border-brand p-3 flex flex-col shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                <span className="text-[9px] font-black uppercase tracking-widest text-brand">Massimale (1RM)</span>
                <span className="text-xl font-black text-main mt-1">{exerciseRecords.estimated1RM > 0 ? exerciseRecords.estimated1RM : '--'} <span className="text-xs text-muted">{exercises[focusedExIndex].unita_misura}</span></span>
                <span className="text-[9px] font-bold uppercase text-muted mt-0.5">Teorico</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted mb-1">Ultime Performance</span>
              {isHistoryLoading ? (
                <div className="flex justify-center p-8"><CleanSpinner size={32} /></div>
              ) : historyData.length === 0 ? (
                <div className="border-2 border-dashed border-line p-8 text-center bg-surface/40 flex flex-col items-center justify-center gap-2">
                  <Dumbbell size={24} className="text-muted opacity-40"/>
                  <p className="text-xs font-black uppercase text-muted tracking-wide">Nessuno Storico</p>
                  <p className="text-[10px] font-bold text-muted/60 uppercase">Inizia a spingere per registrare i tuoi record.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {historyData.map((session, idx) => (
                    <div key={idx} className="bg-surface border-2 border-line p-3 flex flex-col gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-brand border-b-2 border-line pb-1">
                        {new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).format(session.date)}
                      </span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {session.sets.map((s: any, sIdx: number) => (
                          <span key={sIdx} className="text-xs font-bold bg-base border-2 border-line px-2 py-1">
                            {s.weight}{exercises[focusedExIndex].unita_misura} <span className="text-muted mx-0.5">x</span> {s.reps}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex flex-col justify-end">
          <div className="bg-base w-full h-[90vh] border-t-4 border-line flex flex-col shadow-[0px_-8px_0px_rgba(0,0,0,1)] dark:shadow-[0px_-8px_0px_rgba(128,76,217,1)] animate-in slide-in-from-bottom-full duration-300">
            
            <div className="flex justify-between items-center p-6 border-b-2 border-line shrink-0 bg-surface">
              <h2 className="font-heading text-2xl font-black uppercase text-main tracking-tighter">Sostituisci</h2>
              <button onClick={() => { setIsReplaceModalOpen(false); setFocusedExIndex(null); setSelectedMuscles([]); setSelectedEquipment(null); setSearchText(""); setIsMuscoliOpen(false); setIsAttrezziOpen(false); }} className="w-10 h-10 bg-base flex items-center justify-center border-2 border-line shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#804CD9] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
                <X size={20} strokeWidth={3} className="text-main"/>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              <div className="relative shrink-0">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted" size={20} strokeWidth={3} />
                <input 
                  type="text" 
                  placeholder="Cerca esercizio..." 
                  value={searchText} 
                  onChange={(e) => setSearchText(e.target.value)} 
                  className="w-full bg-surface pl-14 pr-5 py-5 border-2 border-line text-main font-bold uppercase tracking-wide outline-none focus:shadow-[4px_4px_0px_#000000] dark:focus:shadow-[4px_4px_0px_#804CD9] transition-all placeholder:text-muted/50"
                />
              </div>

              <div className="flex flex-col gap-4 border-b-2 border-line pb-6 shrink-0">
                <div>
                  <button onClick={() => setIsMuscoliOpen(!isMuscoliOpen)} className="flex items-center gap-2 w-full text-left py-2 outline-none">
                    {isMuscoliOpen ? <ChevronDown size={20} strokeWidth={3} className="text-brand" /> : <ChevronRight size={20} strokeWidth={3} className="text-main" />}
                    <span className={`text-sm uppercase tracking-widest font-black ${selectedMuscles.length > 0 ? "text-brand" : "text-main"}`}>
                      Muscoli {selectedMuscles.length > 0 && `(${selectedMuscles.length})`}
                    </span>
                  </button>
                  {isMuscoliOpen && (
                    <div className="flex flex-wrap gap-2 mt-4 mb-2">
                      {muscoli.map(m => {
                        const mId = String(m.id_gruppo ?? m.id);
                        return (
                          <button key={`btn-muscolo-${mId}`} onClick={() => toggleMuscle(mId)} className={`px-4 py-2 border-2 border-line text-xs font-black uppercase tracking-widest transition-all ${selectedMuscles.includes(mId) ? 'bg-brand text-base shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#804CD9] translate-x-[-1px] translate-y-[-1px]' : 'bg-surface text-main hover:bg-base'}`}>
                            {m.nome}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <button onClick={() => setIsAttrezziOpen(!isAttrezziOpen)} className="flex items-center gap-2 w-full text-left py-2 outline-none">
                    {isAttrezziOpen ? <ChevronDown size={20} strokeWidth={3} className="text-brand" /> : <ChevronRight size={20} strokeWidth={3} className="text-main" />}
                    <span className={`text-sm uppercase tracking-widest font-black ${selectedEquipment ? "text-brand" : "text-main"}`}>
                      Attrezzi {selectedEquipment && "(1)"}
                    </span>
                  </button>
                  {isAttrezziOpen && (
                    <div className="flex flex-wrap gap-2 mt-4 mb-2">
                      {attrezzi.map(a => {
                        const aId = String(a.id_attrezzo ?? a.id);
                        return (
                          <button key={`btn-attrezzo-${aId}`} onClick={() => setSelectedEquipment(selectedEquipment === aId ? null : aId)} className={`px-4 py-2 border-2 border-line text-xs font-black uppercase tracking-widest transition-all ${selectedEquipment === aId ? 'bg-brand text-base shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#804CD9] translate-x-[-1px] translate-y-[-1px]' : 'bg-surface text-main hover:bg-base'}`}>
                            {a.nome}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 pb-6">
                {risultatiFinali.map(es => (
                  <button key={`result-${es.id_esercizio}`} onClick={() => handleReplace(es)} className="w-full p-4 bg-surface border-2 border-line text-left font-black uppercase hover:bg-brand transition-colors flex justify-between items-center">
                    {es.nome} <Plus size={20}/>
                  </button>
                ))}
                {risultatiFinali.length === 0 && (searchText || selectedMuscles.length > 0 || selectedEquipment) && (
                  <p className="text-muted text-center mt-10 text-sm font-bold uppercase tracking-widest">Nessun esercizio corrisponde.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === COMPONENTE ESPORTATO (CON CONFINE SUSPENSE) ===
export default function WorkoutTracker() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-base text-main">
        <span className="font-heading text-2xl font-black uppercase animate-pulse">
          Caricamento Dati...
        </span>
      </div>
    }>
      <WorkoutTrackerContent />
    </Suspense>
  );
}