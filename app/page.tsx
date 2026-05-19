"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const menuItems = [
  { title: "Start Workout", href: "/start-workout" },
  { title: "Create Template", href: "/create-template" },
  { title: "Statistics", href: "/statistics" },
  { title: "Nutrition", href: "/nutrition" },
  { title: "Settings", href: "/settings" }, 
];

export default function Home() {
  const [nickname, setNickname] = useState<string>("");

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.nickname) {
        setNickname(user.user_metadata.nickname);
      }
    };
    fetchUser();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-16 px-4 transition-colors duration-300 relative overflow-hidden bg-base">
      
      {/* GHIRIGORI DECORATIVI */}
      <div className="absolute top-12 left-[-10%] w-64 h-64 opacity-30 dark:opacity-10 pointer-events-none">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path fill="none" stroke="currentColor" strokeWidth="1.5" className="text-line" d="M10,100 C50,20 150,20 190,100" />
        </svg>
      </div>
      <div className="absolute top-64 right-[-15%] w-96 h-96 opacity-30 dark:opacity-10 pointer-events-none">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
           <path fill="none" stroke="currentColor" strokeWidth="1" className="text-line" d="M10,10 C50,150 150,150 190,10" />
        </svg>
      </div>

      {/* 1. HEADER */}
      <div className="w-full max-w-md flex flex-col items-center gap-2 mb-12 pb-8 border-b-4 border-line transition-colors duration-300 relative z-10">
        <h1 className="font-heading text-6xl font-black tracking-tighter uppercase transition-colors duration-300">
           <span className="text-main">GYM</span>
           <span className="text-brand">KING</span>
        </h1>
        
        {/* MESSAGGIO DI BENVENUTO DINAMICO */}
        <span className="text-sm font-black uppercase tracking-widest text-muted mt-1 bg-surface px-4 py-1 border-2 border-line shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#804CD9]">
          BENTORNATO, {nickname || "RE"}
        </span>

        <div className="w-48 h-48 relative flex items-center justify-center mt-4">
           <img src="/logoG.png" alt="King Gym Logo Chiaro" className="w-full h-full object-contain dark:hidden scale-125" />
           <img src="/logo.png" alt="King Gym Logo Scuro" className="w-full h-full object-contain hidden dark:block scale-125" />
        </div>
      </div>

      {/* 2. MENU BUTTONS */}
      <div className="w-full max-w-md flex flex-col gap-6 mt-2 relative z-10">
        {menuItems.map((item, index) => (
          <Link href={item.href} key={index} className="group outline-none">
            <div className="w-full py-5 px-6 bg-base border-2 border-line 
                            shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9]
                            transition-all duration-200 
                            group-hover:translate-x-[2px] group-hover:translate-y-[2px] 
                            group-hover:shadow-[2px_2px_0px_#000000] dark:group-hover:shadow-[2px_2px_0px_#804CD9]
                            active:translate-x-[4px] active:translate-y-[4px] active:shadow-none">
              <span className="font-sans text-xl font-bold uppercase tracking-widest text-main transition-colors duration-300">
                {item.title}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}