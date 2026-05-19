"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft, Trophy, BarChart3, ListOrdered, Zap, Coffee, Trash2, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";

// === SPINNER MINIMALISTA RIPRISTINATO ===
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
  reps: string; 
  weight: string; 
  completed: boolean; 
  workDurationSec: number; 
  actualRestSec: number; 
  wasteDurationSec: number; 
  completedAt: number;
};

type ExerciseLog = { 
  id_esercizio: number; 
  nome: string; 
  sets: SetData[]; 
};

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
      const isDone = ex.sets.some(s => s.completed);
      const total = work + rest + waste;
      totalWorkoutSec += total;
      return { 
        id: ex.id_esercizio + Math.random().toString(),
        nome: ex.nome, 
        work, rest, waste, total, isDone 
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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  if (numExercises === 0) return <div className="text-center font-black uppercase text-muted py-10">Nessun dato grafico.</div>;

  return (
    <div className="flex flex-col items-center bg-surface border-4 border-line p-4 shadow-[8px_8px_0px_#000000] relative w-full">
      <div className="absolute top-4 right-4 z-20 bg-base border-2 border-line p-2 shadow-[2px_2px_0px_#000000] flex flex-col items-end">
          <span className="text-[9px] font-black uppercase text-muted tracking-tighter leading-none mb-1">Total TUT</span>
          <span className="font-heading text-xl font-black text-brand leading-none tabular-nums text-main">
            {formatTime(chartData.reduce((acc,d)=> acc+d.work, 0))}
          </span>
      </div>

      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[450px] drop-shadow-md mt-16">
        <circle cx={center} cy={center} r={chartRadius} fill="none" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="5 5" />
        <circle cx={center} cy={center} r={chartRadius * 0.66} fill="none" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="5 5" />
        <circle cx={center} cy={center} r={chartRadius * 0.33} fill="none" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="5 5" />

        {chartData.map((d, i) => {
          const startAngle = i * angleStep - Math.PI / 2;
          const endAngle = (i + 1) * angleStep - Math.PI / 2;
          const midAngle = startAngle + angleStep / 2; 

          const textRadius = chartRadius + 15; 
          let rotation = (midAngle * 180) / Math.PI;
          let anchor: "start" | "end" = "start";
          
          if (rotation > 90 || rotation < -90) {
            rotation += 180;
            anchor = "end";
          }
          const tx = center + textRadius * Math.cos(midAngle);
          const ty = center + textRadius * Math.sin(midAngle);

          const shortName = d.nome.length > 14 ? d.nome.substring(0, 13) + '.' : d.nome;

          if (!d.isDone) {
            return (
              <g key={d.id}>
                <path d={generateArcPath(startAngle, endAngle, chartRadius * 0.15)} fill="#000000" stroke="#fff" strokeWidth="1" />
                <text x={tx} y={ty} transform={`rotate(${rotation}, ${tx}, ${ty})`} textAnchor={anchor} alignmentBaseline="middle" fontSize="14" fontWeight="900" fontFamily="sans-serif" className="uppercase tracking-tighter fill-muted/50">
                  {shortName}
                </text>
              </g>
            );
          }
          
          const rTotal = (d.total / maxTotalTime) * chartRadius;
          const rRestWork = ((d.work + d.rest) / maxTotalTime) * chartRadius;
          const rWork = (d.work / maxTotalTime) * chartRadius;

          return (
            <g key={d.id}>
              <path d={generateArcPath(startAngle, endAngle, rTotal)} fill="#ff331f" stroke="#fff" strokeWidth="1" /> 
              <path d={generateArcPath(startAngle, endAngle, rRestWork)} fill="#94a3b8" stroke="#fff" strokeWidth="1" /> 
              <path d={generateArcPath(startAngle, endAngle, rWork)} fill="#804CD9" stroke="#fff" strokeWidth="1" /> 

              <text x={tx} y={ty} transform={`rotate(${rotation}, ${tx}, ${ty})`} textAnchor={anchor} alignmentBaseline="middle" fontSize="14" fontWeight="900" fontFamily="sans-serif" className="uppercase tracking-tighter fill-main">
                {shortName}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-8 w-full text-[10px] font-black uppercase tracking-tighter border-t-2 border-line pt-4 bg-surface">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#804CD9] border border-black shrink-0"></div><Zap size={10} className="text-muted"/> TUT (Sforzo)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#94a3b8] border border-black shrink-0"></div><Coffee size={10} className="text-muted"/> Recupero</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#ff331f] border border-black shrink-0"></div><Trash2 size={10} className="text-muted"/> Tempo Perso</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#000000] border border-black shrink-0"></div> Saltato</div>
      </div>
    </div>
  );
};

export default function SessionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [workoutName, setWorkoutName] = useState<string>("Allenamento");
  const [startDateTime, setStartDateTime] = useState<string>("");
  const [totalTime, setTotalTime] = useState<number>(0);
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);
  const [activeTab, setActiveTab] = useState<"riepilogo" | "analisi">("riepilogo");

  useEffect(() => {
    if (!sessionId) return;

    const fetchSessionData = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase
          .from('Storico_Allenamenti')
          .select('nome_allenamento, inizio_ts, durata_totale_sec')
          .eq('id_sessione', sessionId)
          .single();

        if (sessionError) throw sessionError;

        setWorkoutName(sessionData.nome_allenamento);
        setTotalTime(sessionData.durata_totale_sec);
        
        const d = new Date(sessionData.inizio_ts);
        const dateStr = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
        const timeStr = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(d);
        setStartDateTime(`${dateStr} - ${timeStr}`);

        const { data: seriesData, error: seriesError } = await supabase
          .from('Storico_Serie')
          .select('*, Esercizi(nome)')
          .eq('id_sessione', sessionId)
          .order('ordine_esercizio')
          .order('ordine_serie');

        if (seriesError) throw seriesError;

        const exerciseMap = new Map<number, ExerciseLog>();

        seriesData.forEach((row: any) => {
          if (!exerciseMap.has(row.ordine_esercizio)) {
            exerciseMap.set(row.ordine_esercizio, {
              id_esercizio: row.id_esercizio,
              nome: row.Esercizi?.nome || 'Esercizio Sconosciuto',
              sets: []
            });
          }
          
          exerciseMap.get(row.ordine_esercizio)!.sets.push({
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

      } catch (error) {
        console.error("Errore recupero sessione:", error);
        alert("Errore nel caricamento dei dati di sessione.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessionData();
  }, [sessionId]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  if (isLoading) return <main className="flex min-h-screen items-center justify-center bg-base text-main"><CleanSpinner size={64} /></main>;

  return (
    <main className="flex min-h-screen flex-col items-center bg-base p-4 pb-28 pt-8">
      
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
          className={`flex-1 py-4 flex items-center justify-center gap-2.5 font-black uppercase tracking-widest text-xs transition-all ${activeTab === "riepilogo" ? 'bg-main text-base' : 'bg-surface text-main hover:bg-base/50'}`}
        >
          <ListOrdered size={18} /> Riepilogo
        </button>
        <button 
          onClick={() => setActiveTab("analisi")}
          className={`flex-1 py-4 flex items-center justify-center gap-2.5 font-black uppercase tracking-widest text-xs transition-all ${activeTab === "analisi" ? 'bg-main text-base' : 'bg-surface text-main hover:bg-base/50'}`}
        >
          <BarChart3 size={18} /> Analisi Tempi
        </button>
      </div>

      <div className="w-full max-w-2xl flex-1">
        {activeTab === "riepilogo" ? (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
            
            <div className="bg-surface border-4 border-line p-4 shadow-[6px_6px_0px_#000000] flex justify-between items-center text-main">
              <div className="flex items-center gap-2">
                <Clock className="text-brand" size={24} strokeWidth={3} />
                <span className="font-heading text-lg font-black uppercase tracking-tight leading-none pt-1">Tempo<br/>Totale</span>
              </div>
              <span className="font-mono text-xl font-black bg-brand text-base border-2 border-line px-4 py-2 shadow-[2px_2px_0px_#000000]">
                {formatTime(totalTime)}
              </span>
            </div>

            {exercises.map((ex, idx) => {
              const exTotalTime = ex.sets.reduce((acc, s) => acc + s.workDurationSec + s.actualRestSec + s.wasteDurationSec, 0);

              return (
                <div key={idx} className="bg-surface border-4 border-line shadow-[6px_6px_0px_#000000] overflow-hidden">
                  <div className="bg-main p-3 flex justify-between items-center border-b-4 border-line">
                    <span className="font-heading text-lg font-black uppercase text-base truncate max-w-[75%]">{ex.nome}</span>
                    <div className="flex items-center gap-1.5 bg-base text-main border-2 border-line px-2.5 py-0.5 text-xs font-mono font-black shadow-[2px_2px_0px_#000000] shrink-0">
                      <Clock size={12} className="text-brand"/>
                      {formatTime(exTotalTime)}
                    </div>
                  </div>
                  <div className="p-4 flex flex-wrap gap-2.5 bg-base/50">
                    {ex.sets.map((set, sIdx) => (
                      <div key={sIdx} className="bg-surface text-main border-2 border-line px-3 py-1 font-bold text-sm shadow-[2px_2px_0px_#000000]">
                        {set.weight}kg x {set.reps}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
             <NightingaleRoseChart exercises={exercises} />
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-base/80 backdrop-blur-md border-t-4 border-line z-50">
        <div className="max-w-2xl mx-auto flex">
          <button 
            onClick={() => router.back()} 
            className="w-full p-5 bg-surface border-4 border-line text-main font-black uppercase tracking-widest shadow-[4px_4px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-2"
          >
            <ChevronLeft size={24}/> TORNA ALLO STORICO
          </button>
        </div>
      </div>

    </main>
  );
}