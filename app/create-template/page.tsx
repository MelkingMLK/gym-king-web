"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, SlidersHorizontal, Plus, Star, Check } from "lucide-react";
import { supabase } from "../../lib/supabase";

// === SPINNER A CERCHIO CONTINUO ROSA PASTEL ===
const CleanSpinner = ({ size = 24 }: { size?: number }) => {
  const color = "#EFA0A0";

  return (
    <div style={{ width: size, height: size, position: 'relative', color: color }}>
      <style>
        {`
          @keyframes cleanSpinnerRotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .spinner-ring {
            box-sizing: border-box;
            display: block;
            position: absolute;
            width: 100%;
            height: 100%;
            border: ${size * 0.1}px solid currentColor;
            border-radius: 50%;
            animation: cleanSpinnerRotate 1s cubic-bezier(0.5, 0, 0.5, 1) infinite;
            border-color: currentColor transparent transparent transparent;
          }
          .spinner-ring-track {
            box-sizing: border-box;
            display: block;
            position: absolute;
            width: 100%;
            height: 100%;
            border: ${size * 0.1}px solid currentColor;
            border-radius: 50%;
            opacity: 0.15;
          }
        `}
      </style>
      <div className="spinner-ring-track"></div>
      <div className="spinner-ring"></div>
    </div>
  );
};

type Template = {
  id_template: string;
  nome_template: string;
  is_favorite: boolean;
  id_categoria: string | null;
};

type Categoria = {
  id_categoria: string;
  nome_categoria: string;
  num_giorni: number; 
};

export default function CreateTemplatePage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categorie, setCategorie] = useState<Categoria[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateCategoryId, setNewTemplateCategoryId] = useState("");
  const [newTemplateDays, setNewTemplateDays] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [filterCategoriaID, setFilterCategoriaID] = useState<string | null>(null);

  async function fetchData() {
    setIsLoading(true);
    try {
      const { data: tData } = await supabase.from('Template_Schede').select('*').order('nome_template');
      if (tData) setTemplates(tData);

      const { data: cData } = await supabase.from('Categorie').select('*').order('nome_categoria');
      if (cData) setCategorie(cData);
    } catch (error) {
      console.error("Errore:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  const toggleFavorite = async (e: React.MouseEvent, template: Template) => {
    e.preventDefault();
    const wasFavorite = template.is_favorite;
    const newTemplates = templates.map(t => ({
      ...t,
      is_favorite: t.id_template === template.id_template ? !wasFavorite : false
    }));
    setTemplates(newTemplates);

    try {
      await supabase.from('Template_Schede').update({ is_favorite: false }).not('id_template', 'is', null);
      if (!wasFavorite) {
        await supabase.from('Template_Schede').update({ is_favorite: true }).eq('id_template', template.id_template);
      }
    } catch (error) {
      console.error(error);
      fetchData();
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCatId = e.target.value;
    
    if (selectedCatId === "NEW") {
      setIsCreatingNewCategory(true);
      setNewTemplateCategoryId("");
      setNewTemplateDays(1);
    } else {
      setIsCreatingNewCategory(false);
      setNewTemplateCategoryId(selectedCatId);
      
      if (selectedCatId) {
        const cat = categorie.find(c => c.id_categoria === selectedCatId);
        if (cat) {
          setNewTemplateDays(cat.num_giorni);
        }
      } else {
        setNewTemplateDays(1);
      }
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) return;
    if (isCreatingNewCategory && !newCategoryName.trim()) return;
    
    setIsSaving(true);
    try {
      let finalCategoryId = newTemplateCategoryId || null;

      if (isCreatingNewCategory && newCategoryName.trim()) {
        const newCatId = crypto.randomUUID();
        const { error: catError } = await supabase.from('Categorie').insert([{
          id_categoria: newCatId,
          nome_categoria: newCategoryName.trim(),
          num_giorni: newTemplateDays
        }]);
        if (catError) throw catError;
        finalCategoryId = newCatId;
      }

      const { data: nuovoTemplate, error: templateError } = await supabase
        .from('Template_Schede')
        .insert([{ 
          nome_template: newTemplateName,
          id_categoria: finalCategoryId,
          is_favorite: false 
        }])
        .select().single();

      if (templateError) throw templateError;

      if (nuovoTemplate && newTemplateDays > 0) {
        const giorni = Array.from({ length: newTemplateDays }, (_, i) => ({
          id_template: nuovoTemplate.id_template,
          nome_giorno: `Giorno ${i + 1}`,
          ordine: i + 1
        }));
        await supabase.from('Giorni_Template').insert(giorni);
      }
      
      resetModal();
      await fetchData();
    } catch (error) { 
      console.error(error); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const resetModal = () => {
    setIsModalOpen(false);
    setNewTemplateName("");
    setNewTemplateCategoryId("");
    setNewTemplateDays(1);
    setIsCreatingNewCategory(false);
    setNewCategoryName("");
  };

  const filteredTemplates = filterCategoriaID ? templates.filter(t => t.id_categoria === filterCategoriaID) : templates;

  return (
    <main className="flex min-h-screen flex-col items-center pt-12 px-4 pb-20 relative overflow-x-hidden bg-base transition-colors duration-300">
      
      {/* HEADER / TOP BAR - Z-INDEX ALZATO A 40 */}
      <div className="w-full max-w-2xl flex justify-between items-center mb-8 relative z-40">
        <Link href="/">
          <div className="w-12 h-12 bg-surface flex items-center justify-center border-2 border-line shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none">
            <ChevronLeft className="text-main" size={24} strokeWidth={3} />
          </div>
        </Link>

        <h1 className="font-heading text-3xl font-black uppercase text-main tracking-tight">Template</h1>

        <div className="relative">
          <button 
            onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)} 
            className={`w-12 h-12 flex items-center justify-center border-2 border-line transition-all shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none ${filterCategoriaID ? 'bg-brand text-base' : 'bg-surface text-main'}`}
          >
            <SlidersHorizontal size={20} strokeWidth={3} />
          </button>
          
          {isFilterMenuOpen && (
            <div className="absolute right-0 top-16 w-56 bg-surface border-2 border-line shadow-[8px_8px_0px_#000000] dark:shadow-[8px_8px_0px_#804CD9] z-50 flex flex-col">
              <button onClick={() => { setFilterCategoriaID(null); setIsFilterMenuOpen(false); }} className="w-full text-left px-5 py-4 text-main hover:bg-base flex items-center justify-between font-bold uppercase text-sm tracking-wider border-b-2 border-line">
                Tutti {!filterCategoriaID && <Check size={18} className="text-brand" strokeWidth={3} />}
              </button>
              {categorie.map((cat, i) => (
                <button key={cat.id_categoria} onClick={() => { setFilterCategoriaID(cat.id_categoria); setIsFilterMenuOpen(false); }} className={`w-full text-left px-5 py-4 text-main hover:bg-base flex items-center justify-between font-bold uppercase text-sm tracking-wider ${i !== categorie.length - 1 ? 'border-b-2 border-line' : ''}`}>
                  <span className="truncate">{cat.nome_categoria}</span>
                  {filterCategoriaID === cat.id_categoria && <Check size={18} className="text-brand" strokeWidth={3} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center mt-20">
          <CleanSpinner size={64} />
        </div>
      ) : (
        <div className="w-full max-w-2xl flex flex-col gap-6 relative z-10">
          
          <button 
            onClick={() => {
              setIsFilterMenuOpen(false); 
              setIsModalOpen(true);
            }} 
            className="w-full py-6 bg-surface border-4 border-dashed border-line shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] flex flex-col items-center justify-center gap-2 transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#000000] dark:hover:shadow-[2px_2px_0px_#804CD9] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
          >
            <Plus className="text-main" size={32} strokeWidth={3} />
            <span className="text-main font-black uppercase tracking-widest text-sm">Crea nuovo template</span>
          </button>

         <div className="flex flex-col gap-5 mt-4">
            {filteredTemplates.map((template) => {
              const cat = categorie.find(c => c.id_categoria === template.id_categoria);
              return (
                <Link key={template.id_template} href={`/template/${template.id_template}`} className="w-full group outline-none">
                  <div className="w-full bg-base border-2 border-line p-4 flex items-center gap-5 transition-all shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#804CD9] group-hover:translate-x-[2px] group-hover:translate-y-[2px] group-hover:shadow-[4px_4px_0px_#000000] dark:group-hover:shadow-[4px_4px_0px_#804CD9] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none">
                    
                    {/* AVATAR BOX (Sfondo bianco sporco forzato a priori) */}
                    <div className="w-16 h-16 bg-[#f4f4f0] border-2 border-[#1a1a1a] flex items-center justify-center shrink-0 overflow-hidden">
                      <img src="/icona.png" alt="Icon" className="w-14 h-14 object-contain scale-125" />
                    </div>
                    
                    <div className="flex-1 flex flex-col overflow-hidden justify-center gap-1">
                      <span className="font-heading text-xl text-main font-black uppercase truncate tracking-tight">{template.nome_template}</span>
                      {cat ? 
                        <span className="text-xs uppercase tracking-widest text-brand font-bold">{cat.nome_categoria}</span> 
                        : 
                        <span className="text-xs uppercase tracking-widest text-muted font-bold">Custom</span>
                      }
                    </div>
                    
                    <button className="p-3 shrink-0 transition-transform hover:scale-125" onClick={(e) => toggleFavorite(e, template)}>
                      <Star size={26} strokeWidth={2.5} className={template.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-muted hover:text-main"} />
                    </button>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* MODALE DI CREAZIONE (Z-index alzato a 100) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-base w-full max-w-md border-4 border-line p-8 flex flex-col gap-6 shadow-[12px_12px_0px_#000000] dark:shadow-[12px_12px_0px_#804CD9] animate-in zoom-in-95 duration-200">
            
            <h2 className="font-heading text-3xl font-black text-main text-center uppercase tracking-tighter">Nuovo Template</h2>
            
            <div className="flex flex-col gap-2">
              <label className="text-xs text-muted uppercase font-black tracking-widest">Nome Template</label>
              <input 
                type="text" 
             
                value={newTemplateName} 
                onChange={(e) => setNewTemplateName(e.target.value)} 
                className="w-full bg-surface border-2 border-line p-4 text-main font-bold outline-none focus:bg-base focus:shadow-[4px_4px_0px_#000000] dark:focus:shadow-[4px_4px_0px_#804CD9] transition-all placeholder:text-muted/50" 
                disabled={isSaving} 
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-muted uppercase font-black tracking-widest">Categoria</label>
              <select 
                value={isCreatingNewCategory ? "NEW" : newTemplateCategoryId} 
                onChange={handleCategoryChange} 
                className="w-full bg-surface border-2 border-line p-4 text-main font-bold outline-none focus:bg-base focus:shadow-[4px_4px_0px_#000000] dark:focus:shadow-[4px_4px_0px_#804CD9] transition-all appearance-none" 
                disabled={isSaving}
              >
                <option value="">Personalizzato</option>
                {categorie.map(cat => <option key={cat.id_categoria} value={cat.id_categoria}>{cat.nome_categoria}</option>)}
                <option value="NEW" className="font-black text-brand">+ CREA NUOVA CATEGORIA</option>
              </select>
            </div>

            {isCreatingNewCategory && (
              <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                <label className="text-xs text-brand uppercase font-black tracking-widest">Nome Nuova Categoria</label>
                <input 
                  type="text" 
                  placeholder="Es. Full Body" 
                  value={newCategoryName} 
                  onChange={(e) => setNewCategoryName(e.target.value)} 
                  className="w-full bg-brand/10 border-2 border-brand p-4 text-main font-bold outline-none focus:shadow-[4px_4px_0px_var(--brand-accent)] transition-all" 
                  disabled={isSaving} 
                  autoFocus
                />
              </div>
            )}

            <div className="flex flex-col gap-3 mt-2">
              <label className="text-xs text-muted uppercase font-black tracking-widest">Numero di Giorni</label>
              <div className="flex justify-between gap-2">
                {[1, 2, 3, 4, 5, 6].map(num => {
                  const isSelected = newTemplateDays === num;
                  const isLocked = !!newTemplateCategoryId && !isCreatingNewCategory;
                  
                  return (
                    <button
                      key={num}
                      onClick={() => !isLocked && setNewTemplateDays(num)}
                      disabled={isSaving || isLocked}
                      className={`flex-1 py-4 font-black transition-all text-lg border-2 border-line
                        ${isSelected ? 'bg-brand text-base shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] translate-x-[-2px] translate-y-[-2px]' : 'bg-surface text-main hover:bg-base'}
                        ${isLocked && !isSelected ? 'opacity-30 cursor-not-allowed' : ''}
                        ${isLocked && isSelected ? 'opacity-90 cursor-not-allowed' : ''}
                      `}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button 
                onClick={resetModal} 
                className="flex-1 p-5 bg-surface border-2 border-line text-main font-black uppercase tracking-widest shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all" 
                disabled={isSaving}
              >
                Annulla
              </button>
              <button 
                onClick={handleCreateTemplate} 
                className="flex-1 p-5 bg-brand border-2 border-line text-base font-black uppercase tracking-widest shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex justify-center items-center" 
                disabled={isSaving}
              >
                {isSaving ? <CleanSpinner size={24} /> : "CREA"}
              </button>
            </div>
            
          </div>
        </div>
      )}
    </main>
  );
}