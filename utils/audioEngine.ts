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
  if (!audioCtx || isUnlocked) return;

  try {
    const buffer = audioCtx.createBuffer(1, 1, 22050);
    const node = audioCtx.createBufferSource();
    node.buffer = buffer;
    node.connect(audioCtx.destination);
    node.start(0);
    
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    // Inizializza anche il fallback nativo per sbloccarlo con il tocco utente
    if (nativeAudioFallback) {
      nativeAudioFallback.play().then(() => {
        nativeAudioFallback?.pause();
        if (nativeAudioFallback) nativeAudioFallback.currentTime = 0;
      }).catch(() => { /* ignora errori di play vuoto */ });
    }

    isUnlocked = true;
  } catch (e) {
    console.error("Audio unlock fallito:", e);
  }
};

export const loadAudioFile = async (url: string) => {
  if (typeof window === "undefined") return;
  currentAudioUrl = url;

  // 1. Pre-carichiamo il Fallback Nativo (immediato, gestito dal browser)
  if (!nativeAudioFallback) {
    nativeAudioFallback = new Audio(url);
    nativeAudioFallback.preload = "auto";
  } else if (nativeAudioFallback.src !== url) {
    nativeAudioFallback.src = url;
    nativeAudioFallback.load();
  }

  // 2. Tentiamo il caricamento Web Audio API (Avanzato, ma prono a fallire su rete debole)
  initAudioContext();
  if (!audioCtx) return;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network response was not ok");
    const arrayBuffer = await response.arrayBuffer();
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (e) {
    console.warn("Web Audio API buffer failed, relies on native fallback.", e);
    // Non facciamo nulla: il fallback nativo è pronto.
  }
};

export const playSound = () => {
  // PIANO A: Web Audio API (Veloce, nessuna latenza)
  if (audioCtx && audioBuffer) {
    try {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.start(0);
      return; // Suono riprodotto con successo
    } catch (e) {
      console.warn("Web Audio API fallita durante il play, passo al fallback.", e);
    }
  }

  // PIANO B: Fallback HTML5 Nativo (In caso di buffer null o errore context)
  if (nativeAudioFallback) {
    try {
      nativeAudioFallback.currentTime = 0;
      const playPromise = nativeAudioFallback.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Anche il fallback audio nativo è fallito:", error);
        });
      }
    } catch (fallbackError) {
      console.error("Errore critico audio nativo:", fallbackError);
    }
  } else {
    // Se persino il fallback è null, proviamo un disperato salvataggio in extremis
    if (currentAudioUrl && typeof window !== "undefined") {
      const emergencyAudio = new Audio(currentAudioUrl);
      emergencyAudio.play().catch(e => console.error("Emergenza audio fallita:", e));
    }
  }
};