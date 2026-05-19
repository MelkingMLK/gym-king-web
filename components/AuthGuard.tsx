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
      // Chiediamo a Supabase se c'è una sessione attiva
      const { data: { session } } = await supabase.auth.getSession();
      
      const isLoginPage = pathname === "/login";

      if (!session && !isLoginPage) {
        // Se NON è loggato e NON è sulla pagina di login -> Caccialo
        router.push("/login");
      } else if (session && isLoginPage) {
        // Se È loggato e prova ad andare sul login -> Mandalo alla Home
        router.push("/");
      } else {
        // Altrimenti, fallo passare
        setIsChecking(false);
      }
    };

    checkUser();

    // Questo "ascolta" se l'utente fa il logout o scade la sessione
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && pathname !== "/login") {
        router.push("/login");
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [pathname, router]);

  // Schermata di caricamento Brutalista mentre controlla i documenti
  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base text-main">
        <h1 className="font-heading text-4xl font-black uppercase tracking-widest animate-pulse">
          VERIFICA <span className="text-brand">ACCESSO...</span>
        </h1>
      </div>
    );
  }

  return <>{children}</>;
}