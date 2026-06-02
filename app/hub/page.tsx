"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Globe, DownloadCloud, Dumbbell, DatabaseBackup, CheckCircle2, SlidersHorizontal, ChevronDown, ArrowBigUp, ArrowBigDown, Check, Trash2, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";

const CleanSpinner = ({ size = 24 }: { size?: number }) => {
  const strokeWidth = Math.max(2, Math.round(size * 0.1));
  return (
    <div className="relative flex items-center justify-center animate-spin" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full border-main opacity-10" style={{ borderWidth: strokeWidth }} />
      <div className="absolute inset-0 rounded-full border-transparent border-t-brand" style={{ borderWidth: strokeWidth }} />
    </div>
  );
};

type TemplatePubblico = { id_template: string; nome_template: string; id_categoria: string | null; user_id: string; };
type Categoria = { id_categoria: string; nome_categoria: string; };

type UgcExercise = { id_esercizio: number; nome: string; upvotes: number; user_id: string; };
type Muscolo = { id_gruppo?: number; id?: number; nome: string; };
type Attrezzo = { id_attrezzo?: number; id?: number; nome: string; };
type RelazioneMuscolo = { id_esercizio?: number; id_gruppo?: number; };
type RelazioneAttrezzo = { id_esercizio?: number; id_attrezzo?: number; };

// ==========================================
// 🔴 ZONA DI COMANDO ADMIN 🔴
const ADMIN_UUID = "202a5a03-4f1b-4001-a125-f41f5348e32f"; 
// ==========================================

export default function HubPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"schede" | "esercizi">("schede");
  
  const [templates, setTemplates] = useState<TemplatePubblico[]>([]);
  const [categorie, setCategorie] = useState<Categoria[]>([]);
  
  const [ugcExercises, setUgcExercises] = useState<UgcExercise[]>([]);
  const [muscoli, setMuscoli] = useState<Muscolo[]>([]);
  const [attrezzi, setAttrezzi] = useState<Attrezzo[]>([]);
  const [relMuscoli, setRelMuscoli] = useState<RelazioneMuscolo[]>([]);
  const [relAttrezzi, setRelAttrezzi] = useState<RelazioneAttrezzo[]>([]);
  
  // Tracciamento Voti Locali: { id_esercizio: 1 | -1 }
  const [localVotes, setLocalVotes] = useState<Record<number, number>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [isProcessingUGC, setIsProcessingUGC] = useState<number | null>(null);

  const [filterCategoriaID, setFilterCategoriaID] = useState<string | null>(null);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const savedVotes = JSON.parse(localStorage.getItem('gymking_ugc_votes') || '{}');
    setLocalVotes(savedVotes);

    async function fetchHubData() {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Non autenticato");
        setCurrentUserId(user.id);

        if (activeTab === "schede") {
          const { data: catData } = await supabase.from('Categorie').select('id_categoria, nome_categoria').order('nome_categoria');
          if (catData) setCategorie(catData);

          const { data: tData } = await supabase.from('Template_Schede').select('id_template, nome_template, id_categoria, user_id').eq('is_public', true).neq('user_id', user.id);
          if (tData) setTemplates(tData);
        } 
        else if (activeTab === "esercizi") {
          const { data: eData } = await supabase.from('Esercizi').select('id_esercizio, nome, upvotes, user_id').eq('is_approved', false).order('upvotes', { ascending: false });
          if (eData) setUgcExercises(eData as UgcExercise[]);

          const { data: mData } = await supabase.from('GruppiMuscolari').select('*');
          if (mData) setMuscoli(mData as Muscolo[]);

          const { data: aData } = await supabase.from('Attrezzi').select('*');
          if (aData) setAttrezzi(aData as Attrezzo[]);

          let { data: relMData, error: relMErr } = await supabase.from('Esercizio_Muscolo').select('*');
          if (relMErr) { const fallback = await supabase.from('esercizio_muscolo').select('*'); relMData = fallback.data; }
          if (relMData) setRelMuscoli(relMData as RelazioneMuscolo[]);

          let { data: relAData, error: relAErr } = await supabase.from('Esercizio_Attrezzo').select('*');
          if (relAErr) { const fallback = await supabase.from('esercizio_attrezzo').select('*'); relAData = fallback.data; }
          if (relAData) setRelAttrezzi(relAData as RelazioneAttrezzo[]);
        }

      } catch (err) {
        console.error("Errore fetch hub:", err);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchHubData();
  }, [activeTab]);

  const handleDownloadTemplate = async (templateId: string) => {
    if (cloningId) return; setCloningId(templateId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Auth fallita");

      const { data: origTpl } = await supabase.from('Template_Schede').select('*').eq('id_template', templateId).single();
      if (!origTpl) throw new Error("Template non trovato");

      const { data: newTpl } = await supabase.from('Template_Schede').insert([{ user_id: user.id, nome_template: origTpl.nome_template, id_categoria: origTpl.id_categoria, is_public: false, cloned_from: origTpl.id_template, is_favorite: false }]).select().single();
      if (!newTpl) throw new Error("Errore inserimento Tpl");

      const { data: origGiorni } = await supabase.from('Giorni_Template').select('*').eq('id_template', templateId).order('ordine');
      if (origGiorni && origGiorni.length > 0) {
        for (const og of origGiorni) {
          const { data: newGiorno } = await supabase.from('Giorni_Template').insert([{ id_template: newTpl.id_template, nome_giorno: og.nome_giorno, ordine: og.ordine }]).select().single();
          if (!newGiorno) continue;

          const { data: origEsercizi } = await supabase.from('Scheda_Esercizi').select('*').eq('id_giorno', og.id_giorno);
          if (origEsercizi && origEsercizi.length > 0) {
            const payloadEsercizi = origEsercizi.map(oe => ({ id_giorno: newGiorno.id_giorno, id_esercizio: oe.id_esercizio, serie: oe.serie, ripetizioni: oe.ripetizioni, recupero_sec: oe.recupero_sec, ordine: oe.ordine, unita_misura: oe.unita_misura }));
            await supabase.from('Scheda_Esercizi').insert(payloadEsercizi);
          }
        }
      }
      setSuccessId(templateId); setTimeout(() => setSuccessId(null), 3000);
    } catch (err: any) { alert("Errore critico durante la clonazione."); } finally { setCloningId(null); }
  };

  // === MOTORE DI VOTO UGC (UPVOTE E DOWNVOTE) ===
  const handleVote = async (id_esercizio: number, currentUpvotes: number, delta: 1 | -1) => {
    const currentVote = localVotes[id_esercizio] || 0;
    if (currentVote === delta) return; 

    setIsProcessingUGC(id_esercizio);
    try {
      const voteDiff = delta - currentVote;
      const newCount = (currentUpvotes || 0) + voteDiff;

      await supabase.from('Esercizi').update({ upvotes: newCount }).eq('id_esercizio', id_esercizio);
      
      const newLocal = { ...localVotes, [id_esercizio]: delta };
      setLocalVotes(newLocal);
      localStorage.setItem('gymking_ugc_votes', JSON.stringify(newLocal));
      
      setUgcExercises(prev => prev.map(ex => ex.id_esercizio === id_esercizio ? { ...ex, upvotes: newCount } : ex).sort((a, b) => b.upvotes - a.upvotes));
    } catch (error) { console.error(error); } finally { setIsProcessingUGC(null); }
  };

  const handleAdminApprove = async (id_esercizio: number) => {
    if (!window.confirm("Rendere questo esercizio globale e visibile a tutti?")) return;
    setIsProcessingUGC(id_esercizio);
    try {
      await supabase.from('Esercizi').update({ is_approved: true }).eq('id_esercizio', id_esercizio);
      setUgcExercises(prev => prev.filter(ex => ex.id_esercizio !== id_esercizio)); 
    } catch (error) { console.error(error); } finally { setIsProcessingUGC(null); }
  };

  const handleAdminReject = async (id_esercizio: number) => {
    if (!window.confirm("Eliminare definitivamente questo esercizio spazzatura?")) return;
    setIsProcessingUGC(id_esercizio);
    try {
      await supabase.from('Esercizi').delete().eq('id_esercizio', id_esercizio);
      setUgcExercises(prev => prev.filter(ex => ex.id_esercizio !== id_esercizio));
    } catch (error) { console.error(error); } finally { setIsProcessingUGC(null); }
  };

  const risultatiFiltrati = filterCategoriaID ? templates.filter(t => t.id_categoria === filterCategoriaID) : templates;
  const nomeCategoriaAttiva = filterCategoriaID ? categorie.find(c => c.id_categoria === filterCategoriaID)?.nome_categoria || "Sconosciuta" : "Tutte le Categorie";
  const isAdmin = currentUserId === ADMIN_UUID;

  return (
    <main className="flex min-h-screen flex-col items-center bg-base p-4 pb-28 pt-8 overflow-x-hidden">
      
      <div className="w-full max-w-2xl flex justify-between items-center mb-8 relative z-10">
        <Link href="/">
          <div className="w-12 h-12 bg-surface flex items-center justify-center border-2 border-line shadow-[4px_4px_0px_#000000] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none">
            <ChevronLeft className="text-main" size={24} strokeWidth={3} />
          </div>
        </Link>
        <h1 className="font-heading text-4xl font-black uppercase text-main tracking-tighter">Hub</h1>
        <div className="w-12 h-12" />
      </div>

      <div className="w-full max-w-2xl flex border-4 border-line mb-8 bg-surface shadow-[4px_4px_0px_#000000] overflow-hidden shrink-0">
        <button 
          onClick={() => setActiveTab("schede")} 
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] sm:text-xs transition-all outline-none 
            ${activeTab === "schede" ? 'bg-main text-base' : 'bg-surface text-main hover:bg-base/50'}`}
        >
          <Globe size={18} strokeWidth={2.5} /> Schede Community
        </button>
        <button 
          onClick={() => setActiveTab("esercizi")} 
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] sm:text-xs transition-all outline-none 
            ${activeTab === "esercizi" ? 'bg-brand text-base' : 'bg-surface text-main hover:bg-base/50'}`}
        >
          <Dumbbell size={18} strokeWidth={2.5} /> Esercizi In Attesa
        </button>
      </div>

      {activeTab === "schede" && (
        <div className="w-full max-w-2xl flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex flex-col gap-2">
            <button onClick={() => setIsFilterExpanded(!isFilterExpanded)} className="w-full bg-surface border-4 border-line p-4 flex items-center justify-between shadow-[4px_4px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all outline-none">
              <div className="flex items-center gap-3">
                <SlidersHorizontal size={20} strokeWidth={2.5} className="text-brand" />
                <div className="flex flex-col items-start">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted leading-none">Filtro Attivo</span>
                  <span className="font-heading text-lg font-black uppercase text-main leading-tight truncate max-w-[200px] sm:max-w-xs">{nomeCategoriaAttiva}</span>
                </div>
              </div>
              <ChevronDown size={24} strokeWidth={3} className={`text-main transition-transform duration-300 ${isFilterExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isFilterExpanded && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 animate-in fade-in slide-in-from-top-2">
                <button onClick={() => { setFilterCategoriaID(null); setIsFilterExpanded(false); }} className={`p-3 font-black uppercase text-[10px] sm:text-xs border-2 border-line text-left transition-colors outline-none shadow-[2px_2px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${!filterCategoriaID ? 'bg-brand text-base shadow-none translate-x-[2px] translate-y-[2px]' : 'bg-surface text-main hover:bg-base'}`}>Tutte</button>
                {categorie.map(cat => (
                  <button key={cat.id_categoria} onClick={() => { setFilterCategoriaID(cat.id_categoria); setIsFilterExpanded(false); }} className={`p-3 font-black uppercase text-[10px] sm:text-xs border-2 border-line text-left transition-colors outline-none truncate shadow-[2px_2px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${filterCategoriaID === cat.id_categoria ? 'bg-brand text-base shadow-none translate-x-[2px] translate-y-[2px]' : 'bg-surface text-main hover:bg-base'}`}>{cat.nome_categoria}</button>
                ))}
              </div>
            )}
          </div>

          {isLoading ? <div className="flex justify-center py-20"><CleanSpinner size={48} /></div> : risultatiFiltrati.length === 0 ? (
            <div className="border-4 border-dashed border-line p-12 text-center bg-surface/40 flex flex-col items-center justify-center gap-4 mt-4">
              <Globe size={40} strokeWidth={2} className="text-muted opacity-40"/>
              <p className="text-lg font-black uppercase text-muted tracking-wide">Nessun template trovato</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5 mt-2">
              {risultatiFiltrati.map((template) => {
                const cat = categorie.find(c => c.id_categoria === template.id_categoria);
                const isCloning = cloningId === template.id_template;
                const isSuccess = successId === template.id_template;
                return (
                  <div key={template.id_template} className="w-full bg-base border-4 border-line p-4 flex items-center justify-between gap-4 shadow-[6px_6px_0px_#000000] hover:-translate-y-1 transition-transform">
                    <div className="flex items-center gap-4 overflow-hidden flex-1">
                      <div className="w-14 h-14 bg-surface border-2 border-line flex items-center justify-center shrink-0"><DatabaseBackup size={24} strokeWidth={2} className="text-main/50" /></div>
                      <div className="flex flex-col overflow-hidden gap-1">
                        <span className="font-heading text-xl text-main font-black uppercase truncate tracking-tight leading-none">{template.nome_template}</span>
                        <div className="flex items-center gap-2 mt-1"><span className="text-[9px] uppercase tracking-widest font-black border border-line px-1.5 py-0.5 bg-surface text-brand">{cat ? cat.nome_categoria : "Custom"}</span></div>
                      </div>
                    </div>
                    <button onClick={() => handleDownloadTemplate(template.id_template)} disabled={isCloning || isSuccess} className={`w-14 h-14 shrink-0 border-2 border-line flex items-center justify-center shadow-[4px_4px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all outline-none ${isSuccess ? 'bg-emerald-400 text-black border-black shadow-none translate-x-[4px] translate-y-[4px]' : 'bg-[#3366ff] text-white hover:bg-blue-600'}`}>
                      {isCloning ? <CleanSpinner size={20} /> : isSuccess ? <CheckCircle2 size={24} strokeWidth={3} /> : <DownloadCloud size={24} strokeWidth={3} />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "esercizi" && (
        <div className="w-full max-w-2xl flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
          
          {/* BADGE ADMIN FLOTTANTE */}
          {isAdmin && (
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-main text-base px-3 py-2 w-fit shadow-[2px_2px_0px_var(--brand-accent)] border-2 border-line mb-[-10px]">
              <ShieldAlert size={16} className="text-brand"/> Modalità Amministratore
            </div>
          )}

          {isLoading ? <div className="flex justify-center py-20"><CleanSpinner size={48} /></div> : ugcExercises.length === 0 ? (
            <div className="border-4 border-dashed border-line p-12 text-center bg-surface/40 flex flex-col items-center justify-center gap-4 mt-4">
              <CheckCircle2 size={40} strokeWidth={2} className="text-muted opacity-40"/>
              <p className="text-lg font-black uppercase text-muted tracking-wide">Tutto Pulito</p>
              <p className="text-xs font-bold text-muted/60 uppercase">Nessun esercizio in attesa di approvazione.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {ugcExercises.map((es) => {
                const esId = String(es.id_esercizio);
                const isProcessing = isProcessingUGC === es.id_esercizio;
                const userVote = localVotes[es.id_esercizio] || 0;

                const relatedMuscles = muscoli.filter(m => relMuscoli.some(rm => String(rm.id_esercizio ?? (rm as any).esercizio_id) === esId && String(rm.id_gruppo ?? (rm as any).gruppo_id) === String(m.id_gruppo ?? m.id)));
                const relatedEquipment = attrezzi.filter(a => relAttrezzi.some(ra => String(ra.id_esercizio ?? (ra as any).esercizio_id) === esId && String(ra.id_attrezzo ?? (ra as any).attrezzo_id) === String(a.id_attrezzo ?? a.id)));

                return (
                  <div key={es.id_esercizio} className="w-full bg-surface border-4 border-line p-4 shadow-[6px_6px_0px_#000000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    
                    <div className="flex flex-col gap-2 flex-1">
                      <span className="font-heading text-2xl font-black uppercase text-main tracking-tight leading-none break-words pr-2">{es.nome}</span>
                      
                      <div className="flex flex-wrap gap-2">
                        {relatedMuscles.length > 0 ? relatedMuscles.map(m => (
                          <span key={m.id_gruppo ?? m.id} className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-line text-base">{m.nome}</span>
                        )) : <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border border-line text-muted">Muscolo N/D</span>}

                        {relatedEquipment.length > 0 ? relatedEquipment.map(a => (
                          <span key={a.id_attrezzo ?? a.id} className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border border-line text-main">{a.nome}</span>
                        )) : <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border border-line text-muted">Attrezzo N/D</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                      
                      {/* VOTO COMMUNITY: DOWN - COUNT - UP */}
                      <div className="flex items-center bg-base border-2 border-line shadow-[2px_2px_0px_#000000]">
                        <button 
                          onClick={() => handleVote(es.id_esercizio, es.upvotes, -1)}
                          disabled={isProcessing || userVote === -1}
                          className={`w-10 h-10 flex items-center justify-center border-r-2 border-line transition-all active:bg-base outline-none
                            ${userVote === -1 ? 'bg-[#ff331f] text-white opacity-80 cursor-not-allowed' : 'bg-surface text-main hover:bg-[#ff331f] hover:text-white'}`}
                        >
                          {isProcessing ? <CleanSpinner size={16} /> : <ArrowBigDown size={22} strokeWidth={2.5} />}
                        </button>
                        
                        <span className="font-mono font-black text-lg px-4 text-center min-w-[3rem]">{es.upvotes || 0}</span>
                        
                        <button 
                          onClick={() => handleVote(es.id_esercizio, es.upvotes, 1)}
                          disabled={isProcessing || userVote === 1}
                          className={`w-10 h-10 flex items-center justify-center border-l-2 border-line transition-all active:bg-base outline-none
                            ${userVote === 1 ? 'bg-emerald-400 text-black opacity-80 cursor-not-allowed' : 'bg-surface text-main hover:bg-emerald-400 hover:text-black'}`}
                        >
                          {isProcessing ? <CleanSpinner size={16} /> : <ArrowBigUp size={22} strokeWidth={2.5} />}
                        </button>
                      </div>

                      {/* PANNELLO ADMIN */}
                      {isAdmin && (
                        <div className="flex items-center gap-2 pl-4 border-l-2 border-line border-dashed">
                          <button onClick={() => handleAdminApprove(es.id_esercizio)} disabled={isProcessing} className="w-10 h-10 bg-emerald-400 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all outline-none">
                            {isProcessing ? <CleanSpinner size={16} /> : <Check size={20} strokeWidth={4} className="text-black" />}
                          </button>
                          <button onClick={() => handleAdminReject(es.id_esercizio)} disabled={isProcessing} className="w-10 h-10 bg-[#ff331f] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all outline-none">
                            {isProcessing ? <CleanSpinner size={16} /> : <Trash2 size={18} strokeWidth={3} className="text-white" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </main>
  );
}