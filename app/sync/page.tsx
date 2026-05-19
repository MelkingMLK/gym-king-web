"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { ChevronLeft, RefreshCw, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import Fuse from "fuse.js";

type NormalizedExercise = {
  name: string;
  searchName: string;
  gifUrl: string;
};

export default function SyncPage() {
  const [status, setStatus] = useState("Pronto.");
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const startSync = async () => {
    setIsSyncing(true);
    setIsDone(false);
    setProgress(0);

    try {
      setStatus("Scaricando il database di GIF da jsDelivr...");
      
      const res = await fetch("https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/api/en/exercises.json");
      if (!res.ok) throw new Error("Errore durante il download del JSON API");
      
      const rawData = await res.json();
      
      // 1. GESTIONE STRUTTURA DINAMICA
      // Non sappiamo se rawData è un Array o un Oggetto. Lo normalizziamo.
      let arrayData: any[] = [];
      if (Array.isArray(rawData)) {
        arrayData = rawData;
      } else if (rawData.exercises && Array.isArray(rawData.exercises)) {
        arrayData = rawData.exercises;
      } else {
        arrayData = Object.values(rawData); // Se è un dizionario { "ex1": {}, "ex2": {} }
      }

      // 2. ESTRAZIONE AGGRESSIVA DEI DATI
      const apiExercises: NormalizedExercise[] = arrayData.map(ex => {
        // Cerca il nome ovunque si nasconda nel JSON
        let rawName = ex.name || (ex.en ? ex.en.name : "") || ex.id || "";
        // Cerca la gif ovunque si nasconda
        let rawGifUrl = ex.gifUrl || ex.gif_url || ex.url || (ex.images && ex.images[0]) || "";
        
        return {
          name: rawName,
          // Rimuoviamo trattini e underscore per aiutare l'algoritmo di ricerca
          searchName: rawName.replace(/[-_]/g, ' ').toLowerCase(), 
          gifUrl: rawGifUrl
        };
      }).filter(ex => ex.searchName !== "" && ex.gifUrl !== "");

      console.log(`Trovate ${apiExercises.length} GIF valide nell'API.`);

      setStatus("Leggendo i tuoi esercizi da Supabase...");
      const { data: dbExercises, error } = await supabase
        .from('Esercizi')
        .select('id_esercizio, nome_inglese, nome')
        .not('nome_inglese', 'is', null);

      if (error || !dbExercises) throw new Error("Errore lettura DB Supabase");

      setTotal(dbExercises.length);
      let aggiornati = 0;

      setStatus("Calcolo dei Match (Fuzzy Search)...");
      
      // Istruiamo Fuse.js a cercare dentro "searchName" che abbiamo pulito dai trattini
      const fuse = new Fuse<NormalizedExercise>(apiExercises, { 
        keys: ['searchName'], 
        threshold: 0.05, // Molto elastico per perdonare errori di battitura o plurali
        ignoreLocation: true 
      });
      
      for (let i = 0; i < dbExercises.length; i++) {
        const dbEx = dbExercises[i];
        
        // Puliamo anche il tuo nome nel database prima di cercare
        const searchTerm = dbEx.nome_inglese.replace(/[-_]/g, ' ').toLowerCase();
        
        const results = fuse.search(searchTerm);

        if (results.length > 0) {
          const match = results[0].item; 
          
          if (match && match.gifUrl) {
            // FIRE! Aggiorniamo Supabase.
            await supabase
              .from('Esercizi')
              .update({ gif_url: match.gifUrl })
              .eq('id_esercizio', dbEx.id_esercizio);
              
            aggiornati++;
            console.log(`[OK] ${dbEx.nome_inglese} -> ${match.gifUrl}`);
          }
        } else {
          console.log(`[FALLITO] Nessun match trovato per: ${dbEx.nome_inglese}`);
        }
        
        setProgress(i + 1);
      }

      setStatus(`Vittoria finale! Trovate e collegate ${aggiornati} GIF animate su ${dbExercises.length}.`);
      setIsDone(true);

    } catch (error) {
      console.error(error);
      setStatus("Si è verificato un errore critico durante la sincronizzazione.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center pt-12 px-4 pb-20 bg-base text-main">
      <div className="w-full max-w-2xl flex justify-between items-center mb-10">
        <Link href="/">
          <div className="w-12 h-12 bg-surface flex items-center justify-center border-2 border-line shadow-[4px_4px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all">
            <ChevronLeft size={24} strokeWidth={3} />
          </div>
        </Link>
        <h1 className="font-heading text-2xl font-black uppercase tracking-tighter">Sync API</h1>
        <div className="w-12 h-12" />
      </div>

      <div className="w-full max-w-2xl bg-surface border-4 border-line p-8 flex flex-col items-center text-center gap-6 shadow-[8px_8px_0px_#000000]">
        
        <div className="bg-brand p-4 border-2 border-line rounded-full mb-4">
          <RefreshCw size={48} strokeWidth={2.5} className={isSyncing ? "animate-spin text-base" : "text-base"} />
        </div>

        <h2 className="font-heading text-3xl font-black uppercase tracking-tight">Motore di Sincronizzazione</h2>
        
        <p className="font-bold text-muted uppercase tracking-widest text-sm">
          Questo script estrae aggressivamente le GIF dall'API normalizzando i formati e usando la ricerca fuzzy per evitare miss-match causati da trattini o formattazioni.
        </p>

        <div className="w-full bg-base border-2 border-line p-4 font-mono text-sm font-bold text-left mt-4 h-24 flex flex-col justify-center">
          <span className="text-brand">&gt; {status}</span>
          {total > 0 && !isDone && (
            <span className="text-main mt-2">&gt; Progresso: {progress} / {total}</span>
          )}
        </div>

        <button 
          onClick={startSync}
          disabled={isSyncing || isDone}
          className="w-full py-6 mt-4 bg-brand border-2 border-line text-base font-black uppercase tracking-widest text-2xl shadow-[6px_6px_0px_#000000] hover:-translate-y-1 hover:shadow-[8px_8px_0px_#000000] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[6px_6px_0px_#000000]"
        >
          {isDone ? <span className="flex items-center justify-center gap-2"><CheckCircle2 size={28}/> COMPLETATO</span> : "AVVIA SYNC"}
        </button>
      </div>
    </main>
  );
}