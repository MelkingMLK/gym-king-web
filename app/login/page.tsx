"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

// === SPINNER A CERCHIO CONTINUO ===
const CleanSpinner = ({ size = 24 }: { size?: number }) => {
  const color = "currentColor";
  return (
    <div style={{ width: size, height: size, position: 'relative', color: color }}>
      <style>{`@keyframes cleanSpinnerRotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } .spinner-ring { box-sizing: border-box; display: block; position: absolute; width: 100%; height: 100%; border: ${size * 0.15}px solid currentColor; border-radius: 50%; animation: cleanSpinnerRotate 1s cubic-bezier(0.5, 0, 0.5, 1) infinite; border-color: currentColor transparent transparent transparent; } .spinner-ring-track { box-sizing: border-box; display: block; position: absolute; width: 100%; height: 100%; border: ${size * 0.15}px solid currentColor; border-radius: 50%; opacity: 0.15; }`}</style>
      <div className="spinner-ring-track"></div>
      <div className="spinner-ring"></div>
    </div>
  );
};

export default function LoginPage() {
  const router = useRouter();
  
  // STATI
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // CAMPI FORM
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // CAMPI EXTRA SOLO PER REGISTRAZIONE
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [nickname, setNickname] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (isLogin) {
        // === LOGIN ===
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        // Se va a buon fine, vai alla home
        router.push("/");
        
      } else {
        // === REGISTRAZIONE ===
        if (!nome || !cognome || !nickname) {
          throw new Error("Compila tutti i campi!");
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          // Supabase permette di salvare dati extra nel "user_metadata"
          options: {
            data: {
              nome: nome,
              cognome: cognome,
              nickname: nickname,
            }
          }
        });
        if (error) throw error;

        // Se va a buon fine (e la conferma mail è disattivata), vai alla home
        router.push("/");
      }
    } catch (error: any) {
      setErrorMsg(error.message || "Si è verificato un errore.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-base transition-colors duration-300 relative overflow-hidden">
      
      {/* GHIRIGORI BACKGROUND */}
      <div className="absolute top-[-5%] left-[-10%] w-96 h-96 opacity-20 dark:opacity-10 pointer-events-none">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path fill="none" stroke="currentColor" strokeWidth="1" className="text-line" d="M10,10 C50,150 150,150 190,10" />
        </svg>
      </div>

      {/* CARD NEO-BRUTALISTA */}
      <div className="w-full max-w-md bg-surface border-4 border-line shadow-[12px_12px_0px_#000000] dark:shadow-[12px_12px_0px_#804CD9] p-8 flex flex-col gap-6 relative z-10 animate-in zoom-in-95 duration-300">
        
        {/* HEADER */}
        <div className="flex flex-col items-center gap-2 mb-2">
          <div className="w-20 h-20 mb-2">
            <img src="/logoG.png" alt="Logo" className="w-full h-full object-contain dark:hidden scale-125" />
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain hidden dark:block scale-125" />
          </div>
          <h1 className="font-heading text-4xl font-black uppercase tracking-tighter text-main text-center">
            {isLogin ? "Bentornato" : "Nuova Era"}
          </h1>
          <p className="text-sm font-bold uppercase tracking-widest text-muted text-center">
            {isLogin ? "Accedi al account" : "Crea il tuo account"}
          </p>
        </div>

        {/* MESSAGGIO ERRORE */}
        {errorMsg && (
          <div className="bg-[#ff331f] border-2 border-line p-3 text-white font-bold text-sm uppercase tracking-widest shadow-[4px_4px_0px_#000000] text-center">
            {errorMsg}
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          
          {/* CAMPI AGGIUNTIVI (Visibili solo in registrazione) */}
          {!isLogin && (
            <div className="animate-in fade-in slide-in-from-top-4 flex flex-col gap-4">
              <input 
                type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required={!isLogin}
                className="w-full bg-base border-2 border-line p-4 text-main font-bold outline-none focus:shadow-[4px_4px_0px_#000000] dark:focus:shadow-[4px_4px_0px_#804CD9] transition-all placeholder:text-muted/50" 
              />
              <input 
                type="text" placeholder="Cognome" value={cognome} onChange={(e) => setCognome(e.target.value)} required={!isLogin}
                className="w-full bg-base border-2 border-line p-4 text-main font-bold outline-none focus:shadow-[4px_4px_0px_#000000] dark:focus:shadow-[4px_4px_0px_#804CD9] transition-all placeholder:text-muted/50" 
              />
              <input 
                type="text" placeholder="Nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} required={!isLogin}
                className="w-full bg-base border-2 border-line p-4 text-main font-bold outline-none focus:shadow-[4px_4px_0px_#000000] dark:focus:shadow-[4px_4px_0px_#804CD9] transition-all placeholder:text-muted/50" 
              />
            </div>
          )}

          <input 
            type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full bg-base border-2 border-line p-4 text-main font-bold outline-none focus:shadow-[4px_4px_0px_#000000] dark:focus:shadow-[4px_4px_0px_#804CD9] transition-all placeholder:text-muted/50" 
          />
          <input 
            type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required
            className="w-full bg-base border-2 border-line p-4 text-main font-bold outline-none focus:shadow-[4px_4px_0px_#000000] dark:focus:shadow-[4px_4px_0px_#804CD9] transition-all placeholder:text-muted/50" 
          />

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full p-5 mt-2 bg-brand border-2 border-line text-base font-black uppercase tracking-widest shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex justify-center items-center"
          >
            {isLoading ? <CleanSpinner size={24} /> : (isLogin ? "ACCEDI" : "REGISTRATI")}
          </button>
        </form>

        {/* TOGGLE LOGIN / REGISTRATI */}
        <div className="mt-2 text-center">
          <button 
            onClick={() => { setIsLogin(!isLogin); setErrorMsg(null); }}
            className="text-sm font-bold uppercase tracking-widest text-muted hover:text-main transition-colors outline-none"
          >
            {isLogin ? "Non hai un account? Crea account." : "Hai già un account? Accedi."}
          </button>
        </div>

      </div>
    </main>
  );
}