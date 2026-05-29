"use client";

let audioCtx: AudioContext | null = null;
let audioBuffer: AudioBuffer | null = null;
let isUnlocked = false;

export const initAudioContext = () => {
  if (typeof window === "undefined") return;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
};

// === LA FUNZIONE CRITICA PER IL MOBILE ===
export const unlockAudio = () => {
  if (typeof window === "undefined") return;
  initAudioContext();
  if (!audioCtx || isUnlocked) return;

  // Crea un buffer vuoto e inudibile per "sbloccare" i permessi iOS/Android
  const buffer = audioCtx.createBuffer(1, 1, 22050);
  const node = audioCtx.createBufferSource();
  node.buffer = buffer;
  node.connect(audioCtx.destination);
  node.start(0);
  
  // Forza il risveglio del thread audio
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  isUnlocked = true;
};

export const loadAudioFile = async (url: string) => {
  if (typeof window === "undefined") return;
  initAudioContext();
  if (!audioCtx) return;
  
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (e) {
    console.error("Errore critico caricamento audio:", e);
  }
};

export const playSound = () => {
  if (!audioCtx || !audioBuffer) return;
  
  // Se per qualche motivo il device lo ha sospeso di nuovo, lo forziamo
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);
  source.start(0);
};