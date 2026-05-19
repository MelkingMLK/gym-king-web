import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  // Questa riga forza Turbopack a tacere e permette al plugin PWA di funzionare
  turbopack: {}, 
};

export default withPWA(nextConfig);