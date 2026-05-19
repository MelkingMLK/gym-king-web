"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Trophy, BarChart3, ListOrdered, Zap, Coffee, Trash2, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "../../lib/supabase";

const LOCAL_STORAGE_KEY = "gymking_active_workout";

// === SPINNER ===
const CleanSpinner = ({ size = 24 }: { size?: number }) => {
  return (
    <div style={{ width: size, height: size, position: 'relative', color: "currentColor" }}>
      <style>{`@keyframes cleanSpinnerRotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } .spinner-ring { box-sizing: border-box; display: block; position: absolute; width: 100%; height: 100%; border: ${size! * 0.15}px solid currentColor; border-radius: 50%; animation: cleanSpinnerRotate 1s cubic-bezier(0.5, 0, 0.5, 1) infinite; border-color: currentColor transparent transparent transparent; } .spinner-ring-track { box-sizing: border-box; display: block; position: absolute; width: 100%; height: 100%; border: ${size! * 0.15}px solid currentColor; border-radius: 50%; opacity: 0.15; }`}</style>
      <div className="spinner-ring-track"></div>
      <div className="spinner-ring"></div>
    </div>
  );
};

// === TIPI DATI ===
type SetData = { 
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
  recupero_sec: number; 
  sets: SetData[]; 
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
      const isDone = ex.sets.some(s => s.completed);
      const total = work + rest + waste;
      totalWorkoutSec += total;
      
      // Usa id_scheda_esercizio o fallback casuale per compatibilità tra le due view
      const uniqueId = 'id_scheda_esercizio' in ex ? ex.id_scheda_esercizio : ex.id_esercizio + Math.random().toString();
      
      return { 
        id: uniqueId,
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
                {/* Esercizio saltato: grigio ardesia */}
                <path d={generateArcPath(startAngle, endAngle, chartRadius * 0.15)} fill="#94a3b8" stroke="#1a1a1a" strokeWidth="1.5" />
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
              {/* Tempo Perso: Rosso */}
              <path d={generateArcPath(startAngle, endAngle, rTotal)} fill="#ff331f" stroke="#1a1a1a" strokeWidth="1.5" /> 
              {/* Recupero: Giallo */}
              <path d={generateArcPath(startAngle, endAngle, rRestWork)} fill="#ffde59" stroke="#1a1a1a" strokeWidth="1.5" /> 
              {/* Sforzo (TUT): Verde Acido */}
              <path d={generateArcPath(startAngle, endAngle, rWork)} fill="#ccff00" stroke="#1a1a1a" strokeWidth="1.5" /> 

              <text x={tx} y={ty} transform={`rotate(${rotation}, ${tx}, ${ty})`} textAnchor={anchor} alignmentBaseline="middle" fontSize="14" fontWeight="900" fontFamily="sans-serif" className="uppercase tracking-tighter fill-main">
                {shortName}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-8 w-full text-[10px] font-black uppercase tracking-tighter border-t-2 border-line pt-4 bg-surface">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#ccff00] border-2 border-line shrink-0"></div><Zap size={10} className="text-muted"/> TUT (Sforzo)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#ffde59] border-2 border-line shrink-0"></div><Coffee size={10} className="text-muted"/> Recupero</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#ff331f] border-2 border-line shrink-0"></div><Trash2 size={10} className="text-muted"/> Tempo Perso</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#94a3b8] border-2 border-line shrink-0"></div> Saltato</div>
      </div>
    </div>
  );
};

export default function WorkoutSummaryPage() {
  const router = useRouter();
  const [workoutName, setWorkoutName] = useState<string>("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);
  const [totalTime, setTotalTime] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"riepilogo" | "analisi">("riepilogo");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setWorkoutName(parsed.workoutName || "Allenamento");
      setExercises(parsed.exercises || []);
      setStartTime(parsed.startTime || null);
      
      if (parsed.startTime) {
        if (parsed.endTime) {
          setTotalTime(Math.floor((parsed.endTime - parsed.startTime) / 1000));
        } else {
          const currentEnd = Date.now();
          setTotalTime(Math.floor((currentEnd - parsed.startTime) / 1000));
          parsed.endTime = currentEnd;
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
        }
      }
    } else {
      router.push("/start-workout");
    }
  }, [router]);

  const startDateTime = useMemo(() => {
    if (!startTime) return "";
    const d = new Date(startTime);
    const dateStr = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    const timeStr = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(d);
    return `${dateStr} - ${timeStr}`;
  }, [startTime]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const handleGoBack = () => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      delete parsed.endTime; 
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
    }
    router.back();
  };

  // === LOGICA INSERIMENTO DB RIVISITATA ===
  const handleFinalSave = async () => {
    if (!startTime || !totalTime) return;
    setIsSaving(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Autenticazione richiesta.");

      const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!savedData) throw new Error("Dati in locale non trovati.");
      const parsed = JSON.parse(savedData);

      // 1. INSERIMENTO MASTER
      const { data: sessionData, error: sessionError } = await supabase
        .from('Storico_Allenamenti')
        .insert([{
          user_id: user.id,
          id_template: parsed.templateId || null,
          id_giorno: parsed.dayId || null,
          nome_allenamento: parsed.workoutName || "Allenamento Libero",
          inizio_ts: new Date(startTime).toISOString(),
          fine_ts: new Date(parsed.endTime || Date.now()).toISOString(),
          durata_totale_sec: totalTime
        }])
        .select('id_sessione')
        .single();

      if (sessionError) throw sessionError;
      const idSessione = sessionData.id_sessione;

      // 2. PARSING E MAP DELLE SERIE TRANSAZIONALI
      const payloadSerie: any[] = [];
      let ord_es = 1;

      parsed.exercises.forEach((ex: ExerciseLog) => {
        let hasValidSets = false;
        
        ex.sets.forEach((set: SetData, idx: number) => {
          if (set.completed) {
            hasValidSets = true;
            payloadSerie.push({
              id_sessione: idSessione,
              id_esercizio: ex.id_esercizio,
              ordine_esercizio: ord_es,
              ordine_serie: idx + 1,
              reps: set.reps,
              weight: set.weight,
              work_duration_sec: set.workDurationSec || 0,
              actual_rest_sec: set.actualRestSec || 0,
              waste_duration_sec: set.wasteDurationSec || 0,
              completata_il: set.completedAt ? new Date(set.completedAt).toISOString() : new Date().toISOString()
            });
          }
        });
        
        if (hasValidSets) ord_es++;
      });

      // 3. BULK INSERT SERIE
      if (payloadSerie.length > 0) {
        const { error: batchError } = await supabase.from('Storico_Serie').insert(payloadSerie);
        if (batchError) throw batchError;
      }

      // 4. CLEANUP E REDIRECT
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      router.push("/");

    } catch (err: any) {
      console.error(err);
      alert("Errore letale nel salvataggio: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-base p-4 pb-28 pt-8">
      
      <div className="w-full max-w-2xl text-center mb-8">
        <div className="inline-block p-4 bg-brand border-4 border-line shadow-[6px_6px_0px_#000000] mb-4">
          <Trophy size={40} />
        </div>
        <h1 className="font-heading text-4xl md:text-5xl font-black uppercase text-main leading-tight mb-2 break-words">
          {workoutName}
        </h1>
        <p className="text-xs font-black text-muted uppercase tracking-widest bg-surface border-2 border-line inline-block px-3 py-1">
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

            {(() => {
              const completati = exercises
                .filter(ex => ex.sets.some(s => s.completed))
                .sort((a, b) => {
                  const firstA = Math.min(...a.sets.filter(s => s.completed && s.completedAt).map(s => s.completedAt || Infinity));
                  const firstB = Math.min(...b.sets.filter(s => s.completed && s.completedAt).map(s => s.completedAt || Infinity));
                  return (firstA === Infinity ? 0 : firstA) - (firstB === Infinity ? 0 : firstB);
                });

              const saltati = exercises.filter(ex => !ex.sets.some(s => s.completed));
              const listaOrdinata = [...completati, ...saltati];

              return listaOrdinata.map((ex, idx) => {
                const isCompleted = ex.sets.some(s => s.completed);
                const completedSets = ex.sets.filter(s => s.completed);
                const exTotalTime = ex.sets.reduce((acc, s) => acc + (s.workDurationSec || 0) + (s.actualRestSec || 0) + (s.wasteDurationSec || 0), 0);

                if (!isCompleted) {
                  return (
                    <div key={idx} className="bg-surface border-4 border-line shadow-[4px_4px_0px_#000000] overflow-hidden opacity-30 select-none transition-opacity">
                      <div className="bg-black text-white p-3 flex justify-between items-center border-b-2 border-line">
                        <span className="font-heading text-lg font-black uppercase truncate max-w-[70%]">{ex.nome}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest border border-white/30 px-2 py-0.5 bg-white/10">Saltato</span>
                      </div>
                    </div>
                  );
                }

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
                      {completedSets.map((set, sIdx) => (
                        <div key={sIdx} className="bg-surface text-main border-2 border-line px-3 py-1 font-bold text-sm shadow-[2px_2px_0px_#000000]">
                          {set.weight}kg x {set.reps}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        ) : (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
             <NightingaleRoseChart exercises={exercises} />
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-base/80 backdrop-blur-md border-t-4 border-line z-50">
        <div className="max-w-2xl mx-auto flex gap-4">
          <button onClick={handleGoBack} disabled={isSaving} className="p-4 bg-surface border-4 border-line shadow-[4px_4px_0px_#000000] hover:bg-base transition-colors active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-main"><ChevronLeft/></button>
          <button 
            onClick={handleFinalSave}
            disabled={isSaving}
            className="flex-1 py-4 bg-brand border-4 border-line text-base font-black uppercase tracking-widest shadow-[4px_4px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSaving ? <CleanSpinner size={20}/> : <><CheckCircle2 size={20}/> CONFERMA E SALVA</>}
          </button>
        </div>
      </div>

    </main>
  );
}