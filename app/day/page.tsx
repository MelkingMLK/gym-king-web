"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, Plus, Search, X, Trash2, Edit3, ChevronRight, ChevronDown, GripVertical, FlaskConical } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Fuse from "fuse.js";

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
type Esercizio = { id_esercizio?: number; id?: number; nome: string; gif_url?: string; is_approved?: boolean; user_id?: string; };
type RelazioneMuscolo = { id_esercizio?: number; id_gruppo?: number; };
type RelazioneAttrezzo = { id_esercizio?: number; id_attrezzo?: number; };
type SchedaEsercizio = { 
  id_scheda_esercizio: number; 
  id_giorno: number; 
  id_esercizio: number; 
  ordine: number; 
  serie: string; 
  ripetizioni: string; 
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
        className="w-16 h-16 shrink-0 border-2 border-line bg-white flex items-center justify-center overflow-hidden shadow-[2px_2px_0px_#000000] cursor-zoom-in active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
      >
        <img src={gif_url} alt={nome} className="w-full h-full object-cover mix-blend-multiply p-1 pointer-events-none" onError={() => setImgError(true)} />
      </div>
    );
  }

  return (
    <div className={`w-16 h-16 shrink-0 border-2 border-line flex items-center justify-center shadow-[2px_2px_0px_#000000] ${colorClass}`}>
      <span className="font-heading text-2xl font-black uppercase tracking-tighter">{initials}</span>
    </div>
  );
};

// === LOGICA PRINCIPALE ESTRATTA IN UN COMPONENTE ===
function DayEditorContent() {
  const searchParams = useSearchParams();
  const idGiorno = searchParams.get("id");

  const [giorno, setGiorno] = useState<Giorno | null>(null);
  const [eserciziGiorno, setEserciziGiorno] = useState<SchedaEsercizio[]>([]);
  
  const dragItem = useRef<number | null>(null);
  const listRef = useRef(eserciziGiorno);
  
  useEffect(() => { listRef.current = eserciziGiorno; }, [eserciziGiorno]);
  
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
  const [previewGif, setPreviewGif] = useState<string | null>(null);

  // === STATI PER CREAZIONE UGC AGGIORNATI (Nome Inglese Rimosso) ===
  const [isCreatingUGC, setIsCreatingUGC] = useState(false);
  const [ugcMuscleId, setUgcMuscleId] = useState<string | null>(null);
  const [ugcSecondaryMuscleIds, setUgcSecondaryMuscleIds] = useState<string[]>([]);
  const [ugcEquipmentId, setUgcEquipmentId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  async function fetchData() {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const { data: gData } = await supabase.from('Giorni_Template').select('*').eq('id_giorno', idGiorno).single();
      if (gData) setGiorno(gData as Giorno);

      const { data: seData } = await supabase.from('Scheda_Esercizi').select('*, Esercizi(nome, gif_url)').eq('id_giorno', idGiorno).order('ordine');
      if (seData) setEserciziGiorno(seData as any);

      let queryEsercizi = supabase.from('Esercizi').select('id_esercizio, nome, gif_url, is_approved, user_id').order('nome');
      const { data: eData } = await queryEsercizi;
      
      if (eData) {
        const validEsercizi = eData.filter(e => e.is_approved === true || e.user_id === user?.id);
        setTuttiEsercizi(validEsercizi as Esercizio[]);
      }

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

      let { data: relAData, error: relAErr } = await supabase.from('Esercizio_Attrezzo').select('*');
      if (relAErr) {
          const fallback = await supabase.from('esercizio_attrezzo').select('*');
          relAData = fallback.data;
      }
      if (relAData) setRelAttrezzi(relAData as RelazioneAttrezzo[]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { if (idGiorno) fetchData(); }, [idGiorno]);

  const commitReorder = async () => {
    const currentList = listRef.current;
    const updatedExercises = currentList.map((ex, idx) => ({ ...ex, ordine: idx + 1 }));
    setEserciziGiorno(updatedExercises); 

    const updates = updatedExercises.map(ex => ({
      id_scheda_esercizio: ex.id_scheda_esercizio,
      id_giorno: ex.id_giorno,
      id_esercizio: ex.id_esercizio,
      serie: ex.serie,
      ripetizioni: ex.ripetizioni,
      recupero_sec: ex.recupero_sec,
      ordine: ex.ordine,
      unita_misura: ex.unita_misura 
    }));
    try {
      await supabase.from('Scheda_Esercizi').upsert(updates, { onConflict: 'id_scheda_esercizio' });
    } catch(e) {
      console.error("Errore salvataggio ordine", e);
    }
  };

  const toggleMuscle = (id: string) => {
    setSelectedMuscles(prev => prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]);
  };

  const toggleUgcSecondaryMuscle = (id: string) => {
    setUgcSecondaryMuscleIds(prev => prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]);
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

  const handleCreateUGCExercise = async () => {
    if (!searchText.trim() || !ugcMuscleId || !ugcEquipmentId || !currentUserId) return;
    setIsCreatingUGC(true);
    
    try {
      const nomeUppercase = searchText.trim().toUpperCase();
      
      const { data: existing } = await supabase
        .from('Esercizi')
        .select('*')
        .ilike('nome', nomeUppercase)
        .maybeSingle();

      let idEsercizio: number;
      let finalEx: Esercizio;

      if (existing) {
        idEsercizio = existing.id_esercizio ?? existing.id;
        finalEx = { id_esercizio: idEsercizio, nome: existing.nome, is_approved: existing.is_approved, user_id: existing.user_id };
      } else {
        // === AUTO-TRANSLATION INTERNA ===
        let translatedName = null;
        try {
          const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(searchText.trim())}&langpair=it|en`);
          const translationData = await res.json();
          if (translationData?.responseData?.translatedText) {
            translatedName = translationData.responseData.translatedText.toUpperCase();
          }
        } catch (e) {
          console.warn("API Traduzione fallita. Procedo senza traduzione in inglese.", e);
        }

        const { data: newEx, error: exErr } = await supabase
          .from('Esercizi')
          .insert([{ 
            nome: nomeUppercase, 
            nome_inglese: translatedName, 
            is_approved: false, 
            user_id: currentUserId 
          }])
          .select().single();
        
        if (exErr || !newEx) throw exErr || new Error("Errore inserimento Esercizio");

        idEsercizio = newEx.id_esercizio ?? newEx.id;
        finalEx = { id_esercizio: idEsercizio, nome: newEx.nome, is_approved: false, user_id: currentUserId };
        
        // --- INSERIMENTO MUSCOLI (PRIMARIO + SECONDARI) ---
        const allMusclesToInsert = [ugcMuscleId, ...ugcSecondaryMuscleIds];
        const payloadMuscoli = allMusclesToInsert.map(mId => ({
          id_esercizio: idEsercizio,
          id_gruppo: Number(mId)
        }));

        const { error: relMErr } = await supabase.from('Esercizio_Muscolo').insert(payloadMuscoli);
        if (relMErr) {
          const fallbackPayload = allMusclesToInsert.map(mId => ({
            esercizio_id: idEsercizio,
            gruppo_id: Number(mId)
          }));
          await supabase.from('esercizio_muscolo').insert(fallbackPayload);
        }

        // --- INSERIMENTO ATTREZZO ---
        const { error: relAErr } = await supabase.from('Esercizio_Attrezzo').insert([{ id_esercizio: idEsercizio, id_attrezzo: Number(ugcEquipmentId) }]);
        if (relAErr) {
          await supabase.from('esercizio_attrezzo').insert([{ esercizio_id: idEsercizio, attrezzo_id: Number(ugcEquipmentId) }]);
        }
      }

      setTuttiEsercizi(prev => [...prev, finalEx]);
      const newRelsM = [ugcMuscleId, ...ugcSecondaryMuscleIds].map(mId => ({ id_esercizio: idEsercizio, id_gruppo: Number(mId) }));
      setRelMuscoli(prev => [...prev, ...newRelsM]);
      setRelAttrezzi(prev => [...prev, { id_esercizio: idEsercizio, id_attrezzo: Number(ugcEquipmentId) }]);
      
      handleExerciseSelect(finalEx);
    } catch (error) {
      console.error("Errore Creazione UGC:", error);
      alert("Errore critico nella comunicazione col database.");
    } finally {
      setIsCreatingUGC(false);
    }
  };

  const handleSaveExercise = async () => {
    if (!selectedExercise || !giorno) return;
    setIsSaving(true);
    try {
      const esId = selectedExercise.id_esercizio ?? selectedExercise.id;
      if (editingId) {
        await supabase.from('Scheda_Esercizi').update({ 
          serie, ripetizioni, recupero_sec: parseInt(recupero) || 0, unita_misura: unitaMisura
        }).eq('id_scheda_esercizio', editingId);
      } else {
        await supabase.from('Scheda_Esercizi').insert([{ 
          id_giorno: giorno.id_giorno, id_esercizio: esId, ordine: eserciziGiorno.length + 1, 
          serie, ripetizioni, recupero_sec: parseInt(recupero) || 0, unita_misura: unitaMisura
        }]);
      }
      
      setIsDetailSheetOpen(false); setSelectedExercise(null); setEditingId(null); 
      setUnitaMisura("KG"); setSearchText(""); setSelectedMuscles([]); setSelectedEquipment(null);
      setIsMuscoliOpen(false); setIsAttrezziOpen(false); 
      setUgcMuscleId(null); setUgcSecondaryMuscleIds([]); setUgcEquipmentId(null);
      await fetchData();
    } catch (error) { console.error(error); } finally { setIsSaving(false); }
  };

  const handleDeleteExercise = async (id: number) => {
    await supabase.from('Scheda_Esercizi').delete().eq('id_scheda_esercizio', id);
    setSwipedExerciseId(null); await fetchData();
  };

  const handleOpenEdit = (esercizio: SchedaEsercizio) => {
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

  if (isLoading) return <main className="flex min-h-screen items-center justify-center bg-base text-main"><CleanSpinner size={64} /></main>;

  return (
    <main className="flex min-h-screen flex-col items-center pt-12 px-4 pb-20 relative overflow-x-hidden bg-base transition-colors duration-300">
      
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <Link href={giorno ? `/template?id=${giorno.id_template}` : "/create-template"}>
          <div className="w-12 h-12 bg-surface flex items-center justify-center border-2 border-line shadow-[4px_4px_0px_#000000] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none">
            <ChevronLeft className="text-main" size={24} strokeWidth={3} />
          </div>
        </Link>
        <button onClick={() => setIsSearchSheetOpen(true)} className="w-12 h-12 bg-brand flex items-center justify-center border-2 border-line shadow-[4px_4px_0px_#000000] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none">
          <Plus className="text-base" size={24} strokeWidth={3} />
        </button>
      </div>

      <h1 className="font-heading text-4xl font-black text-main text-center uppercase tracking-tighter mb-10">{giorno?.nome_giorno}</h1>

      <div className="w-full max-w-2xl flex flex-col gap-5">
        {eserciziGiorno.map((es, index) => {
          let touchStartX = 0;
          let touchStartY = 0;
          let isHorizontalSwipe = false;
            
          const esId = String(es.id_esercizio);
          const relatedMuscles = muscoli.filter(m => 
            relMuscoli.some(rm => String(rm.id_esercizio ?? (rm as any).esercizio_id) === esId && String(rm.id_gruppo ?? (rm as any).gruppo_id) === String(m.id_gruppo ?? m.id))
          );

          return (
            <div 
              key={`esercizio-${es.id_scheda_esercizio}`} 
              data-drag-index={index}
              onDragEnter={(e) => {
                e.preventDefault();
                if (dragItem.current !== null && dragItem.current !== index) {
                  setEserciziGiorno(prev => {
                    const newArr = [...prev];
                    const dragged = newArr[dragItem.current!];
                    newArr.splice(dragItem.current!, 1);
                    newArr.splice(index, 0, dragged);
                    dragItem.current = index;
                    return newArr;
                  });
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              className="relative w-full border-2 border-line shadow-[6px_6px_0px_#000000] bg-[#ff331f] overflow-hidden select-none"
              style={{ touchAction: "pan-y" }} 
            >
              <div className="absolute top-0 bottom-0 right-0 w-24 flex items-center justify-center text-white z-0">
                <button 
                  onClick={() => handleDeleteExercise(es.id_scheda_esercizio)} 
                  className="w-full h-full flex items-center justify-center outline-none active:bg-red-800 transition-colors"
                >
                  <Trash2 size={28} strokeWidth={2.5} />
                </button>
              </div>
              
              <div className={`relative z-10 w-full bg-surface border-r-2 border-line flex items-stretch transition-transform duration-300 ease-out ${swipedExerciseId === es.id_scheda_esercizio ? '-translate-x-24' : 'translate-x-0'}`}>
                
                <div 
                  draggable={typeof window !== "undefined" && !('ontouchstart' in window)} 
                  onDragStart={(e) => { dragItem.current = index; e.dataTransfer.effectAllowed = 'move'; }}
                  onDragEnd={() => { dragItem.current = null; commitReorder(); }}
                  onTouchStart={(e) => { e.stopPropagation(); dragItem.current = index; }}
                  onTouchMove={(e) => {
                    e.stopPropagation();
                    if (dragItem.current === null) return;
                    const touch = e.touches[0];
                    const target = document.elementFromPoint(touch.clientX, touch.clientY);
                    const row = target?.closest('[data-drag-index]');
                    if (row) {
                      const hoverIndex = parseInt(row.getAttribute('data-drag-index') || "");
                      if (!isNaN(hoverIndex) && hoverIndex !== dragItem.current) {
                        setEserciziGiorno(prev => {
                          const newArr = [...prev];
                          const dragged = newArr[dragItem.current!];
                          newArr.splice(dragItem.current!, 1);
                          newArr.splice(hoverIndex, 0, dragged);
                          dragItem.current = hoverIndex;
                          return newArr;
                        });
                      }
                    }
                  }}
                  onTouchEnd={(e) => { e.stopPropagation(); dragItem.current = null; commitReorder(); }}
                  className="shrink-0 flex items-center justify-center px-4 text-main/30 hover:text-main transition-colors cursor-grab active:cursor-grabbing touch-none"
                >
                  <GripVertical size={24} strokeWidth={2.5} />
                </div>

                <div 
                  className="flex-1 flex items-center gap-3 py-3 pr-4 cursor-pointer"
                  onTouchStart={(e) => {
                    touchStartX = e.touches[0].clientX;
                    touchStartY = e.touches[0].clientY;
                    isHorizontalSwipe = false;
                  }}
                  onTouchMove={(e) => {
                    const deltaX = touchStartX - e.touches[0].clientX;
                    const deltaY = Math.abs(touchStartY - e.touches[0].clientY);
                    if (Math.abs(deltaX) > 10 && deltaY < 15) {
                      isHorizontalSwipe = true;
                      if (e.cancelable) e.preventDefault(); 
                    }
                  }}
                  onTouchEnd={(e) => {
                    const deltaX = touchStartX - e.changedTouches[0].clientX;
                    const deltaY = Math.abs(touchStartY - e.changedTouches[0].clientY);
                    if (isHorizontalSwipe && deltaY < 30) {
                      if (deltaX > 45) setSwipedExerciseId(es.id_scheda_esercizio);
                      else if (deltaX < -45) setSwipedExerciseId(null);
                    }
                  }}
                  onClick={(e) => {
                    if (isHorizontalSwipe) return;
                    if (swipedExerciseId === es.id_scheda_esercizio) {
                      setSwipedExerciseId(null);
                      return;
                    }
                    handleOpenEdit(es);
                  }}
                >
                  <ExerciseIcon nome={es.Esercizi?.nome} gif_url={es.Esercizi?.gif_url} muscles={relatedMuscles} onImageClick={setPreviewGif} />

                  <div className="flex-1 flex items-center justify-between group">
                    <div className="flex flex-col gap-1">
                      <span className="font-heading text-lg text-main font-black uppercase tracking-tight leading-tight line-clamp-1 group-hover:text-brand transition-colors">
                        {es.Esercizi?.nome || "Esercizio"}
                      </span>
                      {relatedMuscles.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {relatedMuscles.map(m => (
                            <span key={m.id_gruppo ?? m.id} className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-line text-base">{m.nome}</span>
                          ))}
                        </div>
                      )}
                      <span className="text-muted font-bold text-xs tracking-wider uppercase mt-1">
                        {es.serie} SET • {es.ripetizioni} RIP • {es.recupero_sec}S REST • {es.unita_misura || 'KG'}
                      </span>
                    </div>
                    <Edit3 size={20} strokeWidth={2.5} className="text-muted shrink-0 ml-2 group-hover:text-brand transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {eserciziGiorno.length === 0 && (
          <div className="text-center mt-10 border-4 border-dashed border-line p-10 bg-surface">
             <p className="text-muted font-black uppercase tracking-widest text-sm">Nessun esercizio inserito.</p>
             <p className="text-main font-bold mt-2">Usa il tasto + in alto per iniziare.</p>
          </div>
        )}
      </div>

      {isSearchSheetOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col justify-end">
          <div className="bg-base w-full h-[90vh] border-t-4 border-line flex flex-col shadow-[0px_-8px_0px_rgba(0,0,0,1)] animate-in slide-in-from-bottom-full duration-300">
            
            <div className="flex justify-between items-center p-6 border-b-2 border-line shrink-0 bg-surface">
              <h2 className="font-heading text-2xl font-black uppercase text-main tracking-tighter">Catalogo</h2>
              <button onClick={() => { setIsSearchSheetOpen(false); setSelectedMuscles([]); setSelectedEquipment(null); setSearchText(""); setIsMuscoliOpen(false); setIsAttrezziOpen(false); setUgcMuscleId(null); setUgcSecondaryMuscleIds([]); setUgcEquipmentId(null); }} className="w-10 h-10 bg-base flex items-center justify-center border-2 border-line shadow-[2px_2px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
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
                  className="w-full bg-surface pl-14 pr-5 py-5 border-2 border-line text-main font-bold uppercase tracking-wide outline-none focus:shadow-[4px_4px_0px_#000000] transition-all placeholder:text-muted/50"
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
                          <button key={`btn-muscolo-${mId}`} onClick={() => toggleMuscle(mId)} className={`px-4 py-2 border-2 border-line text-xs font-black uppercase tracking-widest transition-all ${selectedMuscles.includes(mId) ? 'bg-brand text-base shadow-[2px_2px_0px_#000000] translate-x-[-1px] translate-y-[-1px]' : 'bg-surface text-main hover:bg-base'}`}>
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
                          <button key={`btn-attrezzo-${aId}`} onClick={() => setSelectedEquipment(selectedEquipment === aId ? null : aId)} className={`px-4 py-2 border-2 border-line text-xs font-black uppercase tracking-widest transition-all ${selectedEquipment === aId ? 'bg-brand text-base shadow-[2px_2px_0px_#000000] translate-x-[-1px] translate-y-[-1px]' : 'bg-surface text-main hover:bg-base'}`}>
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
                    <button key={`result-${esId}`} onClick={() => handleExerciseSelect(es)} className="group w-full text-left p-4 bg-surface border-2 border-line hover:shadow-[4px_4px_0px_#000000] hover:-translate-y-1 flex justify-between items-center transition-all">
                      <div className="flex items-center gap-4">
                        <ExerciseIcon nome={es.nome} gif_url={es.gif_url} muscles={relatedMuscles} onImageClick={setPreviewGif} />
                        <div className="flex flex-col gap-2">
                          <span className="font-heading text-lg font-black uppercase text-main tracking-tight leading-tight">{es.nome}</span>
                          {relatedMuscles.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {relatedMuscles.map(m => (
                                <span key={`tag-muscolo-${m.id_gruppo ?? m.id}`} className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-line text-base">{m.nome}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <Plus size={24} strokeWidth={3} className="text-muted group-hover:text-brand transition-colors shrink-0 ml-4" />
                    </button>
                  );
                })}
                
                {/* === COMPONENTE INSERIMENTO ESERCIZIO AGGIORNATO === */}
                {risultatiFinali.length === 0 && searchText.trim().length > 1 && (
                  <div className="mt-4 bg-surface border-4 border-line p-6 shadow-[8px_8px_0px_#000000] flex flex-col gap-6 animate-in fade-in zoom-in-95">
                    <div className="flex flex-col gap-1 border-b-4 border-line pb-4">
                      <span className="text-[10px] font-black text-brand uppercase tracking-widest border-2 border-brand bg-brand/10 w-fit px-2 py-1 mb-1">Nuovo Esercizio</span>
                      <h3 className="font-heading text-2xl font-black uppercase text-main tracking-tighter leading-tight break-words">
                        {searchText}
                      </h3>
                    </div>
                    
                    <div className="flex flex-col gap-5">
                      
                      {/* FOCUS PRIMARIO */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-black uppercase tracking-widest text-main">Focus Muscolare Primario <span className="text-brand">*</span></label>
                        <select 
                          value={ugcMuscleId || ""} 
                          onChange={(e) => {
                            setUgcMuscleId(e.target.value);
                            if (ugcSecondaryMuscleIds.includes(e.target.value)) {
                              setUgcSecondaryMuscleIds(prev => prev.filter(id => id !== e.target.value));
                            }
                          }} 
                          className="w-full bg-base border-2 border-line p-4 font-bold uppercase text-xs tracking-wider outline-none focus:border-brand appearance-none"
                        >
                          <option value="" disabled>-- Scegli Muscolo Principale --</option>
                          {muscoli.map(m => <option key={`ugc-m-${m.id_gruppo ?? m.id}`} value={m.id_gruppo ?? m.id}>{m.nome}</option>)}
                        </select>
                      </div>

                      {/* FOCUS SECONDARI */}
                      {ugcMuscleId && (
                        <div className="flex flex-col gap-2 p-4 bg-base border-2 border-line border-dashed">
                           <label className="text-[10px] font-black uppercase tracking-widest text-muted">Focus Secondari (Opzionale)</label>
                           <div className="flex flex-wrap gap-2 mt-1">
                             {muscoli.filter(m => String(m.id_gruppo ?? m.id) !== ugcMuscleId).map(m => {
                               const mId = String(m.id_gruppo ?? m.id);
                               const isSelected = ugcSecondaryMuscleIds.includes(mId);
                               return (
                                 <button 
                                   key={`ugc-sec-${mId}`} 
                                   onClick={() => toggleUgcSecondaryMuscle(mId)} 
                                   className={`px-3 py-1.5 border-2 border-line text-[10px] font-black uppercase tracking-widest transition-all outline-none ${isSelected ? 'bg-brand text-base shadow-[2px_2px_0px_#000000] translate-x-[-1px] translate-y-[-1px]' : 'bg-surface text-muted hover:text-main hover:bg-line/10'}`}
                                 >
                                   {m.nome}
                                 </button>
                               )
                             })}
                           </div>
                        </div>
                      )}

                      {/* ATTREZZO */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-black uppercase tracking-widest text-main">Attrezzo Utilizzato <span className="text-brand">*</span></label>
                        <select 
                          value={ugcEquipmentId || ""} 
                          onChange={(e) => setUgcEquipmentId(e.target.value)} 
                          className="w-full bg-base border-2 border-line p-4 font-bold uppercase text-xs tracking-wider outline-none focus:border-brand appearance-none"
                        >
                          <option value="" disabled>-- Scegli Attrezzo --</option>
                          {attrezzi.map(a => <option key={`ugc-a-${a.id_attrezzo ?? a.id}`} value={a.id_attrezzo ?? a.id}>{a.nome}</option>)}
                        </select>
                      </div>
                    </div>

                    <button 
                      onClick={handleCreateUGCExercise}
                      disabled={!ugcMuscleId || !ugcEquipmentId || isCreatingUGC}
                      className="w-full mt-2 py-5 bg-brand border-4 border-line text-base font-black uppercase tracking-widest shadow-[4px_4px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-40 flex justify-center items-center gap-2 outline-none"
                    >
                      {isCreatingUGC ? <CleanSpinner size={24} /> : <><Plus size={24} strokeWidth={3} /> AGGIUNGI ESERCIZIO</>}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isDetailSheetOpen && selectedExercise && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex flex-col justify-end">
          <div className="bg-base w-full border-t-4 border-line p-8 flex flex-col gap-8 pb-12 shadow-[0px_-12px_0px_rgba(0,0,0,1)] animate-in slide-in-from-bottom-full duration-200">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-brand uppercase tracking-widest border-2 border-brand bg-brand/10 w-fit px-2 py-1 mb-2">{editingId ? "Modifica" : "Aggiungi"}</span>
              <h2 className="font-heading text-3xl font-black text-main uppercase tracking-tighter leading-none">{selectedExercise.nome}</h2>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="flex flex-col gap-2">
                 <label className="text-xs text-muted uppercase font-black tracking-widest">Unità di Misura</label>
                 <div className="flex gap-2">
                   {["KG", "LBS"].map((unit) => (
                     <button key={unit} onClick={() => setUnitaMisura(unit)} className={`flex-1 p-4 font-black uppercase border-2 border-line transition-all outline-none ${unitaMisura === unit ? 'bg-main text-base shadow-[4px_4px_0px_#000000] translate-x-[-2px] translate-y-[-2px]' : 'bg-surface text-main hover:bg-base'}`}>{unit}</button>
                   ))}
                 </div>
              </div>

              <div className="flex flex-col gap-2">
                 <label className="text-xs text-muted uppercase font-black tracking-widest">Serie</label>
                 <input type="number" value={serie} onChange={(e) => setSerie(e.target.value)} className="bg-surface border-2 border-line p-4 text-main font-bold outline-none focus:bg-base focus:shadow-[4px_4px_0px_#000000] transition-all" />
              </div>
              <div className="flex flex-col gap-2">
                 <label className="text-xs text-muted uppercase font-black tracking-widest">Ripetizioni</label>
                 <input type="number" value={ripetizioni} onChange={(e) => setRipetizioni(e.target.value)} className="bg-surface border-2 border-line p-4 text-main font-bold outline-none focus:bg-base focus:shadow-[4px_4px_0px_#000000] transition-all" />
              </div>
              <div className="flex flex-col gap-2">
                 <label className="text-xs text-muted uppercase font-black tracking-widest">Recupero (secondi)</label>
                 <input type="number" value={recupero} onChange={(e) => setRecupero(e.target.value)} className="bg-surface border-2 border-line p-4 text-main font-bold outline-none focus:bg-base focus:shadow-[4px_4px_0px_#000000] transition-all" />
              </div>
            </div>

            <div className="flex gap-4 mt-4">
              <button onClick={() => { setIsDetailSheetOpen(false); setEditingId(null); setUnitaMisura("KG"); }} className="flex-1 p-5 bg-surface border-2 border-line text-main font-black uppercase tracking-widest shadow-[4px_4px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all">Annulla</button>
              <button onClick={handleSaveExercise} className="flex-1 p-5 bg-brand border-2 border-line text-base font-black uppercase tracking-widest shadow-[4px_4px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex justify-center items-center">{isSaving ? <CleanSpinner size={24} /> : "CONFERMA"}</button>
            </div>
          </div>
        </div>
      )}

      {previewGif && (
        <div onClick={() => setPreviewGif(null)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm bg-white border-4 border-line shadow-[12px_12px_0px_#000000] p-2">
            <button onClick={() => setPreviewGif(null)} className="absolute -top-5 -right-5 w-12 h-12 bg-[#ff331f] border-4 border-line flex items-center justify-center shadow-[4px_4px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"><X size={28} strokeWidth={4} className="text-white" /></button>
            <img src={previewGif} alt="Esercizio Ingrandito" className="w-full h-auto object-contain bg-white" />
          </div>
        </div>
      )}

    </main>
  );
}

// === COMPONENTE CONTENITORE CON SUSPENSE ===
export default function DayEditorPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-base text-main font-black uppercase tracking-widest">
        Caricamento...
      </div>
    }>
      <DayEditorContent />
    </Suspense>
  );
}