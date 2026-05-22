"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      // Validazione crittografica della sessione corrente
      const { data: { session } } = await supabase.auth.getSession();
      
      const isLoginPage = pathname === "/login";

      if (!session && !isLoginPage) {
        // Token assente o scaduto, redirect forzato al login
        router.push("/login");
      } else if (session && isLoginPage) {
        // Sessione valida rilevata sulla rotta di login, bypass alla root
        router.push("/");
      } else {
        // Autorizzazione concessa, sblocco del rendering dell'app
        setIsChecking(false);
      }
    };

    checkUser();

    // Listener per la revoca o la scadenza della sessione in tempo reale
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && pathname !== "/login") {
        router.push("/login");
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [pathname, router]);

  // === SKELETON LOADER NEO-BRUTALISTA (PUNTO 3D) ===
  if (isChecking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-base p-4 transition-colors duration-300">
        <div className="flex flex-col items-center gap-8 p-10 bg-surface border-4 border-line shadow-[12px_12px_0px_#000000] dark:shadow-[12px_12px_0px_#804CD9] animate-in zoom-in-95 duration-300">
          
          <h1 className="font-heading text-5xl md:text-6xl font-black tracking-tighter uppercase animate-pulse">
             <span className="text-main">GYM</span>
             <span className="text-brand">KING</span>
          </h1>
          
          {/* Spinner Brutalista Puramente Architetturale */}
          <div className="w-16 h-16 border-4 border-line bg-brand animate-spin shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9]" />
          
          <div className="flex flex-col items-center gap-1 mt-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted">Inizializzazione</span>
            <span className="text-xs font-bold uppercase tracking-widest text-main animate-pulse">Decrittazione Sessione</span>
          </div>
          
        </div>
      </div>
    );
  }

  return <>{children}</>;
}