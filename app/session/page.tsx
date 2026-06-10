"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Trophy, BarChart3, ListOrdered, Zap, Coffee, Trash2, Clock, Ghost, Edit3, X, CheckCircle2, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";

const CleanSpinner = ({ size = 24 }: { size?: number }) => {
  return (
    <div style={{ width: size, height: size, position: 'relative', color: "currentColor" }}>
      <style>{`@keyframes cleanSpinnerRotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } .spinner-ring { box-sizing: border-box; display: block; position: absolute; width: 100%; height: 100%; border: ${size * 0.15}px solid currentColor; border-radius: 50%; animation: cleanSpinnerRotate 1s cubic-bezier(0.5, 0, 0.5, 1) infinite; border-color: currentColor transparent transparent transparent; } .spinner-ring-track { box-sizing: border-box; display: block; position: absolute; width: 100%; height: 100%; border: ${size * 0.15}px solid currentColor; border-radius: 50%; opacity: 0.15; }`}</style>
      <div className="spinner-ring-track"></div>
      <div className="spinner-ring"></div>
    </div>
  );
};

type SetData = { 
  ordine_serie: number;
  reps: string; 
  weight: string; 
  completed: boolean; 
  workDurationSec: number; 
  actualRestSec: number; 
  wasteDurationSec: number; 
  completedAt: number; 
};

type ExerciseLog = { 
  ordine_esercizio: number;
  id_esercizio: number; 
  nome: string; 
  unita_misura: string;
  expectedSets: number; 
  sets: SetData[]; 
};

// === ICONA SVG COPPA BRUTALISTA (Sostituisce Emoji) ===
const SvgTrophy = ({ size = 10 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
    <path d="M12 2a6 6 0 0 1 6 6v5a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8a6 6 0 0 1 6-6z" />
  </svg>
);

// === GRAFICO MACRO A CIAMBELLA ===
const MacroDonutChart = ({ exercises, totalSessionTime }: { exercises: ExerciseLog[], totalSessionTime: number }) => {
  const size = 400;
  const center = size / 2;
  const radius = 160;
  const innerRadius = 90;

  const { tut, rest, waste, unaccounted } = useMemo(() => {
    let t = 0; let r = 0; let w = 0;
    exercises.forEach(ex => {
      ex.sets.forEach(s => {
        t += s.workDurationSec || 0;
        r += s.actualRestSec || 0;
        w += s.wasteDurationSec || 0;
      });
    });
    const tracked = t + r + w;
    const u = Math.max(0, totalSessionTime - tracked);
    return { tut: t, rest: r, waste: w, unaccounted: u };
  }, [exercises, totalSessionTime]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const getCoordinatesForAngle = (angle: number, r: number) => ({
    x: center + r * Math.cos(angle),
    y: center + r * Math.sin(angle)
  });

  const generatePieSlice = (startAngle: number, endAngle: number) => {
    if (endAngle - startAngle >= 2 * Math.PI - 0.01) {
      return `M ${center + radius} ${center} A ${radius} ${radius} 0 1 1 ${center - radius} ${center} A ${radius} ${radius} 0 1 1 ${center + radius} ${center} Z`;
    }
    const p1 = getCoordinatesForAngle(startAngle, radius);
    const p2 = getCoordinatesForAngle(endAngle, radius);
    const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";
    return `M ${center} ${center} L ${p1.x} ${p1.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${p2.x} ${p2.y} Z`;
  };

  const total = tut + rest + waste + unaccounted;
  if (total === 0) return null;

  let currentAngle = -Math.PI / 2; 
  
  const slices = [
    { value: tut, color: "#ccff00", label: "TUT" },
    { value: rest, color: "#ffde59", label: "Recupero" },
    { value: waste, color: "#ff331f", label: "Tempo Perso" },
    { value: unaccounted, color: "#1a1a1a", label: "Non Tracciato" } 
  ].map(slice => {
    const angle = (slice.value / total) * 2 * Math.PI;
    const start = currentAngle;
    const end = currentAngle + angle;
    currentAngle = end;
    return { ...slice, start, end };
  });

  return (
    <div className="flex flex-col items-center bg-surface border-4 border-line p-6 shadow-[8px_8px_0px_#000000] relative w-full h-full">
      <h3 className="font-heading text-2xl font-black uppercase text-main tracking-tighter mb-4 border-b-4 border-line pb-2 w-full text-center">Efficienza Macro</h3>
      
      <div className="relative w-full max-w-[300px] flex items-center justify-center flex-1">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full drop-shadow-md">
          {slices.map((slice, i) => slice.value > 0 && (
            <path key={i} d={generatePieSlice(slice.start, slice.end)} fill={slice.color} stroke="var(--color-line)" strokeWidth="3" />
          ))}
          <circle cx={center} cy={center} r={innerRadius} fill="var(--color-surface)" stroke="var(--color-line)" strokeWidth="4" />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted">Totale</span>
          <span className="font-heading text-4xl font-black text-main leading-none tabular-nums mt-1">{formatTime(totalSessionTime)}</span>
        </div>
      </div>

      <div className="flex flex-col w-full gap-2 mt-6 text-[10px] font-black uppercase tracking-tighter bg-base p-4 border-2 border-line">
        <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#ccff00] border-2 border-line shrink-0"></div><Zap size={12} className="text-muted"/> Sforzo</div><span className="text-main tabular-nums">{formatTime(tut)} <span className="text-muted ml-1">({Math.round((tut/total)*100)}%)</span></span></div>
        <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#ffde59] border-2 border-line shrink-0"></div><Coffee size={12} className="text-muted"/> Pause</div><span className="text-main tabular-nums">{formatTime(rest)} <span className="text-muted ml-1">({Math.round((rest/total)*100)}%)</span></span></div>
        <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#ff331f] border-2 border-line shrink-0"></div><Trash2 size={12} className="text-muted"/> Perso</div><span className="text-main tabular-nums">{formatTime(waste)} <span className="text-muted ml-1">({Math.round((waste/total)*100)}%)</span></span></div>
        <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#1a1a1a] border-2 border-line shrink-0"></div><Ghost size={12} className="text-muted"/> Morto</div><span className="text-main tabular-nums">{formatTime(unaccounted)} <span className="text-muted ml-1">({Math.round((unaccounted/total)*100)}%)</span></span></div>
      </div>
    </div>
  );
};

// === COMPONENTE GRAFICO NIGHTINGALE ROSE ===
const NightingaleRoseChart = ({ exercises }: { exercises: ExerciseLog[] }) => {
  const size = 600; 
  const center = size / 2; 
  const chartRadius = 180; 

  const { chartData, maxTotalTime } = useMemo(() => {
    let totalWorkoutSec = 0;
    const aggregated = exercises.map(ex => {
      const work = ex.sets.reduce((acc, s) => acc + (s.workDurationSec || 0), 0);
      const rest = ex.sets.reduce((acc, s) => acc + (s.actualRestSec || 0), 0);
      const waste = ex.sets.reduce((acc, s) => acc + (s.wasteDurationSec || 0), 0);
      
      const totalSets = ex.expectedSets; 
      const completedSets = ex.sets.length; 
      
      let realTotal = work + rest + waste;
      let missingTime = 0;

      if (completedSets > 0 && completedSets < totalSets) {
        missingTime = realTotal * ((totalSets - completedSets) / completedSets);
      }

      const total = realTotal + missingTime;
      totalWorkoutSec += realTotal;
      
      return { 
        id: ex.id_esercizio + Math.random().toString(),
        nome: ex.nome, 
        work, rest, waste, missingTime, total, 
        isSkipped: completedSets === 0 
      };
    });

    const maxTotal = Math.max(...aggregated.map(d => d.total), 1); 
    return { chartData: aggregated, maxTotalTime: maxTotal, totalWorkoutTime: totalWorkoutSec };
  }, [exercises]);

  const numExercises = chartData.length;
  const angleStep = (2 * Math.PI) / (numExercises || 1); 

  const generateArcPath = (startAngle: number, endAngle: number, radius: number) => {
    if (radius <= 0) return "";
    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);
    const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";
    return `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  if (numExercises === 0) return <div className="text-center font-black uppercase text-muted py-10">Nessun dato grafico.</div>;

  return (
    <div className="flex flex-col items-center bg-surface border-4 border-line p-6 shadow-[8px_8px_0px_#000000] relative w-full h-full">
      <h3 className="font-heading text-2xl font-black uppercase text-main tracking-tighter mb-4 border-b-4 border-line pb-2 w-full text-center">Micro Distribuzione</h3>

      <div className="flex-1 flex items-center justify-center w-full">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[450px] drop-shadow-md">
          <circle cx={center} cy={center} r={chartRadius} fill="none" stroke="var(--color-line)" strokeOpacity="0.2" strokeWidth="1.5" strokeDasharray="5 5" />
          <circle cx={center} cy={center} r={chartRadius * 0.66} fill="none" stroke="var(--color-line)" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="5 5" />
          <circle cx={center} cy={center} r={chartRadius * 0.33} fill="none" stroke="var(--color-line)" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="5 5" />

          {chartData.map((d, i) => {
            const startAngle = i * angleStep - Math.PI / 2;
            const endAngle = (i + 1) * angleStep - Math.PI / 2;
            const midAngle = startAngle + angleStep / 2; 

            const textRadius = chartRadius + 25; 
            let rotation = (midAngle * 180) / Math.PI;
            let anchor: "start" | "end" = "start";
            
            if (rotation > 90 || rotation < -90) {
              rotation += 180;
              anchor = "end";
            }
            const tx = center + textRadius * Math.cos(midAngle);
            const ty = center + textRadius * Math.sin(midAngle);
            const shortName = d.nome.length > 14 ? d.nome.substring(0, 13) + '.' : d.nome;

            if (d.isSkipped) {
              return (
                <g key={d.id}>
                  <path d={generateArcPath(startAngle, endAngle, chartRadius * 0.15)} fill="#94a3b8" stroke="var(--color-line)" strokeWidth="1.5" />
                  <text x={tx} y={ty} transform={`rotate(${rotation}, ${tx}, ${ty})`} textAnchor={anchor} alignmentBaseline="middle" fontSize="14" fontWeight="900" fontFamily="sans-serif" className="uppercase tracking-tighter fill-muted/50">
                    {shortName}
                  </text>
                </g>
              );
            }
            
            const rTotal = (d.total / maxTotalTime) * chartRadius; 
            const rRealTotal = ((d.work + d.rest + d.waste) / maxTotalTime) * chartRadius; 
            const rRestWork = ((d.work + d.rest) / maxTotalTime) * chartRadius;
            const rWork = (d.work / maxTotalTime) * chartRadius;

            return (
              <g key={d.id}>
                {d.missingTime > 0 && <path d={generateArcPath(startAngle, endAngle, rTotal)} fill="#94a3b8" stroke="var(--color-line)" strokeWidth="1.5" />}
                <path d={generateArcPath(startAngle, endAngle, rRealTotal)} fill="#ff331f" stroke="var(--color-line)" strokeWidth="1.5" /> 
                <path d={generateArcPath(startAngle, endAngle, rRestWork)} fill="#ffde59" stroke="var(--color-line)" strokeWidth="1.5" /> 
                <path d={generateArcPath(startAngle, endAngle, rWork)} fill="#ccff00" stroke="var(--color-line)" strokeWidth="1.5" /> 

                <text x={tx} y={ty} transform={`rotate(${rotation}, ${tx}, ${ty})`} textAnchor={anchor} alignmentBaseline="middle" fontSize="14" fontWeight="900" fontFamily="sans-serif" className="uppercase tracking-tighter fill-main">
                  {shortName}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-col w-full gap-2 mt-6 text-[10px] font-black uppercase tracking-tighter bg-base p-4 border-2 border-line">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#ccff00] border-2 border-line shrink-0"></div>Sforzo (TUT)</div>
          <span className="text-muted font-bold text-[9px]">Centro</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#ffde59] border-2 border-line shrink-0"></div>Recupero Effettivo</div>
          <span className="text-muted font-bold text-[9px]">Strato 2</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#ff331f] border-2 border-line shrink-0"></div>Sforamento Pause</div>
          <span className="text-muted font-bold text-[9px]">Strato 3</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#94a3b8] border-2 border-line shrink-0"></div>Stima Serie Mancanti</div>
          <span className="text-muted font-bold text-[9px]">Esterno</span>
        </div>
      </div>
    </div>
  );
};

// === LOGICA PRINCIPALE ESTRATTA IN UN COMPONENTE ===
function SessionDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id"); // Lettura tramite Query Params (?id=123)

  const [isLoading, setIsLoading] = useState(true);
  const [workoutName, setWorkoutName] = useState<string>("Allenamento");
  const [startDateTime, setStartDateTime] = useState<string>("");
  const [totalTime, setTotalTime] = useState<number>(0);
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);
  
  const [activeTab, setActiveTab] = useState<"riepilogo" | "analisi">("riepilogo");
  
  const [chartPage, setChartPage] = useState<number>(0);
  const [touchStart, setTouchStart] = useState<number>(0);

  // Stati per Metriche Avanzate
  const [currentVolume, setCurrentVolume] = useState<number>(0);
  const [volumeDeltaPct, setVolumeDeltaPct] = useState<number | null>(null);
  const [setPRs, setSetPRs] = useState<Record<string, string[]>>({});

  // Stati per la Modale Bottom Sheet di Modifica
  const [editingExIndex, setEditingExIndex] = useState<number | null>(null);
  const [localEditedSets, setLocalEditedSets] = useState<SetData[]>([]);
  const [isSavingEdits, setIsSavingEdits] = useState(false);

  const fetchSessionData = useCallback(async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('Storico_Allenamenti')
        .select('nome_allenamento, inizio_ts, durata_totale_sec, id_giorno')
        .eq('id_sessione', sessionId)
        .single();

      if (sessionError) throw sessionError;

      setWorkoutName(sessionData.nome_allenamento);
      setTotalTime(sessionData.durata_totale_sec);
      
      const d = new Date(sessionData.inizio_ts);
      const dateStr = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
      const timeStr = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(d);
      setStartDateTime(`${dateStr} - ${timeStr}`);

      let expectedSetsMap = new Map<number, number>();
      if (sessionData.id_giorno) {
         const { data: schedaEsercizi } = await supabase
           .from('Scheda_Esercizi')
           .select('id_esercizio, serie')
           .eq('id_giorno', sessionData.id_giorno);
         
         if (schedaEsercizi) {
           schedaEsercizi.forEach((ex: any) => {
             expectedSetsMap.set(ex.id_esercizio, parseInt(ex.serie) || 1);
           });
         }
      }

      const { data: seriesData, error: seriesError } = await supabase
        .from('Storico_Serie')
        .select('id_esercizio, ordine_esercizio, ordine_serie, reps, weight, unita_misura, work_duration_sec, actual_rest_sec, waste_duration_sec, completata_il, Esercizi(nome)')
        .eq('id_sessione', sessionId)
        .order('ordine_esercizio')
        .order('ordine_serie');

      if (seriesError) throw seriesError;

      const exerciseMap = new Map<number, ExerciseLog>();
      let sessionVolume = 0;

      seriesData.forEach((row: any) => {
        if (!exerciseMap.has(row.ordine_esercizio)) {
          exerciseMap.set(row.ordine_esercizio, {
            ordine_esercizio: row.ordine_esercizio,
            id_esercizio: row.id_esercizio,
            nome: row.Esercizi?.nome || 'Esercizio Sconosciuto',
            unita_misura: row.unita_misura || 'KG',
            expectedSets: expectedSetsMap.get(row.id_esercizio) || 4,
            sets: []
          });
        }
        
        const w = parseFloat(row.weight) || 0;
        const r = parseInt(row.reps) || 0;
        sessionVolume += (w * r);

        exerciseMap.get(row.ordine_esercizio)!.sets.push({
          ordine_serie: row.ordine_serie,
          reps: row.reps,
          weight: row.weight,
          completed: true,
          workDurationSec: row.work_duration_sec || 0,
          actualRestSec: row.actual_rest_sec || 0,
          wasteDurationSec: row.waste_duration_sec || 0,
          completedAt: new Date(row.completata_il).getTime()
        });
      });

      setExercises(Array.from(exerciseMap.values()));
      setCurrentVolume(sessionVolume);

      if (sessionData.id_giorno) {
        const { data: previousSession } = await supabase
          .from('Storico_Allenamenti')
          .select('id_sessione, Storico_Serie(weight, reps)')
          .eq('id_giorno', sessionData.id_giorno)
          .lt('inizio_ts', sessionData.inizio_ts) 
          .order('inizio_ts', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (previousSession && previousSession.Storico_Serie) {
          const prevVol = previousSession.Storico_Serie.reduce((acc: number, s: any) => acc + ((parseFloat(s.weight)||0) * (parseInt(s.reps)||0)), 0);
          if (prevVol > 0) {
            setVolumeDeltaPct(Math.round(((sessionVolume - prevVol) / prevVol) * 100));
          }
        }
      }

      const uniqueExIds = Array.from(new Set(seriesData.map((r: any) => r.id_esercizio)));
      if (uniqueExIds.length > 0) {
        const { data: pastHistory } = await supabase
          .from('Storico_Serie')
          .select('id_esercizio, weight, reps, Storico_Allenamenti!inner(inizio_ts)')
          .in('id_esercizio', uniqueExIds)
          .lt('Storico_Allenamenti.inizio_ts', sessionData.inizio_ts);

        const baselines: Record<number, { maxW: number, max1RM: number, maxRepsByW: Record<number, number> }> = {};
        
        pastHistory?.forEach(row => {
          const w = parseFloat(row.weight) || 0;
          const r = parseInt(row.reps) || 0;
          const id = row.id_esercizio;
          const e1rm = w * (1 + r / 30);
          
          if (!baselines[id]) baselines[id] = { maxW: 0, max1RM: 0, maxRepsByW: {} };
          if (w > baselines[id].maxW) baselines[id].maxW = w;
          if (e1rm > baselines[id].max1RM) baselines[id].max1RM = e1rm;
          if (r > (baselines[id].maxRepsByW[w] || 0)) baselines[id].maxRepsByW[w] = r;
        });

        const newPrs: Record<string, string[]> = {};
        seriesData.forEach((row: any) => {
          const w = parseFloat(row.weight) || 0;
          const r = parseInt(row.reps) || 0;
          const id = row.id_esercizio;
          if (w === 0 || r === 0) return;

          if (!baselines[id]) baselines[id] = { maxW: 0, max1RM: 0, maxRepsByW: {} };
          
          const prList: string[] = [];
          const e1rm = w * (1 + r / 30);
          let isNewMaxW = false;

          const hasHistory = baselines[id].maxW > 0 || baselines[id].max1RM > 0;

          if (hasHistory) {
            if (w > baselines[id].maxW) { prList.push("Max KG"); isNewMaxW = true; }
            if (e1rm > baselines[id].max1RM) { prList.push("New 1RM"); }
            if (r > (baselines[id].maxRepsByW[w] || 0) && !isNewMaxW) { prList.push("Max Reps"); }
          }

          if (w > baselines[id].maxW) baselines[id].maxW = w;
          if (e1rm > baselines[id].max1RM) baselines[id].max1RM = e1rm;
          if (r > (baselines[id].maxRepsByW[w] || 0)) baselines[id].maxRepsByW[w] = r;

          if (prList.length > 0) {
            const setId = `${row.ordine_esercizio}-${row.ordine_serie}`;
            newPrs[setId] = prList;
          }
        });
        setSetPRs(newPrs);
      }

    } catch (error: any) {
      console.error("Errore recupero sessione:", error.message || error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) fetchSessionData();
  }, [sessionId, fetchSessionData]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const openEditModal = (exIndex: number) => {
    setEditingExIndex(exIndex);
    setLocalEditedSets(JSON.parse(JSON.stringify(exercises[exIndex].sets)));
  };

  const handleLocalSetUpdate = (setIndex: number, field: 'weight' | 'reps', value: string) => {
    setLocalEditedSets(prev => {
      const next = [...prev];
      next[setIndex] = { ...next[setIndex], [field]: value };
      return next;
    });
  };

  const saveEdits = async () => {
    if (editingExIndex === null) return;
    setIsSavingEdits(true);
    
    try {
      const exToUpdate = exercises[editingExIndex];
      const updates = localEditedSets.map(set => {
        return supabase.from('Storico_Serie')
          .update({ weight: set.weight, reps: set.reps })
          .eq('id_sessione', sessionId)
          .eq('id_esercizio', exToUpdate.id_esercizio)
          .eq('ordine_serie', set.ordine_serie);
      });
      
      await Promise.all(updates);
      
      await fetchSessionData();
      setEditingExIndex(null);
    } catch (err: any) {
      console.error(err);
      alert("Errore durante l'aggiornamento dei carichi.");
    } finally {
      setIsSavingEdits(false);
    }
  };

  if (isLoading) return <main className="flex min-h-screen items-center justify-center bg-base text-main"><CleanSpinner size={64} /></main>;

  return (
    <main className="flex min-h-screen flex-col items-center bg-base p-4 pb-28 pt-8 overflow-x-hidden">
      
      <div className="w-full max-w-2xl text-center mb-8">
        <div className="inline-block p-4 bg-brand border-4 border-line shadow-[6px_6px_0px_#000000] mb-4">
          <Trophy size={40} />
        </div>
        <h1 className="font-heading text-4xl md:text-5xl font-black uppercase text-main leading-tight mb-2 break-words">
          {workoutName}
        </h1>
        <p className="text-xs font-black text-muted uppercase tracking-widest bg-surface border-2 border-line inline-block px-3 py-1 shadow-[2px_2px_0px_#000000]">
          {startDateTime}
        </p>
      </div>

      <div className="w-full max-w-2xl flex border-4 border-line mb-8 bg-surface shadow-[4px_4px_0px_#000000] overflow-hidden">
        <button 
          onClick={() => setActiveTab("riepilogo")}
          className={`flex-1 py-4 flex items-center justify-center gap-2.5 font-black uppercase tracking-widest text-xs transition-all outline-none ${activeTab === "riepilogo" ? 'bg-main text-base' : 'bg-surface text-main hover:bg-base/50'}`}
        >
          <ListOrdered size={18} /> Riepilogo
        </button>
        <button 
          onClick={() => setActiveTab("analisi")}
          className={`flex-1 py-4 flex items-center justify-center gap-2.5 font-black uppercase tracking-widest text-xs transition-all outline-none ${activeTab === "analisi" ? 'bg-main text-base' : 'bg-surface text-main hover:bg-base/50'}`}
        >
          <BarChart3 size={18} /> Analisi Tempi
        </button>
      </div>

      <div className="w-full max-w-2xl flex-1">
        {activeTab === "riepilogo" ? (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface border-4 border-line p-4 shadow-[6px_6px_0px_#000000] flex justify-between items-center text-main">
                <div className="flex items-center gap-2">
                  <Clock className="text-brand" size={24} strokeWidth={3} />
                  <span className="font-heading text-lg font-black uppercase tracking-tight leading-none pt-1">Tempo<br/>Totale</span>
                </div>
                <span className="font-mono text-xl font-black bg-brand text-base border-2 border-line px-4 py-2 shadow-[2px_2px_0px_#000000]">
                  {formatTime(totalTime)}
                </span>
              </div>
              
              <div className="bg-surface border-4 border-line p-4 shadow-[6px_6px_0px_#000000] flex justify-between items-center text-main relative overflow-hidden">
                <div className="flex items-center gap-2">
                  <TrendingUp className="text-brand" size={24} strokeWidth={3} />
                  <span className="font-heading text-lg font-black uppercase tracking-tight leading-none pt-1">Volume<br/>Load</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-mono text-xl font-black bg-main text-base border-2 border-line px-4 py-2 shadow-[2px_2px_0px_#000000]">
                    {currentVolume} KG
                  </span>
                  {volumeDeltaPct !== null && (
                    <span className={`text-[10px] font-black uppercase tracking-widest mt-1.5 flex items-center gap-1 ${volumeDeltaPct > 0 ? 'text-emerald-500' : volumeDeltaPct < 0 ? 'text-red-500' : 'text-muted'}`}>
                      {volumeDeltaPct > 0 ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="inline-block"><path d="m5 12 7-7 7 7M12 5v14"/></svg>
                      ) : volumeDeltaPct < 0 ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="inline-block"><path d="m19 12-7 7-7-7M12 19V5"/></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="inline-block"><path d="M5 12h14"/></svg>
                      )}
                      {volumeDeltaPct > 0 ? '+' : ''}{volumeDeltaPct}% vs Precedente
                    </span>
                  )}
                </div>
              </div>
            </div>

            {exercises.map((ex, idx) => {
              const exTotalTime = ex.sets.reduce((acc, s) => acc + s.workDurationSec + s.actualRestSec + s.wasteDurationSec, 0);

              return (
                <div key={idx} className="bg-surface border-4 border-line shadow-[6px_6px_0px_#000000] overflow-hidden relative group">
                  <div className="bg-main p-3 flex justify-between items-center border-b-4 border-line">
                    <span className="font-heading text-lg font-black uppercase text-base truncate max-w-[70%]">{ex.nome}</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-base text-main border-2 border-line px-2.5 py-0.5 text-xs font-mono font-black shadow-[2px_2px_0px_#000000] shrink-0">
                        <Clock size={12} className="text-brand"/>
                        {formatTime(exTotalTime)}
                      </div>
                      <button 
                        onClick={() => openEditModal(idx)}
                        className="w-8 h-8 bg-surface text-main border-2 border-line flex items-center justify-center shadow-[2px_2px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                      >
                        <Edit3 size={14} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                  <div className="p-4 flex flex-col gap-3 bg-base/50">
                    {ex.sets.map((set, sIdx) => {
                      const setId = `${ex.ordine_esercizio}-${set.ordine_serie}`;
                      const tags = setPRs[setId] || [];

                      return (
                        <div key={sIdx} className="flex flex-wrap items-center gap-3">
                          <div className="bg-surface text-main border-2 border-line px-3 py-1 font-bold text-sm shadow-[2px_2px_0px_#000000] shrink-0">
                            {set.weight}{ex.unita_misura} x {set.reps}
                          </div>
                          
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {tags.map((tag, tIdx) => (
                                <span key={tIdx} className="text-[9px] font-black uppercase tracking-widest bg-[#ffde59] text-black px-1.5 py-0.5 border-2 border-black shadow-[2px_2px_0px_#000000] rotate-[-2deg] flex items-center gap-1">
                                  <SvgTrophy size={10} /> {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div 
            className="flex flex-col w-full overflow-hidden animate-in fade-in slide-in-from-bottom-4"
            onTouchStart={(e) => { setTouchStart(e.touches[0].clientX); }}
            onTouchEnd={(e) => {
              const deltaX = touchStart - e.changedTouches[0].clientX;
              if (deltaX > 40 && chartPage === 0) setChartPage(1);
              else if (deltaX < -40 && chartPage === 1) setChartPage(0);
            }}
            onMouseDown={(e) => { setTouchStart(e.clientX); }}
            onMouseUp={(e) => {
              const deltaX = touchStart - e.clientX;
              if (deltaX > 40 && chartPage === 0) setChartPage(1);
              else if (deltaX < -40 && chartPage === 1) setChartPage(0);
            }}
          >
            <div 
              className="flex w-full transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${chartPage * 100}%)` }}
            >
              <div className="w-full shrink-0 flex items-stretch select-none px-1">
                <NightingaleRoseChart exercises={exercises} />
              </div>
              <div className="w-full shrink-0 flex items-stretch select-none px-1">
                <MacroDonutChart exercises={exercises} totalSessionTime={totalTime} />
              </div>
            </div>

            <div className="flex justify-center items-center gap-3 mt-6 mb-2">
              <button onClick={() => setChartPage(0)} className={`w-3 h-3 rounded-full transition-colors border-2 border-line ${chartPage === 0 ? 'bg-brand' : 'bg-surface'}`} />
              <button onClick={() => setChartPage(1)} className={`w-3 h-3 rounded-full transition-colors border-2 border-line ${chartPage === 1 ? 'bg-brand' : 'bg-surface'}`} />
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-base/80 backdrop-blur-md border-t-4 border-line z-40">
        <div className="max-w-2xl mx-auto flex">
          <button 
            onClick={() => router.back()} 
            className="w-full p-5 bg-surface border-4 border-line text-main font-black uppercase tracking-widest shadow-[4px_4px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-2 outline-none"
          >
            <ChevronLeft size={24}/> TORNA ALLO STORICO
          </button>
        </div>
      </div>

      {editingExIndex !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col justify-end animate-in fade-in duration-200">
          <div className="bg-base w-full border-t-4 border-line p-6 flex flex-col gap-6 shadow-[0px_-8px_0px_rgba(0,0,0,1)] animate-in slide-in-from-bottom-full duration-300 max-h-[85vh]">
            
            <div className="flex justify-between items-center border-b-4 border-line pb-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-brand uppercase tracking-widest border-2 border-brand bg-brand/10 w-fit px-2 py-0.5">Correzione</span>
                <h2 className="font-heading text-2xl font-black text-main uppercase tracking-tighter leading-none line-clamp-1">{exercises[editingExIndex].nome}</h2>
              </div>
              <button onClick={() => setEditingExIndex(null)} className="w-10 h-10 shrink-0 bg-surface flex items-center justify-center border-2 border-line shadow-[2px_2px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                <X size={20} strokeWidth={3} className="text-main" />
              </button>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto pb-4">
              {localEditedSets.map((set, sIdx) => (
                <div key={sIdx} className="flex items-center gap-4 bg-surface border-2 border-line p-3">
                  <div className="font-heading text-xl font-black text-muted w-6 text-center">{sIdx + 1}.</div>
                  
                  <div className="flex-1 flex gap-2">
                    <div className="flex-1 flex flex-col gap-1">
                      <span className="text-[9px] font-black uppercase text-muted tracking-widest">Peso ({exercises[editingExIndex].unita_misura})</span>
                      <input 
                        type="number" 
                        value={set.weight} 
                        onChange={(e) => handleLocalSetUpdate(sIdx, 'weight', e.target.value)} 
                        className="w-full bg-base border-2 border-line p-2 font-bold text-center outline-none focus:border-brand"
                      />
                    </div>
                    
                    <div className="flex items-center pt-5">
                      <X size={16} className="text-muted/50" />
                    </div>

                    <div className="flex-1 flex flex-col gap-1">
                      <span className="text-[9px] font-black uppercase text-muted tracking-widest">Reps</span>
                      <input 
                        type="number" 
                        value={set.reps} 
                        onChange={(e) => handleLocalSetUpdate(sIdx, 'reps', e.target.value)} 
                        className="w-full bg-base border-2 border-line p-2 font-bold text-center outline-none focus:border-brand"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={saveEdits}
              disabled={isSavingEdits}
              className="w-full py-5 bg-brand border-2 border-line text-base font-black uppercase tracking-widest shadow-[4px_4px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex justify-center items-center gap-2 mt-auto"
            >
              {isSavingEdits ? <CleanSpinner size={24} /> : <><CheckCircle2 size={24} strokeWidth={3} /> SALVA CORREZIONE E RICALCOLA</>}
            </button>
          </div>
        </div>
      )}

    </main>
  );
}

// === COMPONENTE CONTENITORE CON SUSPENSE ===
export default function SessionDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-base text-main font-black uppercase tracking-widest">
        Caricamento...
      </div>
    }>
      <SessionDetailContent />
    </Suspense>
  );
}