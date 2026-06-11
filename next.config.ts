import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  // --- CONFIGURAZIONE PER ESPORTAZIONE STATICA ---
  output: "export",
  
  // Fondamentale: forza Next.js a generare cartelle con index.html 
  // anziché file .html isolati, risolvendo i 404 nei router statici.
  trailingSlash: true,
  
  // Ottimizzazione immagini necessaria poiché 'next/image' 
  // non è supportato in modalità 'export' statica.
  images: {
    unoptimized: true,
  },

  // Turbopack è in fase sperimentale, se riscontra crash durante 
  // la build, commenti la riga sottostante.
  turbopack: {}, 
};

export default withPWA(nextConfig);