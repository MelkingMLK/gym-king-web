"use client";

let audioCtx: AudioContext | null = null;
let audioBuffer: AudioBuffer | null = null;
let isUnlocked = false;

// === MOTORE DI BACKUP NATIVO ===
let nativeAudioFallback: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;

export const initAudioContext = () => {
  if (typeof window === "undefined") return;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
};

export const unlockAudio = () => {
  if (typeof window === "undefined") return;
  initAudioContext();
  if (!audioCtx) return;

  try {
    // === FORZATURA ANTI-HIJACKING PREVENTIVA ===
    // Se l'utente tocca lo schermo dopo aver messo in pausa Spotify, riattiviamo il canale.
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    if (isUnlocked) return;

    const buffer = audioCtx.createBuffer(1, 1, 22050);
    const node = audioCtx.createBufferSource();
    node.buffer = buffer;
    node.connect(audioCtx.destination);
    node.start(0);
    
    if (nativeAudioFallback) {
      nativeAudioFallback.play().then(() => {
        nativeAudioFallback?.pause();
        if (nativeAudioFallback) nativeAudioFallback.currentTime = 0;
      }).catch(() => {});
    }

    isUnlocked = true;
  } catch (e) {
    console.error("Audio unlock fallito:", e);
  }
};

export const loadAudioFile = async (url: string) => {
  if (typeof window === "undefined") return;
  currentAudioUrl = url;

  // 1. Pre-caricamento del Fallback Nativo
  if (!nativeAudioFallback) {
    nativeAudioFallback = new Audio(url);
    nativeAudioFallback.preload = "auto";
  } else if (nativeAudioFallback.src !== url) {
    nativeAudioFallback.src = url;
    nativeAudioFallback.load();
  }

  // 2. Caricamento Web Audio API Buffer
  initAudioContext();
  if (!audioCtx) return;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network response was not ok");
    const arrayBuffer = await response.arrayBuffer();
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (e) {
    console.warn("Web Audio API buffer failed, relies on native fallback.", e);
    audioBuffer = null; 
  }
};

export const playSound = () => {
  // Preveniamo l'esecuzione lato server (Next.js SSR)
  if (typeof window === "undefined") return;

  try {
    // 1. Recupero rigoroso delle preferenze normalizzate dal localStorage
    const savedSound = localStorage.getItem("gymking_sound") || "sounds/gong.mp3";
    const savedVolume = localStorage.getItem("gymking_volume");
    const volume = savedVolume !== null ? parseFloat(savedVolume) : 1.0;

    // Se il volume è azzerato, non allochiamo memoria hardware inutilmente
    if (volume === 0) return;

    // 2. Allocazione di un'istanza locale isolata (evita il lock dei singleton)
    const audio = new Audio(`/${savedSound}`);
    audio.volume = volume;
    
    // Configurazione per permettere l'override e il mix parziale sui browser supportati
    audio.preload = "auto";

    // 3. Reset forzato del buffer hardware prima dell'avvio
    audio.load();

    // 4. Esecuzione gestita della Promise asincrona
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          // Riproduzione avviata con successo: il canale è libero
          console.log(`[AudioEngine] Gong eseguito correttamente: ${savedSound}`);
        })
        .catch((error) => {
          // !!! CUORE DEL FIX: MECCANISMO DI SELF-HEALING !!!
          // Catturiamo il rifiuto dell'OS (causato da Spotify/Apple Music)
          console.warn(
            "[AudioEngine] Riproduzione interrotta o negata dal focus audio dell'OS:",
            error.message
          );
          
          // Bonifichiamo istantaneamente l'istanza corrotta per evitare il deadlock della serie successiva
          audio.pause();
          audio.currentTime = 0;
          audio.remove(); // Forza la rimozione dal DOM invisibile e il garbage collection
        });
    }
  } catch (e) {
    console.error("[AudioEngine] Errore critico non gestito nel thread audio:", e);
  }
};