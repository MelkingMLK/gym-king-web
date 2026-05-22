"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Plus, Search, X, Trash2, Edit3, ChevronRight, ChevronDown, GripVertical } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import Fuse from "fuse.js";

// === SPINNER REATTIVO PURO TAILWIND (PUNTO F) ===
const CleanSpinner = ({ size = 24 }: { size?: number }) => {
  const strokeWidth = Math.max(2, Math.round(size * 0.1));
  return (
    <div className="relative flex items-center justify-center animate-spin" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full border-main opacity-10" style={{ borderWidth: strokeWidth }} />
      <div className="absolute inset-0 rounded-full border-transparent border-t-brand" style={{ borderWidth: strokeWidth }} />
    </div>
  );
};

type Giorno = { id_giorno: number; id_template: string; nome_giorno: string; };
type Muscolo = { id_gruppo?: number; id?: number; nome: string; };
type Attrezzo = { id_attrezzo?: number; id?: number; nome: string; };
type Esercizio = { id_esercizio?: number; id?: number; nome: string; gif_url?: string; };
type RelazioneMuscolo = { id_esercizio?: number; id_gruppo?: number; };
type RelazioneAttrezzo = { id_esercizio?: number; id_attrezzo?: number; };
type SchedaEsercizio = { 
  id_scheda_esercizio: number; 
  id_giorno: number; 
  id_esercizio: number; 
  ordine: number; 
  serie: String; 
  ripetizioni: String; 
  recupero_sec: number; 
  unita_misura: string; 
  Esercizi: { nome: string; gif_url?: string }; 
};

const getInitials = (name: string) => {
  const words = name.trim().split(' ').filter(w => w.length > 0);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const getMuscleColor = (muscles: Muscolo[]) => {
  if (!muscles || muscles.length === 0) return 'bg-main text-base'; 
  const primary = muscles[0].nome.toLowerCase();
  if (primary.includes('pett')) return 'bg-[#ff331f] text-white'; 
  if (primary.includes('dorsal') || primary.includes('schiena')) return 'bg-[#3366ff] text-white'; 
  if (primary.includes('gamb') || primary.includes('quadricipit') || primary.includes('femorali')) return 'bg-[#ffde59] text-black'; 
  if (primary.includes('spall') || primary.includes('deltoid')) return 'bg-[#804CD9] text-white'; 
  if (primary.includes('bicipit') || primary.includes('tricipit') || primary.includes('braccia')) return 'bg-[#ff914d] text-black'; 
  if (primary.includes('addom') || primary.includes('core')) return 'bg-[#98f5e1] text-black'; 
  return 'bg-main text-base'; 
};

const ExerciseIcon = ({ nome, gif_url, muscles, onImageClick }: { nome: string, gif_url?: string, muscles: Muscolo[], onImageClick: (url: string) => void }) => {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(nome);
  const colorClass = getMuscleColor(muscles);

  if (gif_url && !imgError) {
    return (
      <div 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onImageClick(gif_url);
        }}
        className="w-16 h-16 shrink-0 border-2 border-line bg-white flex items-center justify-center overflow-hidden shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#804CD9] cursor-zoom-in active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
      >
        <img 
          src={gif_url} 
          alt={nome} 
          className="w-full h-full object-cover mix-blend-multiply p-1 pointer-events-none"
          onError={() => setImgError(true)} 
        />
      </div>
    );
  }

  return (
    <div className={`w-16 h-16 shrink-0 border-2 border-line flex items-center justify-center shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#804CD9] ${colorClass}`}>
      <span className="font-heading text-2xl font-black uppercase tracking-tighter">{initials}</span>
    </div>
  );
};

export default function DayEditorPage() {
  const params = useParams();
  const idGiorno = params.id as string;

  const [giorno, setGiorno] = useState<Giorno | null>(null);
  const [eserciziGiorno, setEserciziGiorno] = useState<SchedaEsercizio[]>([]);
  
  const [tuttiEsercizi, setTuttiEsercizi] = useState<Esercizio[]>([]);
  const [muscoli, setMuscoli] = useState<Muscolo[]>([]);
  const [attrezzi, setAttrezzi] = useState<Attrezzo[]>([]);
  const [relMuscoli, setRelMuscoli] = useState<RelazioneMuscolo[]>([]);
  const [relAttrezzi, setRelAttrezzi] = useState<RelazioneAttrezzo[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchSheetOpen, setIsSearchSheetOpen] = useState(false);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [isMuscoliOpen, setIsMuscoliOpen] = useState(false);
  const [isAttrezziOpen, setIsAttrezziOpen] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);

  const [selectedExercise, setSelectedExercise] = useState<Esercizio | null>(null);
  const [serie, setSerie] = useState("4");
  const [ripetizioni, setRipetizioni] = useState("10"); 
  const [recupero, setRecupero] = useState("150"); 
  const [unitaMisura, setUnitaMisura] = useState("KG"); 

  const [swipedExerciseId, setSwipedExerciseId] = useState<number | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isDraggingSwipe, setIsDraggingSwipe] = useState(false);

  const [previewGif, setPreviewGif] = useState<string | null>(null);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  async function fetchData() {
    setIsLoading(true);
    try {
      const { data: gData } = await supabase.from('Giorni_Template').select('*').eq('id_giorno', idGiorno).single();
      if (gData) setGiorno(gData as Giorno);

      const { data: seData } = await supabase.from('Scheda_Esercizi').select('*, Esercizi(nome, gif_url)').eq('id_giorno', idGiorno).order('ordine');
      if (seData) setEserciziGiorno(seData as any);

      const { data: eData } = await supabase.from('Esercizi').select('id_esercizio, nome, gif_url').order('nome');
      if (eData) setTuttiEsercizi(eData as Esercizio[]);

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
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { if (idGiorno) fetchData(); }, [idGiorno]);

  const toggleMuscle = (id: string) => {
    setSelectedMuscles(prev => prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]);
  };

  let risultatiFinali: Esercizio[] = [];
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

  const handleSaveExercise = async () => {
    if (!selectedExercise || !giorno) return;
    setIsSaving(true);
    try {
      const esId = selectedExercise.id_esercizio ?? selectedExercise.id;
      if (editingId) {
        await supabase.from('Scheda_Esercizi').update({ 
          serie, 
          ripetizioni, 
          recupero_sec: parseInt(recupero) || 0,
          unita_misura: unitaMisura
        }).eq('id_scheda_esercizio', editingId);
      } else {
        await supabase.from('Scheda_Esercizi').insert([{ 
          id_giorno: giorno.id_giorno, 
          id_esercizio: esId, 
          ordine: eserciziGiorno.length + 1, 
          serie, 
          ripetizioni, 
          recupero_sec: parseInt(recupero) || 0,
          unita_misura: unitaMisura
        }]);
      }
      
      setIsDetailSheetOpen(false); 
      setSelectedExercise(null); 
      setEditingId(null); 
      setUnitaMisura("KG");
      setSearchText("");
      setSelectedMuscles([]);
      setSelectedEquipment(null);
      setIsMuscoliOpen(false);
      setIsAttrezziOpen(false);
      await fetchData();
    } catch (error) { console.error(error); } finally { setIsSaving(false); }
  };

  const handleDeleteExercise = async (id: number) => {
    await supabase.from('Scheda_Esercizi').delete().eq('id_scheda_esercizio', id);
    setSwipedExerciseId(null); await fetchData();
  };

  const handleOpenEdit = (esercizio: SchedaEsercizio) => {
    if (swipedExerciseId === esercizio.id_scheda_esercizio) { setSwipedExerciseId(null); return; }
    setEditingId(esercizio.id_scheda_esercizio);
    setSelectedExercise({ id_esercizio: esercizio.id_esercizio, nome: esercizio.Esercizi?.nome || "" });
    setSerie(String(esercizio.serie)); 
    setRipetizioni(String(esercizio.ripetizioni)); 
    setRecupero(String(esercizio.recupero_sec));
    setUnitaMisura(esercizio.unita_misura || "KG"); 
    setIsDetailSheetOpen(true);
  };

  const handleExerciseSelect = (es: Esercizio) => {
    setEditingId(null); setSelectedExercise(es); setSerie("4"); setRipetizioni("10"); setRecupero("150"); setUnitaMisura("KG");
    setIsSearchSheetOpen(false); setIsDetailSheetOpen(true);
  };

  const handleSwipeStart = (clientX: number) => { setTouchEnd(null); setTouchStart(clientX); setIsDraggingSwipe(true); };
  const handleSwipeMove = (clientX: number) => { if (isDraggingSwipe) setTouchEnd(clientX); };
  const handleSwipeEnd = (id: number) => {
    setIsDraggingSwipe(false);
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > 50) setSwipedExerciseId(id);
    else if (distance < -50) setSwipedExerciseId(null);
  };

  const handleDragStart = (index: number) => { dragItem.current = index; };
  const handleDragEnter = (index: number) => { dragOverItem.current = index; };
  const handleDragEnd = async () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const newExercises = [...eserciziGiorno];
      const draggedItemContent = newExercises[dragItem.current];
      newExercises.splice(dragItem.current, 1);
      newExercises.splice(dragOverItem.current, 0, draggedItemContent);

      const updatedExercises = newExercises.map((es, idx) => ({ ...es, ordine: idx + 1 }));
      setEserciziGiorno(updatedExercises); 

      const updates = updatedExercises.map(es => ({
        id_scheda_esercizio: es.id_scheda_esercizio,
        id_giorno: es.id_giorno,
        id_esercizio: es.id_esercizio,
        serie: es.serie,
        ripetizioni: es.ripetizioni,
        recupero_sec: es.recupero_sec,
        ordine: es.ordine,
        unita_misura: es.unita_misura 
      }));
      await supabase.from('Scheda_Esercizi').upsert(updates);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  if (isLoading) return <main className="flex min-h-screen items-center justify-center bg-base text-main"><CleanSpinner size={64} /></main>;

  return (
    <main className="flex min-h-screen flex-col items-center pt-12 px-4 pb-20 relative overflow-x-hidden bg-base transition-colors duration-300">
      
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <Link href={giorno ? `/template/${giorno.id_template}` : "/create-template"}>
          <div className="w-12 h-12 bg-surface flex items-center justify-center border-2 border-line shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none">
            <ChevronLeft className="text-main" size={24} strokeWidth={3} />
          </div>
        </Link>
        <button onClick={() => setIsSearchSheetOpen(true)} className="w-12 h-12 bg-brand flex items-center justify-center border-2 border-line shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none">
          <Plus className="text-base" size={24} strokeWidth={3} />
        </button>
      </div>

      <h1 className="font-heading text-4xl font-black text-main text-center uppercase tracking-tighter mb-10">{giorno?.nome_giorno}</h1>

      <div className="w-full max-w-2xl flex flex-col gap-5">
        {eserciziGiorno.map((es, index) => {
          const esId = String(es.id_esercizio);
          const relatedMuscles = muscoli.filter(m => 
            relMuscoli.some(rm => String(rm.id_esercizio ?? (rm as any).esercizio_id) === esId && String(rm.id_gruppo ?? (rm as any).gruppo_id) === String(m.id_gruppo ?? m.id))
          );

          return (
            <div 
              key={es.id_scheda_esercizio} 
              onDragEnter={() => handleDragEnter(index)} 
              onDragOver={(e) => e.preventDefault()}
              className="relative w-full border-2 border-line shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#804CD9] bg-brand overflow-hidden"
            >
              <div className="absolute top-0 bottom-0 right-0 w-24 flex items-center justify-center">
                <button onClick={() => handleDeleteExercise(es.id_scheda_esercizio)} className="w-full h-full flex items-center justify-center text-base">
                  <Trash2 size={28} strokeWidth={2.5} />
                </button>
              </div>
              
              <div 
                onTouchStart={(e) => handleSwipeStart(e.targetTouches[0].clientX)} 
                onTouchMove={(e) => handleSwipeMove(e.targetTouches[0].clientX)} 
                onTouchEnd={() => handleSwipeEnd(es.id_scheda_esercizio)}
                onMouseDown={(e) => handleSwipeStart(e.clientX)}
                onMouseMove={(e) => handleSwipeMove(e.clientX)}
                onMouseUp={() => handleSwipeEnd(es.id_scheda_esercizio)}
                onMouseLeave={() => { if (isDraggingSwipe) handleSwipeEnd(es.id_scheda_esercizio) }}
                className={`relative z-10 w-full bg-surface p-4 border-r-2 border-line flex items-center justify-between transition-transform duration-300 ${swipedExerciseId === es.id_scheda_esercizio ? '-translate-x-24' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div 
                    draggable 
                    onDragStart={() => handleDragStart(index)}
                    onDragEnd={handleDragEnd}
                    className="shrink-0 text-main/30 hover:text-main transition-colors mr-1 cursor-grab active:cursor-grabbing"
                  >
                    <GripVertical size={24} strokeWidth={2.5} />
                  </div>

                  <ExerciseIcon 
                    nome={es.Esercizi?.nome} 
                    gif_url={es.Esercizi?.gif_url} 
                    muscles={relatedMuscles} 
                    onImageClick={setPreviewGif} 
                  />

                  <div 
                    className="flex flex-col gap-1 cursor-pointer ml-1"
                    onClick={() => {
                      if (touchStart && touchEnd && Math.abs(touchStart - touchEnd) > 15) return;
                      handleOpenEdit(es);
                    }}
                  >
                    <span className="font-heading text-lg text-main font-black uppercase tracking-tight leading-tight line-clamp-1">{es.Esercizi?.nome || "Esercizio"}</span>
                    
                    {relatedMuscles.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {relatedMuscles.map(m => (
                          <span key={m.id_gruppo ?? m.id} className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-line text-base">
                            {m.nome}
                          </span>
                        ))}
                      </div>
                    )}

                    <span className="text-muted font-bold text-xs tracking-wider uppercase mt-1">{es.serie} SET • {es.ripetizioni} RIP • {es.recupero_sec}S REST • {es.unita_misura || 'KG'}</span>
                  </div>
                </div>

                <Edit3 size={20} strokeWidth={2.5} className="text-muted pointer-events-none shrink-0 ml-2" />
              </div>
            </div>
          );
        })}

        {eserciziGiorno.length === 0 && (
          <div className="text-center mt-10">
             <p className="text-muted font-black uppercase tracking-widest text-sm">Nessun Core o esercizio inserito.</p>
             <p className="text-main font-bold mt-2">Usa il tasto + in alto per iniziare.</p>
          </div>
        )}
      </div>

      {/* MODALE RICERCA ESERCIZI */}
      {isSearchSheetOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col justify-end">
          <div className="bg-base w-full h-[90vh] border-t-4 border-line flex flex-col shadow-[0px_-8px_0px_rgba(0,0,0,1)] dark:shadow-[0px_-8px_0px_rgba(128,76,217,1)] animate-in slide-in-from-bottom-full duration-300">
            
            <div className="flex justify-between items-center p-6 border-b-2 border-line shrink-0 bg-surface">
              <h2 className="font-heading text-2xl font-black uppercase text-main tracking-tighter">Catalogo</h2>
              <button onClick={() => { setIsSearchSheetOpen(false); setSelectedMuscles([]); setSelectedEquipment(null); setSearchText(""); setIsMuscoliOpen(false); setIsAttrezziOpen(false); }} className="w-10 h-10 bg-base flex items-center justify-center border-2 border-line shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#804CD9] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
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
                          <button key={mId} onClick={() => toggleMuscle(mId)} className={`px-4 py-2 border-2 border-line text-xs font-black uppercase tracking-widest transition-all ${selectedMuscles.includes(mId) ? 'bg-brand text-base shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#804CD9] translate-x-[-1px] translate-y-[-1px]' : 'bg-surface text-main hover:bg-base'}`}>
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
                          <button key={aId} onClick={() => setSelectedEquipment(selectedEquipment === aId ? null : aId)} className={`px-4 py-2 border-2 border-line text-xs font-black uppercase tracking-widest transition-all ${selectedEquipment === aId ? 'bg-brand text-base shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#804CD9] translate-x-[-1px] translate-y-[-1px]' : 'bg-surface text-main hover:bg-base'}`}>
                            {a.nome}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 pb-6">
                {risultatiFinali.map(es => {
                  const esId = String(es.id_esercizio ?? es.id);
                  const relatedMuscles = muscoli.filter(m => 
                    relMuscoli.some(rm => String(rm.id_esercizio ?? (rm as any).esercizio_id) === esId && String(rm.id_gruppo ?? (rm as any).gruppo_id) === String(m.id_gruppo ?? m.id))
                  );

                  return (
                    <button key={esId} onClick={() => handleExerciseSelect(es)} className="group w-full text-left p-4 bg-surface border-2 border-line hover:shadow-[4px_4px_0px_#000000] dark:hover:shadow-[4px_4px_0px_#804CD9] hover:-translate-y-1 flex justify-between items-center transition-all">
                      <div className="flex items-center gap-4">
                        <ExerciseIcon 
                          nome={es.nome} 
                          gif_url={es.gif_url} 
                          muscles={relatedMuscles} 
                          onImageClick={setPreviewGif} 
                        />
                        <div className="flex flex-col gap-2">
                          <span className="font-heading text-lg font-black uppercase text-main tracking-tight leading-tight">{es.nome}</span>
                          {relatedMuscles.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {relatedMuscles.map(m => (
                                <span key={m.id_gruppo ?? m.id} className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-line text-base">
                                  {m.nome}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <Plus size={24} strokeWidth={3} className="text-muted group-hover:text-brand transition-colors shrink-0 ml-4" />
                    </button>
                  );
                })}
                {risultatiFinali.length === 0 && (searchText || selectedMuscles.length > 0 || selectedEquipment) && (
                  <p className="text-muted text-center mt-10 text-sm font-bold uppercase tracking-widest">Nessun esercizio corrisponde.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALE DETTAGLIO ESERCIZIO */}
      {isDetailSheetOpen && selectedExercise && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex flex-col justify-end">
          <div className="bg-base w-full border-t-4 border-line p-8 flex flex-col gap-8 pb-12 shadow-[0px_-12px_0px_rgba(0,0,0,1)] dark:shadow-[0px_-12px_0px_rgba(128,76,217,1)] animate-in slide-in-from-bottom-full duration-200">
            
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-brand uppercase tracking-widest border-2 border-brand bg-brand/10 w-fit px-2 py-1 mb-2">{editingId ? "Modifica" : "Aggiungi"}</span>
              <h2 className="font-heading text-3xl font-black text-main uppercase tracking-tighter leading-none">{selectedExercise.nome}</h2>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="flex flex-col gap-2">
                 <label className="text-xs text-muted uppercase font-black tracking-widest">Unità di Misura</label>
                 <div className="flex gap-2">
                   {["KG", "LBS"].map((unit) => (
                     <button 
                       key={unit} 
                       onClick={() => setUnitaMisura(unit)} 
                       className={`flex-1 p-4 font-black uppercase border-2 border-line transition-all outline-none ${
                         unitaMisura === unit 
                         ? 'bg-main text-base shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] translate-x-[-2px] translate-y-[-2px]' 
                         : 'bg-surface text-main hover:bg-base'
                       }`}
                     >
                       {unit}
                     </button>
                   ))}
                 </div>
              </div>

              <div className="flex flex-col gap-2">
                 <label className="text-xs text-muted uppercase font-black tracking-widest">Serie</label>
                 <input type="number" value={serie} onChange={(e) => setSerie(e.target.value)} className="bg-surface border-2 border-line p-4 text-main font-bold outline-none focus:bg-base focus:shadow-[4px_4px_0px_#000000] dark:focus:shadow-[4px_4px_0px_#804CD9] transition-all" />
              </div>
              <div className="flex flex-col gap-2">
                 <label className="text-xs text-muted uppercase font-black tracking-widest">Ripetizioni</label>
                 <input type="number" value={ripetizioni} onChange={(e) => setRipetizioni(e.target.value)} className="bg-surface border-2 border-line p-4 text-main font-bold outline-none focus:bg-base focus:shadow-[4px_4px_0px_#000000] dark:focus:shadow-[4px_4px_0px_#804CD9] transition-all" />
              </div>
              <div className="flex flex-col gap-2">
                 <label className="text-xs text-muted uppercase font-black tracking-widest">Recupero (secondi)</label>
                 <input type="number" value={recupero} onChange={(e) => setRecupero(e.target.value)} className="bg-surface border-2 border-line p-4 text-main font-bold outline-none focus:bg-base focus:shadow-[4px_4px_0px_#000000] dark:focus:shadow-[4px_4px_0px_#804CD9] transition-all" />
              </div>
            </div>

            <div className="flex gap-4 mt-4">
              <button onClick={() => { setIsDetailSheetOpen(false); setEditingId(null); setUnitaMisura("KG"); }} className="flex-1 p-5 bg-surface border-2 border-line text-main font-black uppercase tracking-widest shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all">
                 Annulla
              </button>
              <button onClick={handleSaveExercise} className="flex-1 p-5 bg-brand border-2 border-line text-base font-black uppercase tracking-widest shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex justify-center items-center">
                 {isSaving ? <CleanSpinner size={24} /> : "CONFERMA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE ANTEPRIMA GIF */}
      {previewGif && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-in fade-in duration-200"
          onClick={() => setPreviewGif(null)} 
        >
          <div 
            className="relative w-full max-w-sm bg-white border-4 border-line shadow-[12px_12px_0px_#000000] dark:shadow-[12px_12px_0px_#804CD9] p-2"
            onClick={(e) => e.stopPropagation()} 
          >
            <button 
              onClick={() => setPreviewGif(null)}
              className="absolute -top-5 -right-5 w-12 h-12 bg-[#ff331f] border-4 border-line flex items-center justify-center shadow-[4px_4px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              <X size={28} strokeWidth={4} className="text-white" />
            </button>
            <img src={previewGif} alt="Esercizio Ingrandito" className="w-full h-auto object-contain bg-white" />
          </div>
        </div>
      )}

    </main>
  );
}