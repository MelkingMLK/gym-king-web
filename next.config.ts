import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  turbopack: {}, 
  // --- INIEZIONI PER CAPACITOR (ANDROID APK) ---
  output: "export", 
  images: {
    unoptimized: true, 
  }
};

export default withPWA(nextConfig);