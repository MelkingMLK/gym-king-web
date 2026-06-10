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
    // Evitiamo callback obsolete basandoci sulla promise nativa di decodeAudioData
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (e) {
    console.warn("Web Audio API buffer failed, relies on native fallback.", e);
    audioBuffer = null; // Forza il fallback se il caricamento fallisce
  }
};

export const playSound = () => {
  if (typeof window === "undefined") return;

  // 1. ESTRAZIONE DINAMICA DELLE PREFERENZE DALLA SALA MACCHINE
  const savedSound = localStorage.getItem("gymking_sound") || "sounds/gong.mp3";
  const savedVolume = localStorage.getItem("gymking_volume");
  const volumeValue = savedVolume !== null ? parseFloat(savedVolume) : 1.0;

  // 2. CONTROLLO DI DISALLINEAMENTO: Se il file richiesto differisce da quello in cache, forziamo il reload asincrono
  const fullUrl = `/${savedSound}`;
  if (currentAudioUrl !== fullUrl) {
    loadAudioFile(fullUrl);
  }

  // === PIANO A: Web Audio API con GainNode per il controllo del volume ===
  if (audioCtx && audioBuffer && currentAudioUrl === fullUrl) {
    try {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      const source = audioCtx.createBufferSource();
      // Creiamo l'attenuatore di guadagno per mappare il volume matematico
      const gainNode = audioCtx.createGain();
      
      source.buffer = audioBuffer;
      gainNode.gain.setValueAtTime(volumeValue, audioCtx.currentTime);
      
      // Catena di montaggio: Source -> GainNode -> Altoparlanti (Destination)
      source.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      source.start(0);
      return; 
    } catch (e) {
      console.warn("Web Audio API fallita durante il play, passo al fallback nativo.", e);
    }
  }

  // === PIANO B: Fallback HTML5 Nativo con controllo volume diretto ===
  if (nativeAudioFallback) {
    try {
      nativeAudioFallback.volume = volumeValue; // Allineamento immediato allo slider delle impostazioni
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
    // Piano di emergenza estremo se tutto il resto è dereferenziato
    try {
      const emergencyAudio = new Audio(fullUrl);
      emergencyAudio.volume = volumeValue;
      emergencyAudio.play().catch(e => console.error("Emergenza audio fallita:", e));
    } catch (e) {}
  }
};