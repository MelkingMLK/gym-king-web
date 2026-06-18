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
  if (typeof window === "undefined") return;

  // 1. ESTRAZIONE DINAMICA DELLE PREFERENZE
  const savedSound = localStorage.getItem("gymking_sound") || "sounds/gong.mp3";
  const savedVolume = localStorage.getItem("gymking_volume");
  const volumeValue = savedVolume !== null ? parseFloat(savedVolume) : 1.0;

  // 2. CONTROLLO DI DISALLINEAMENTO
  const fullUrl = `/${savedSound}`;
  if (currentAudioUrl !== fullUrl) {
    loadAudioFile(fullUrl);
  }

  // === LA CURA AL MEDIA HIJACKING DI iOS ===
  // Anche se il timer scade in background (senza tocco dell'utente), 
  // ordiniamo al motore di riprendere possesso della scheda audio.
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(e => console.warn("Impossibile fare resume forzato:", e));
  }

  // === PIANO A: Web Audio API con GainNode (Controllo Volume) ===
  if (audioCtx && audioBuffer && currentAudioUrl === fullUrl) {
    try {
      const source = audioCtx.createBufferSource();
      const gainNode = audioCtx.createGain();
      
      source.buffer = audioBuffer;
      gainNode.gain.setValueAtTime(volumeValue, audioCtx.currentTime);
      
      source.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      source.start(0);
      return; 
    } catch (e) {
      console.warn("Web Audio API fallita durante il play, passo al fallback nativo.", e);
    }
  }

  // === PIANO B: Fallback HTML5 Nativo ===
  if (nativeAudioFallback) {
    try {
      nativeAudioFallback.volume = volumeValue;
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
    // Piano di emergenza estremo
    try {
      const emergencyAudio = new Audio(fullUrl);
      emergencyAudio.volume = volumeValue;
      emergencyAudio.play().catch(e => console.error("Emergenza audio fallita:", e));
    } catch (e) {}
  }
};