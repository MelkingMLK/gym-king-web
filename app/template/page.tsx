"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronLeft, Trash2, Edit3, ChevronRight, X, GripVertical, Globe, Lock, DownloadCloud } from "lucide-react";
import { supabase } from "@/lib/supabase"; // Ho allineato il path all'alias globale per pulizia

const CleanSpinner = ({ size = 24 }: { size?: number }) => {
  const strokeWidth = Math.max(2, Math.round(size * 0.1));
  return (
    <div className="relative flex items-center justify-center animate-spin" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full border-main opacity-10" style={{ borderWidth: strokeWidth }} />
      <div className="absolute inset-0 rounded-full border-transparent border-t-brand" style={{ borderWidth: strokeWidth }} />
    </div>
  );
};

type Giorno = { id_giorno: number; nome_giorno: string; ordine: number; };
type Template = { 
  id_template: string; 
  nome_template: string; 
  id_categoria: string | null; 
  is_public: boolean; 
  cloned_from: string | null; 
};

// === LOGICA PRINCIPALE ESTRATTA IN UN COMPONENTE ===
function TemplateDetailContent() {
  const searchParams = useSearchParams(); 
  const router = useRouter();
  const idTemplate = searchParams.get("id"); // Lettura tramite Query Params (?id=123)
  
  const [template, setTemplate] = useState<Template | null>(null);
  const [giorni, setGiorni] = useState<Giorno[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showingDeleteAlert, setShowingDeleteAlert] = useState(false);
  const [isRenamingTemplate, setIsRenamingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  
  const [dayToRename, setDayToRename] = useState<Giorno | null>(null);
  const [newDayName, setNewDayName] = useState("");
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // === MOTORE DRAG & DROP VETTORIALE ===
  const dragItem = useRef<number | null>(null);
  const listRef = useRef(giorni);
  
  useEffect(() => { listRef.current = giorni; }, [giorni]);

  async function fetchDettagli() {
    if (!idTemplate) return;
    try {
      const { data: tData } = await supabase.from('Template_Schede').select('*').eq('id_template', idTemplate).single();
      if (tData) {
        setTemplate(tData);
        setNewTemplateName(tData.nome_template);
      }
      const { data: gData } = await supabase.from('Giorni_Template').select('*').eq('id_template', idTemplate).order('ordine');
      if (gData) setGiorni(gData);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  }

  useEffect(() => { if (idTemplate) fetchDettagli(); }, [idTemplate]);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragItem.current === null) return;
    const touch = e.touches[0];
    const elementTarget = document.elementFromPoint(touch.clientX, touch.clientY);
    const rowContainer = elementTarget?.closest("[data-drag-index]");
    
    if (rowContainer) {
      const hoverIndex = parseInt(rowContainer.getAttribute("data-drag-index") || "");
      if (!isNaN(hoverIndex) && hoverIndex !== dragItem.current) {
        setGiorni(prev => {
          const newArr = [...prev];
          const dragged = newArr[dragItem.current!];
          newArr.splice(dragItem.current!, 1);
          newArr.splice(hoverIndex, 0, dragged);
          dragItem.current = hoverIndex;
          return newArr;
        });
      }
    }
  };

  const commitReorder = async () => {
    if (dragItem.current === null) return;
    dragItem.current = null;
    
    const currentList = listRef.current;
    const updatedGiorni = currentList.map((g, idx) => ({ ...g, ordine: idx + 1 }));
    setGiorni(updatedGiorni);

    if (template) {
      const updates = updatedGiorni.map(g => ({
        id_giorno: g.id_giorno,
        id_template: template.id_template,
        nome_giorno: g.nome_giorno,
        ordine: g.ordine
      }));
      await supabase.from('Giorni_Template').upsert(updates);
    }
  };

  const handleRenameTemplate = async () => {
    if (!newTemplateName.trim() || !template) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('Template_Schede').update({ nome_template: newTemplateName }).eq('id_template', template.id_template);
      if (error) throw error;
      setTemplate({ ...template, nome_template: newTemplateName });
      setIsRenamingTemplate(false);
    } catch (error) { console.error(error); } finally { setIsProcessing(false); }
  };

  const handleDeleteTemplate = async () => {
    if (!idTemplate) return;
    setIsProcessing(true);
    try {
      await supabase.from('Template_Schede').delete().eq('id_template', idTemplate);
      router.push('/create-template');
    } catch (error) { console.error(error); }
  };

  const handleRenameDay = async () => {
    if (!dayToRename || !newDayName.trim()) return;
    setIsProcessing(true);
    try {
      await supabase.from('Giorni_Template').update({ nome_giorno: newDayName }).eq('id_giorno', dayToRename.id_giorno);
      setGiorni(giorni.map(g => g.id_giorno === dayToRename.id_giorno ? { ...g, nome_giorno: newDayName } : g));
      setDayToRename(null);
    } catch (error) { console.error(error); } finally { setIsProcessing(false); }
  };

  const togglePublicStatus = async () => {
    if (!template || template.cloned_from) return; 
    setIsUpdatingStatus(true);
    const newStatus = !template.is_public;
    try {
      const { error } = await supabase.from('Template_Schede').update({ is_public: newStatus }).eq('id_template', template.id_template);
      if (error) throw error;
      setTemplate({ ...template, is_public: newStatus });
    } catch (e) {
      console.error("Errore aggiornamento stato pubblico:", e);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoading) return <main className="flex min-h-screen items-center justify-center bg-base text-main"><CleanSpinner size={64}/></main>;

  return (
    <main className="flex min-h-screen flex-col items-center pt-12 px-4 pb-20 relative overflow-x-hidden bg-base transition-colors duration-300">
      
      <div className="w-full max-w-2xl flex justify-between items-start mb-4 relative z-10">
        <div className="flex gap-4 items-center">
          <Link href="/create-template">
            <div className="w-12 h-12 bg-surface flex items-center justify-center border-2 border-line shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none">
              <ChevronLeft className="text-main" size={24} strokeWidth={3} />
            </div>
          </Link>
          
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-3xl font-black uppercase text-main tracking-tighter leading-none max-w-[200px] truncate">{template?.nome_template}</h1>
            
            <button onClick={() => setIsRenamingTemplate(true)} className="w-10 h-10 bg-surface flex items-center justify-center border-2 border-line shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#804CD9] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <Edit3 size={18} strokeWidth={3} className="text-main" />
            </button>
          </div>
        </div>
        
        <button onClick={() => setShowingDeleteAlert(true)} className="w-12 h-12 bg-[#ff331f] flex items-center justify-center border-2 border-line shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none">
          <Trash2 className="text-white" size={20} strokeWidth={3} />
        </button>
      </div>

      {/* === BOTTONE PUBBLICO / PRIVATO INTELLIGENTE === */}
      {template && (
        <div className="w-full max-w-2xl mb-8 relative z-10 flex justify-end">
          {template.cloned_from ? (
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-[#3366ff] border-2 border-[#1a1a1a] px-4 py-2 shadow-[2px_2px_0px_#000000]">
              <DownloadCloud size={14} strokeWidth={3} /> Scaricato
            </div>
          ) : (
            <button 
              onClick={togglePublicStatus}
              disabled={isUpdatingStatus}
              className={`flex items-center gap-2 px-5 py-2 font-black uppercase tracking-widest text-xs transition-all outline-none border-2 border-line shadow-[4px_4px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none 
                ${template.is_public ? 'bg-brand text-base' : 'bg-surface text-main'}`}
            >
              {isUpdatingStatus ? (
                <CleanSpinner size={16} />
              ) : template.is_public ? (
                <><Globe size={16} strokeWidth={3} /> Pubblico</>
              ) : (
                <><Lock size={16} strokeWidth={3} /> Privato</>
              )}
            </button>
          )}
        </div>
      )}

      <div className="w-full max-w-2xl flex flex-col gap-5 relative z-10">
        {giorni.map((giorno, index) => (
          <div 
              key={giorno.id_giorno} 
              data-drag-index={index}
              className="w-full bg-surface border-2 border-line p-4 flex items-center justify-between shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#804CD9] transition-all select-none"
            >
              <div className="flex items-center gap-3 overflow-hidden">
              <div 
                onTouchStart={(e) => { e.stopPropagation(); dragItem.current = index; }}
                onTouchMove={handleTouchMove}
                onTouchEnd={(e) => { e.stopPropagation(); commitReorder(); }}
                className="shrink-0 text-main/30 hover:text-main transition-colors mr-1 cursor-grab active:cursor-grabbing touch-none p-2 -ml-2"
              >
                <GripVertical size={24} strokeWidth={2.5} />
              </div>

              <span className="font-heading text-2xl font-black text-main uppercase tracking-tight truncate mr-2">{giorno.nome_giorno}</span>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={() => { setDayToRename(giorno); setNewDayName(giorno.nome_giorno); }} className="w-12 h-12 bg-base flex items-center justify-center border-2 border-line shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#804CD9] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
                <Edit3 size={20} strokeWidth={3} className="text-main" />
              </button>
              
              {/* === FIX DELLA ROTTA: Da Path Parameter a Query Parameter === */}
                <Link href={`/day?id=${giorno.id_giorno}`}>
                <div className="w-12 h-12 bg-brand flex items-center justify-center border-2 border-line shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#804CD9] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
                  <ChevronRight size={24} strokeWidth={3} className="text-base" />
                </div>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {isRenamingTemplate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-base w-full max-w-sm border-4 border-line p-8 flex flex-col gap-6 shadow-[12px_12px_0px_#000000] dark:shadow-[12px_12px_0px_#804CD9] animate-in zoom-in-95 duration-200">
            <h2 className="font-heading text-2xl font-black text-main text-center uppercase tracking-tighter">Rinomina Template</h2>
            <input type="text" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} className="w-full bg-surface border-2 border-line p-4 text-main font-bold outline-none focus:bg-base focus:shadow-[4px_4px_0px_#000000] dark:focus:shadow-[4px_4px_0px_#804CD9] transition-all" />
            <div className="flex gap-4">
              <button onClick={() => setIsRenamingTemplate(false)} className="flex-1 p-4 bg-surface border-2 border-line text-main font-black uppercase tracking-widest shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all">Annulla</button>
              <button onClick={handleRenameTemplate} className="flex-1 p-4 bg-brand border-2 border-line text-base font-black uppercase tracking-widest shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex justify-center items-center">{isProcessing ? <CleanSpinner size={20}/> : "SALVA"}</button>
            </div>
          </div>
        </div>
      )}

      {showingDeleteAlert && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-base w-full max-w-sm border-4 border-line p-8 flex flex-col gap-6 shadow-[12px_12px_0px_#000000] dark:shadow-[12px_12px_0px_#804CD9] animate-in zoom-in-95 duration-200 text-center">
            <h2 className="font-heading text-3xl font-black text-main uppercase tracking-tighter">Eliminare?</h2>
            <p className="text-muted font-bold uppercase tracking-widest text-xs">Questa azione non può essere annullata.</p>
            <div className="flex gap-4 mt-2">
              <button onClick={() => setShowingDeleteAlert(false)} className="flex-1 py-4 bg-surface border-2 border-line text-main font-black uppercase shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all">Annulla</button>
              <button onClick={handleDeleteTemplate} className="flex-1 py-4 bg-[#ff331f] border-2 border-line text-white font-black uppercase shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex justify-center items-center">
                {isProcessing ? <CleanSpinner size={20}/> : "ELIMINA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {dayToRename && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-base w-full max-w-sm border-4 border-line p-8 flex flex-col gap-6 shadow-[12px_12px_0px_#000000] dark:shadow-[12px_12px_0px_#804CD9] animate-in zoom-in-95 duration-200">
            <h2 className="font-heading text-2xl font-black text-main text-center uppercase tracking-tighter">Rinomina Giorno</h2>
            <input type="text" value={newDayName} onChange={(e) => setNewDayName(e.target.value)} className="w-full bg-surface border-2 border-line p-4 text-main font-bold outline-none focus:bg-base focus:shadow-[4px_4px_0px_#000000] dark:focus:shadow-[4px_4px_0px_#804CD9] transition-all" />
            <div className="flex gap-4">
              <button onClick={() => setDayToRename(null)} className="flex-1 p-4 bg-surface border-2 border-line text-main font-black uppercase tracking-widest shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all">Annulla</button>
              <button onClick={handleRenameDay} className="flex-1 p-4 bg-brand border-2 border-line text-base font-black uppercase tracking-widest shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex justify-center items-center">{isProcessing ? <CleanSpinner size={20}/> : "SALVA"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// === COMPONENTE CONTENITORE CON SUSPENSE ===
export default function TemplateDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-base text-main font-black uppercase tracking-widest">
        Caricamento...
      </div>
    }>
      <TemplateDetailContent />
    </Suspense>
  );
}