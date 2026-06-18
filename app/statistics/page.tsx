"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Calendar, Clock, Dumbbell, ChevronRight, X, Activity, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";

const CleanSpinner = ({ size = 24 }: { size?: number }) => {
  return (
    <div style={{ width: size, height: size, position: 'relative', color: "currentColor", margin: "0 auto" }}>
      <style>{`@keyframes cleanSpinnerRotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } .spinner-ring { box-sizing: border-box; display: block; position: absolute; width: 100%; height: 100%; border: ${size * 0.15}px solid currentColor; border-radius: 50%; animation: cleanSpinnerRotate 1s cubic-bezier(0.5, 0, 0.5, 1) infinite; border-color: currentColor transparent transparent transparent; } .spinner-ring-track { box-sizing: border-box; display: block; position: absolute; width: 100%; height: 100%; border: ${size * 0.15}px solid currentColor; border-radius: 50%; opacity: 0.15; }`}</style>
      <div className="spinner-ring-track"></div>
      <div className="spinner-ring"></div>
    </div>
  );
};

// Aggiunto campo unita_misura
type SerieStorico = { weight: string; reps: string; id_esercizio: number; unita_misura?: string; };
type SessioneStorico = { 
  id_sessione: string; 
  nome_allenamento: string; 
  inizio_ts: string; 
  durata_totale_sec: number; 
  id_template: string | null;
  Storico_Serie?: SerieStorico[];
  Template_Schede?: { nome_template: string };
};

// === COMPONENTE HEATMAP (CSS Grid Rigida + Stato Indipendente) ===
const WorkoutHeatmap = ({ storico, availableYears }: { storico: SessioneStorico[], availableYears: number[] }) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const { matrix, monthLabels, totalInPeriod } = useMemo(() => {
    let total = 0;
    const labels: { year: number, month: number, label: string, initial: string }[] = [];
    
    for (let i = 0; i < 12; i++) {
      const d = new Date(selectedYear, i, 1);
      const fullMonthName = d.toLocaleString('it-IT', { month: 'long' });
      labels.push({ 
        year: d.getFullYear(), 
        month: d.getMonth(), 
        label: fullMonthName,
        initial: fullMonthName.charAt(0).toUpperCase() 
      });
    }

    const rows = Array.from({ length: 5 }, () => Array(12).fill(0));

    storico.forEach(s => {
      const d = new Date(s.inizio_ts);
      if (d.getFullYear() !== selectedYear) return;
      const m = d.getMonth();
      const w = Math.floor((d.getDate() - 1) / 7);

      if (w >= 0 && w < 5) {
        rows[w][m]++;
        total++;
      }
    });

    return { matrix: rows, monthLabels: labels, totalInPeriod: total };
  }, [storico, selectedYear]);

  return (
    <div className="bg-surface border-4 border-line p-5 shadow-[8px_8px_0px_#000000] flex flex-col gap-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b-4 border-line pb-4 gap-4">
        <div className="flex items-center gap-2">
          <Activity size={24} strokeWidth={3} className="text-brand" />
          <h2 className="font-heading text-xl font-black uppercase text-main tracking-tighter leading-none">
            {totalInPeriod} Workout nel {selectedYear}
          </h2>
        </div>
        <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
          {availableYears.map(y => (
            <button key={y} onClick={() => setSelectedYear(y)} className={`px-3 py-1 font-black uppercase text-xs border-2 border-line shadow-[2px_2px_0px_#000000] shrink-0 transition-colors outline-none ${selectedYear === y ? 'bg-brand text-base translate-x-[2px] translate-y-[2px] shadow-none' : 'bg-surface text-main hover:bg-base'}`}>
              {y}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex flex-col gap-1.5 md:gap-2">
        <div className="grid grid-cols-12 gap-1.5 md:gap-2">
          {monthLabels.map((m, i) => (
            <div key={i} title={m.label.toUpperCase()} className="flex items-center justify-center text-xs md:text-sm font-black uppercase text-main cursor-help">
              {m.initial}
            </div>
          ))}
        </div>
        
        {matrix.map((row, wIdx) => (
          <div key={wIdx} className="grid grid-cols-12 gap-1.5 md:gap-2">
            {row.map((cellCount, cIdx) => {
              let bgClass = "bg-line/10 border-2 border-line/20"; 
              if (cellCount === 1) bgClass = "bg-brand/30 border-2 border-brand/40";
              if (cellCount === 2 || cellCount === 3) bgClass = "bg-brand/70 border-2 border-brand/80";
              if (cellCount === 4) bgClass = "bg-brand border-2 border-line";
              if (cellCount >= 5) bgClass = "bg-[#ff331f] border-2 border-line shadow-[2px_2px_0px_#000000]"; 

              const isFebruary = monthLabels[cIdx].month === 1;
              const isLeap = new Date(selectedYear, 1, 29).getDate() === 29;
              
              if (wIdx === 4 && isFebruary && !isLeap) {
                return <div key={cIdx} className="aspect-square opacity-0 pointer-events-none" />;
              }

              return (
                <div key={cIdx} title={`${monthLabels[cIdx].label.toUpperCase()}: ${cellCount} Workout`} className={`aspect-square rounded-[2px] ${bgClass} transition-colors hover:border-main cursor-crosshair`} />
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex justify-end items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted mt-2 border-t-2 border-line pt-3">
        <span>Less</span>
        <div className="w-3 h-3 md:w-4 md:h-4 rounded-[2px] bg-line/10 border-2 border-line/20"></div>
        <div className="w-3 h-3 md:w-4 md:h-4 rounded-[2px] bg-brand/30 border-2 border-brand/40"></div>
        <div className="w-3 h-3 md:w-4 md:h-4 rounded-[2px] bg-brand/70 border-2 border-brand/80"></div>
        <div className="w-3 h-3 md:w-4 md:h-4 rounded-[2px] bg-brand border-2 border-line"></div>
        <div className="w-3 h-3 md:w-4 md:h-4 rounded-[2px] bg-[#ff331f] border-2 border-line"></div>
        <span>More</span>
      </div>
    </div>
  );
};

// === COMPONENTE GRAFICO A LINEE ===
const WeightProgressionChart = ({ storico, availableYears }: { storico: SessioneStorico[], availableYears: number[] }) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  const chartHeight = 220;
  const padding = { top: 20, right: 15, bottom: 30, left: 50 };
  const COLORS = ["#10b981", "#804CD9", "#ff914d", "#3366ff", "#ff331f"];

  const { chartLines, yMin, yMax, monthInitials } = useMemo(() => {
    const templateData: Record<string, { name: string, weeks: Record<number, { totalWeight: number, sessionCount: number }> }> = {};
    
    const initials = [];
    for (let i = 0; i < 12; i++) {
      initials.push(new Date(selectedYear, i, 1).toLocaleString('it-IT', { month: 'long' }).charAt(0).toUpperCase());
    }

    const yearStart = new Date(selectedYear, 0, 1).getTime();
    const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59).getTime();
    const yearDuration = yearEnd - yearStart;

    storico.forEach(s => {
      const sessionDate = new Date(s.inizio_ts);
      if (sessionDate.getFullYear() !== selectedYear) return;
      if (!s.id_template || !s.Storico_Serie || s.Storico_Serie.length === 0) return;

      const exMaxWeight: Record<number, number> = {};
      s.Storico_Serie.forEach(set => {
        let w = parseFloat(set.weight) || 0;
        
        // NORMALIZZAZIONE SCALARE ALLA FONTE
        if (set.unita_misura === 'LBS') {
          w = w * 0.45359237;
        }

        if (w > (exMaxWeight[set.id_esercizio] || 0)) exMaxWeight[set.id_esercizio] = w;
      });
      const sessionLoad = Object.values(exMaxWeight).reduce((sum, w) => sum + w, 0);

      const d = new Date(s.inizio_ts);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const mondayTs = new Date(d.setDate(diff)).setHours(0, 0, 0, 0);

      if (!templateData[s.id_template]) {
        templateData[s.id_template] = { name: s.Template_Schede?.nome_template || "Template", weeks: {} };
      }
      if (!templateData[s.id_template].weeks[mondayTs]) {
        templateData[s.id_template].weeks[mondayTs] = { totalWeight: 0, sessionCount: 0 };
      }
      templateData[s.id_template].weeks[mondayTs].totalWeight += sessionLoad;
      templateData[s.id_template].weeks[mondayTs].sessionCount += 1;
    });

    let minWeight = Infinity;
    let maxWeight = -Infinity;

    const lines = Object.entries(templateData).map(([id, t], index) => {
      const points = Object.entries(t.weeks).map(([ts, data]) => {
        const avgKg = data.totalWeight / data.sessionCount;
        const relativeX = (Number(ts) - yearStart) / yearDuration; 
        
        if (avgKg < minWeight) minWeight = avgKg;
        if (avgKg > maxWeight) maxWeight = avgKg;

        return { x: relativeX, kg: avgKg };
      }).sort((a, b) => a.x - b.x);

      return { id, name: t.name, color: COLORS[index % COLORS.length], points };
    }).filter(l => l.points.length > 0);

    const finalYMax = maxWeight === -Infinity ? 100 : Math.ceil(maxWeight / 10) * 10 + 10;
    const finalYMin = minWeight === Infinity ? 0 : Math.max(0, Math.floor(minWeight / 10) * 10 - 10);

    return { chartLines: lines, yMin: finalYMin, yMax: finalYMax, monthInitials: initials };
  }, [storico, selectedYear]);

  return (
    <div className="bg-surface border-4 border-line p-5 shadow-[8px_8px_0px_#000000] flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b-4 border-line pb-4 gap-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={24} strokeWidth={3} className="text-brand" />
          <h2 className="font-heading text-xl font-black uppercase text-main tracking-tighter leading-none">Analisi Pesi</h2>
        </div>
        <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
          {availableYears.map(y => (
            <button key={y} onClick={() => setSelectedYear(y)} className={`px-3 py-1 font-black uppercase text-xs border-2 border-line shadow-[2px_2px_0px_#000000] shrink-0 transition-colors outline-none ${selectedYear === y ? 'bg-brand text-base translate-x-[2px] translate-y-[2px] shadow-none' : 'bg-surface text-main hover:bg-base'}`}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {chartLines.length === 0 ? (
        <div className="h-44 border-2 border-dashed border-line flex flex-col items-center justify-center text-center p-4">
          <TrendingUp size={28} className="text-muted opacity-40 mb-1" />
          <span className="text-muted font-black uppercase tracking-widest text-[10px]">Nessun dato per il {selectedYear}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-4 w-full">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1">
            {chartLines.map((line, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-main">
                <div className="w-2.5 h-2.5 border border-line shrink-0" style={{ backgroundColor: line.color }} />
                {line.name}
              </div>
            ))}
          </div>

          <div className="w-full relative bg-base border-2 border-line shadow-[4px_4px_0px_#000000] p-2">
            <svg viewBox={`0 0 400 ${chartHeight}`} className="w-full h-auto block font-sans overflow-visible">
              {[yMin, yMax].map((val, i) => {
                const y = padding.top + (chartHeight - padding.top - padding.bottom) - ((val - yMin) / (yMax - yMin)) * (chartHeight - padding.top - padding.bottom);
                return (
                  <g key={i}>
                    <line x1={padding.left} y1={y} x2={400 - padding.right} y2={y} stroke="var(--color-line)" strokeOpacity="0.1" strokeWidth={1} />
                    <text x={padding.left - 5} y={y} textAnchor="end" alignmentBaseline="middle" fontSize="10" fontWeight="900" fill="var(--color-muted)">{Math.round(val)}</text>
                  </g>
                );
              })}

              {monthInitials.map((initial, i) => {
                const x = padding.left + (i / 11) * (400 - padding.left - padding.right);
                return (
                  <g key={i}>
                    <line x1={x} y1={padding.top} x2={x} y2={chartHeight - padding.bottom} stroke="var(--color-line)" strokeOpacity="0.05" />
                    <text x={x} y={chartHeight - padding.bottom + 15} textAnchor="middle" fontSize="10" fontWeight="900" fill="var(--color-main)">{initial}</text>
                  </g>
                );
              })}

              {chartLines.map((line) => {
                const points = line.points.map(p => {
                  const xPos = padding.left + p.x * (400 - padding.left - padding.right);
                  const yPos = padding.top + (chartHeight - padding.top - padding.bottom) - ((p.kg - yMin) / (yMax - yMin)) * (chartHeight - padding.top - padding.bottom);
                  return { x: xPos, y: yPos };
                });

                const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(" ");

                return (
                  <g key={line.id}>
                    <path d={pathData} fill="none" stroke={line.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                    {points.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={line.color} stroke="var(--color-base)" strokeWidth="1.5" />
                    ))}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

// === COMPONENTE PRINCIPALE STATISTICS ===
// === COMPONENTE PRINCIPALE STATISTICS ===
export default function StatisticsPage() {
  const router = useRouter();
  const [storico, setStorico] = useState<SessioneStorico[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);

  const availableYears = useMemo(() => {
    const years = Array.from(new Set(storico.map(s => new Date(s.inizio_ts).getFullYear())));
    if (!years.includes(new Date().getFullYear())) years.push(new Date().getFullYear());
    return years.sort((a, b) => b - a);
  }, [storico]);

  useEffect(() => {
    const fetchStorico = async () => {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data, error } = await supabase
          .from('Storico_Allenamenti')
          .select(`id_sessione, nome_allenamento, inizio_ts, durata_totale_sec, id_template, Template_Schede ( nome_template ), Storico_Serie ( weight, reps, id_esercizio, unita_misura )`)
          .eq('user_id', user.id)
          .order('inizio_ts', { ascending: false })
          .limit(2000);
          
        if (error) throw error;
        if (data) setStorico(data as unknown as SessioneStorico[]);
      } catch (err) { console.error(err); } finally { setIsLoading(false); }
    };
    fetchStorico();
  }, []);

  const groupedStorico = useMemo(() => {
    const groups: { [key: string]: { ts: number, sessions: SessioneStorico[] } } = {};
    storico.forEach(s => {
      const date = new Date(s.inizio_ts);
      const day = date.getDay();
      const monday = new Date(date.setDate(date.getDate() - day + (day === 0 ? -6 : 1))).setHours(0,0,0,0);
      if (!groups[monday]) groups[monday] = { ts: monday, sessions: [] };
      groups[monday].sessions.push(s);
    });
    return Object.values(groups).sort((a, b) => b.ts - a.ts);
  }, [storico]);

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
    <main className="flex min-h-screen flex-col items-center pt-12 px-4 pb-20 relative bg-base transition-colors">
      
      <div className="w-full max-w-2xl flex justify-between items-center mb-6 relative z-10">
        <Link href="/"><div className="w-12 h-12 bg-surface flex items-center justify-center border-2 border-line shadow-[4px_4px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all"><ChevronLeft className="text-main" size={24} strokeWidth={3} /></div></Link>
        <h1 className="font-heading text-3xl font-black uppercase text-main tracking-tighter absolute left-1/2 -translate-x-1/2">Statistiche</h1>
        <div className="w-12 h-12" />
      </div>

      <div className="w-full max-w-2xl flex flex-col gap-6">
        {isLoading ? (
          <div className="flex justify-center py-20"><CleanSpinner size={48} /></div>
        ) : (
          <>
            {/* === NUOVO BANNER STORICO (UI Ridisegnata) === */}
            <button 
              onClick={() => setIsHistorySheetOpen(true)} 
              className="w-full bg-surface border-4 border-line p-4 flex justify-between items-center shadow-[6px_6px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all group outline-none"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-brand border-2 border-line flex items-center justify-center shadow-[2px_2px_0px_#000000]">
                  <Dumbbell size={24} className="text-base" strokeWidth={3}/>
                </div>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-heading text-xl font-black uppercase tracking-tighter text-main leading-none">Storico Allenamenti</span>

                </div>
              </div>
              <ChevronRight size={28} strokeWidth={3} className="text-line/30 group-hover:text-main transition-colors" />
            </button>

            <WorkoutHeatmap storico={storico} availableYears={availableYears} />
            <WeightProgressionChart storico={storico} availableYears={availableYears} />
          </>
        )}
      </div>

      {isHistorySheetOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col justify-end animate-in fade-in duration-200">
          <div className="bg-base w-full h-[90vh] border-t-4 border-line flex flex-col shadow-[0px_-8px_0px_rgba(0,0,0,1)] animate-in slide-in-from-bottom-full duration-300">
            <div className="flex justify-between items-center p-6 border-b-4 border-line bg-surface shrink-0">
              <div className="flex items-center gap-3"><Dumbbell size={28} className="text-brand" /><h2 className="font-heading text-2xl font-black uppercase tracking-tighter">Dossier Allenamenti</h2></div>
              <button onClick={() => setIsHistorySheetOpen(false)} className="w-12 h-12 bg-base border-4 border-line shadow-[4px_4px_0px_#000000] flex items-center justify-center outline-none active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"><X size={24} strokeWidth={3}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {groupedStorico.map((week) => (
                <div key={week.ts} className="relative bg-base border-4 border-line p-4 pt-6 shadow-[8px_8px_0px_#000000] flex flex-col gap-4">
                  <div className="absolute -top-3 left-6 w-12 h-5 bg-brand border-4 border-line shadow-[2px_2px_0px_#000000]" /><div className="absolute -top-3 right-6 w-12 h-5 bg-brand border-4 border-line shadow-[2px_2px_0px_#000000]" />
                  <div className="relative z-10 flex flex-col gap-3">
                    {week.sessions.map((s) => (
                      <button key={s.id_sessione} onClick={() => router.push(`/session?id=${s.id_sessione}`)}className="w-full bg-surface border-4 border-line p-4 shadow-[4px_4px_0px_#000000] flex items-center justify-between group outline-none hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all">
                        <div className="flex flex-col text-left gap-2"><span className="font-heading text-xl font-black uppercase truncate">{s.nome_allenamento}</span><div className="flex items-center gap-4 text-[10px] font-black uppercase text-muted tracking-widest"><div className="flex items-center gap-1"><Calendar size={14} className="text-brand" strokeWidth={2.5} />{formatData(s.inizio_ts)}</div><div className="flex items-center gap-1"><Clock size={14} className="text-brand" strokeWidth={2.5} />{formatDurata(s.durata_totale_sec)} ({formatOra(s.inizio_ts)})</div></div></div>
                        <ChevronRight size={24} strokeWidth={3} className="text-line/30 group-hover:text-brand transition-colors shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}