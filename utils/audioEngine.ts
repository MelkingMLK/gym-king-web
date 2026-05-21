// Manteniamo le istanze globali per non ricaricare il file a ogni render
let audioCtx: AudioContext | null = null;
let audioBuffer: AudioBuffer | null = null;

// 1. Inizializza il contesto
export const initAudioContext = () => {
  if (typeof window === "undefined") return; // Previene crash nel Server-Side Rendering
  
  if (!audioCtx) {
    // Gestione compatibilità per Safari (webkit)
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
};

// 2. Pre-carica il suono in memoria (Buffer)
export const loadAudioFile = async (url: string) => {
  if (!audioCtx) initAudioContext();
  if (audioBuffer) return; // Evita di riscaricare il file se già in memoria

  try {
    const response = await fetch(url);
    
    // IL CONTROLLO MANCANTE: Verifichiamo che il server abbia risposto con 200 OK
    if (!response.ok) {
      throw new Error(`File audio non trovato o irraggiungibile (HTTP ${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    audioBuffer = await audioCtx!.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.error("Errore irreversibile nel caricamento dell'audio:", error);
  }
};
// 3. Riproduce il suono
export const playSound = () => {
  if (!audioCtx || !audioBuffer) {
    console.warn("Motore audio non inizializzato o buffer vuoto.");
    return;
  }

  // iOS blocca il contesto audio finché non c'è un'interazione esplicita dell'utente.
  // Se è sospeso, lo "svegliamo" forzatamente prima di suonare.
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  // Creiamo un "nodo" sorgente che leggerà il nostro buffer
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination); // Collega la sorgente alle casse/cuffie
  source.start(0); // Suona immediatamente
};