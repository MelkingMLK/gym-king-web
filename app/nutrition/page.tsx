import Link from 'next/link';
import { ChevronLeft, Hammer, Utensils } from 'lucide-react';

export default function NutritionWIPPage() {
  return (
    <main className="flex min-h-screen flex-col items-center pt-12 px-4 relative overflow-hidden bg-base transition-colors duration-300">
      
      {/* GHIRIGORI DECORATIVI (Coerenti con la Home) */}
      <div className="absolute top-12 left-[-10%] w-64 h-64 opacity-30 dark:opacity-10 pointer-events-none">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path fill="none" stroke="currentColor" strokeWidth="1.5" className="text-line" d="M10,100 C50,20 150,20 190,100" />
        </svg>
      </div>

      {/* HEADER / PULSANTE INDIETRO */}
      <div className="w-full max-w-md flex justify-start mb-16 relative z-10">
        <Link href="/">
          <div className="w-12 h-12 bg-surface flex items-center justify-center border-2 border-line shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all">
            <ChevronLeft size={24} strokeWidth={3} className="text-main" />
          </div>
        </Link>
      </div>

      {/* BLOCCO BRUTALISTA CANTIERE */}
      <div className="w-full max-w-md bg-brand border-4 border-line p-8 flex flex-col items-center text-center gap-6 shadow-[12px_12px_0px_#000000] dark:shadow-[12px_12px_0px_#804CD9] animate-in zoom-in-95 duration-300 relative z-10">
        
        <div className="relative">
          <div className="w-24 h-24 bg-surface border-4 border-line flex items-center justify-center shadow-[6px_6px_0px_#000000] animate-bounce">
            <Hammer size={48} strokeWidth={2.5} className="text-main" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-[#ff331f] border-2 border-line flex items-center justify-center shadow-[2px_2px_0px_#000000]">
            <Utensils size={20} strokeWidth={2.5} className="text-white" />
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <h1 className="font-heading text-4xl font-black uppercase text-base tracking-tighter leading-none">
            Nutritio<br/>In Cantiere
          </h1>

        </div>

        <p className="text-sm font-bold bg-surface text-main border-2 border-line p-4 mt-2 shadow-[4px_4px_0px_#000000]">
          L'infrastruttura è attualmente in fase di ingegnerizzazione.
        </p>

        <Link href="/" className="w-full mt-2">
          <button className="w-full py-4 bg-base border-2 border-line text-main font-black uppercase tracking-widest shadow-[4px_4px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex justify-center items-center gap-2">
            Torna al Workout
          </button>
        </Link>
        
      </div>
    </main>
  );
}