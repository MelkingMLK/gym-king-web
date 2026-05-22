import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import AuthGuard from "../components/AuthGuard";
import Script from 'next/script';

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: '--font-space-grotesk' });

export const viewport: Viewport = {
  themeColor: "#121212",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Impedisce all'utente di zoomare rovinando l'interfaccia dell'app
};

export const metadata: Metadata = {
  title: "GymKing",
  description: "L'app definitiva per i tuoi workout",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GymKing",
  },
};



export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <Script id="theme-script" strategy="beforeInteractive">
          {`
            try {
              var theme = localStorage.getItem('theme') || 'neo';
              var supportDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches === true;
              if (theme === 'dark' || (theme === 'system' && supportDarkMode)) {
                document.documentElement.classList.add('dark');
              } else if (theme === 'neo') {
                document.documentElement.classList.add('neo');
              }
            } catch (e) {}
          `}
        </Script>
      </head>
      <body className="bg-base">{children}</body>
    </html>
  );
}