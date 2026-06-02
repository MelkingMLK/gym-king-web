"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Moon, Sun, LogOut, Edit3, Check, X, Camera, Volume2, Bug, Send } from "lucide-react";
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

const SOUND_OPTIONS = [
  { id: "sounds/gong.mp3", label: "Classic" },
  { id: "sounds/gong1.mp3", label: "Deep" },
  { id: "sounds/gong2.mp3", label: "Temple" },
  { id: "sounds/gong3.mp3", label: "Heavy" }
];

export default function SettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [selectedSound, setSelectedSound] = useState<string>(SOUND_OPTIONS[0].id);
  const [volume, setVolume] = useState<number>(1.0); // Stato per il volume (0.0 a 1.0)
  const [nickname, setNickname] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [tempNickname, setTempNickname] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // STATI PER SEGNALAZIONE BUG
  const [bugDescription, setBugDescription] = useState("");
  const [isSendingBug, setIsSendingBug] = useState(false);
  const [bugSuccess, setBugSuccess] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light") {
      setIsDarkMode(false);
      document.documentElement.classList.remove("dark");
    } else {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    }

    const savedSound = localStorage.getItem("gymking_sound");
    if (savedSound) setSelectedSound(savedSound);

    const savedVolume = localStorage.getItem("gymking_volume");
    if (savedVolume !== null) setVolume(parseFloat(savedVolume));

    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setEmail(user.email || "");
        const name = user.user_metadata?.nickname || "RE";
        setNickname(name);
        setTempNickname(name);
        if (user.user_metadata?.avatar_url) {
          setAvatarUrl(user.user_metadata.avatar_url);
        }
      }
    };
    fetchUser();
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode ? "dark" : "light";
    setIsDarkMode(!isDarkMode);
    localStorage.setItem("theme", newTheme);

    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleSoundSelect = (soundId: string, currentVolume = volume) => {
    setSelectedSound(soundId);
    localStorage.setItem("gymking_sound", soundId);
    const audio = new Audio(`/${soundId}`);
    audio.volume = currentVolume;
    audio.play().catch(e => console.error("Errore audio:", e));
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    localStorage.setItem("gymking_volume", String(newVolume));
  };

  // Riproduce il suono di prova al rilascio dello slider per validare il volume scelto
  const handleVolumeChangeEnd = () => {
    handleSoundSelect(selectedSound, volume);
  };

  const handleUpdateNickname = async () => {
    if (!tempNickname.trim() || tempNickname === nickname) {
      setIsEditingNickname(false);
      return;
    }
    setIsUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { nickname: tempNickname.trim() }
      });
      if (error) throw error;
      setNickname(tempNickname.trim());
      setIsEditingNickname(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploadingAvatar(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Devi selezionare un\'immagine.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Math.random()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });
      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
    } catch (error: any) {
      alert('Errore nel caricamento: ' + error.message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSendBugReport = async () => {
    if (!bugDescription.trim() || !userId) return;
    setIsSendingBug(true);
    try {
      const { error } = await supabase
        .from('Bug_Reports')
        .insert([{
          user_id: userId,
          descrizione: bugDescription.trim()
        }]);

      if (error) throw error;

      setBugDescription("");
      setBugSuccess(true);
      setTimeout(() => setBugSuccess(false), 4000);
    } catch (error) {
      console.error("Errore invio bug report:", error);
      alert("Impossibile trasmettere il report al server.");
    } finally {
      setIsSendingBug(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <main className="flex min-h-screen flex-col items-center pt-12 px-4 pb-20 relative overflow-x-hidden bg-base transition-colors duration-300">
      
      {/* HEADER BAR */}
      <div className="w-full max-w-2xl flex justify-between items-center mb-10 relative z-10">
        <Link href="/">
          <div className="w-12 h-12 bg-surface flex items-center justify-center border-2 border-line shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none">
            <ChevronLeft className="text-main" size={24} strokeWidth={3} />
          </div>
        </Link>
        <h1 className="font-heading text-3xl font-black uppercase text-main tracking-tighter absolute left-1/2 -translate-x-1/2">
          Settings
        </h1>
        <div className="w-12 h-12" />
      </div>

      <div className="w-full max-w-2xl flex flex-col gap-8 relative z-10">
        
        {/* SEZIONE PROFILO */}
        <div className="flex flex-col gap-3">
          <span className="text-sm font-black uppercase tracking-widest text-muted border-b-2 border-line pb-2">Account Info</span>
          
          <div className="w-full bg-surface border-2 border-line p-6 flex items-center gap-5 shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#804CD9]">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleAvatarUpload} disabled={isUploadingAvatar} />

            <div onClick={() => fileInputRef.current?.click()} className="w-20 h-20 bg-pastel border-2 border-line flex items-center justify-center shrink-0 overflow-hidden relative group cursor-pointer transition-transform active:scale-95">
              {isUploadingAvatar ? (
                <CleanSpinner size={32} />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover transition-opacity group-hover:opacity-40" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-12 h-12 text-main transition-opacity group-hover:opacity-20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
              {!isUploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={28} className="text-main" strokeWidth={2.5} />
                </div>
              )}
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden justify-center gap-1">
              {isEditingNickname ? (
                <div className="flex items-center gap-2">
                  <input type="text" value={tempNickname} onChange={(e) => setTempNickname(e.target.value)} className="bg-base border-2 border-line px-2 py-1 font-heading text-xl text-main font-black uppercase outline-none w-full" autoFocus />
                  <button onClick={handleUpdateNickname} disabled={isUpdating} className="text-brand">
                    {isUpdating ? <CleanSpinner size={18} /> : <Check size={20} strokeWidth={3} />}
                  </button>
                  <button onClick={() => { setIsEditingNickname(false); setTempNickname(nickname); }} className="text-muted"><X size={20} strokeWidth={3} /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <span className="font-heading text-2xl text-main font-black uppercase truncate tracking-tight">{nickname}</span>
                  <button onClick={() => setIsEditingNickname(true)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Edit3 size={18} className="text-brand" strokeWidth={2.5} />
                  </button>
                </div>
              )}
              <span className="text-xs font-bold uppercase tracking-widest text-muted truncate">{email}</span>
            </div>
          </div>
        </div>

        {/* SEZIONE PREFERENZE */}
        <div className="flex flex-col gap-3">
          <span className="text-sm font-black uppercase tracking-widest text-muted border-b-2 border-line pb-2">Preferences</span>
          
          <div className="w-full bg-surface border-2 border-line p-6 flex items-center justify-between shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#804CD9]">
            <div className="flex items-center gap-4">
              {isDarkMode ? <Moon className="text-brand" size={28} strokeWidth={2.5} /> : <Sun className="text-brand" size={28} strokeWidth={2.5} />}
              <span className="text-main font-black uppercase tracking-widest text-lg">App Theme</span>
            </div>
            <button onClick={toggleTheme} className={`w-16 h-10 border-2 border-line p-1 transition-colors duration-300 ${isDarkMode ? 'bg-brand' : 'bg-base'}`}>
              <div className={`w-7 h-7 bg-main border-2 border-line transition-transform duration-300 ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* TIMER SOUND & VOLUME SELECTOR */}
          <div className="w-full bg-surface border-2 border-line p-6 flex flex-col gap-5 shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#804CD9] mt-2">
            <div className="flex items-center gap-4">
              <Volume2 className="text-brand" size={28} strokeWidth={2.5} />
              <span className="text-main font-black uppercase tracking-widest text-lg">Timer Audio</span>
            </div>
            
            {/* GRIGLIA SELEZIONE SUONO */}
            <div className="grid grid-cols-2 gap-3">
              {SOUND_OPTIONS.map((sound) => (
                <button
                  key={sound.id}
                  onClick={() => handleSoundSelect(sound.id)}
                  className={`py-4 border-2 border-line font-black uppercase tracking-widest text-sm transition-all outline-none ${
                    selectedSound === sound.id
                      ? 'bg-brand text-base shadow-[inset_4px_4px_0px_rgba(0,0,0,0.2)] translate-y-[2px] translate-x-[2px]'
                      : 'bg-base text-main shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#804CD9] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none hover:bg-surface'
                  }`}
                >
                  {sound.label}
                </button>
              ))}
            </div>

            {/* CONTROLLO REGOLAZIONE VOLUME BRUTALISTA */}
            <div className="flex flex-col gap-2 mt-2 border-t-2 border-line border-dashed pt-4">
              <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-main">
                <span>Volume Allerta</span>
                <span className="font-mono bg-base px-2 py-0.5 border border-line">{Math.round(volume * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05" 
                value={volume} 
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                onMouseUp={handleVolumeChangeEnd}
                onTouchEnd={handleVolumeChangeEnd}
                className="w-full h-8 bg-base border-2 border-line outline-none appearance-none cursor-pointer accent-brand transition-all 
                  [&::-webkit-slider-runnable-track]:bg-transparent 
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-main [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-line [&::-webkit-slider-thumb]:shadow-[2px_2px_0px_#000000]"
              />
            </div>
          </div>
        </div>

        {/* DIAGNOSTICA (SEGNALAZIONE BUG) */}
        <div className="flex flex-col gap-3 mt-2">
          <span className="text-sm font-black uppercase tracking-widest text-muted border-b-2 border-line pb-2">Diagnostica</span>
          <div className="w-full bg-surface border-2 border-line p-6 flex flex-col gap-4 shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#804CD9]">
            <div className="flex items-center gap-4">
              <Bug className="text-[#ff331f]" size={28} strokeWidth={2.5} />
              <span className="text-main font-black uppercase tracking-widest text-lg">Segnala Bug</span>
            </div>
            
            <div className="flex flex-col gap-2 mt-2 relative">
              <textarea 
                value={bugDescription}
                onChange={(e) => setBugDescription(e.target.value)}
                disabled={isSendingBug}
                placeholder="Descrivi il problema riscontrato"
                rows={4}
                className="w-full bg-base border-2 border-line p-4 text-main font-bold text-sm outline-none focus:shadow-[4px_4px_0px_#000000] dark:focus:shadow-[4px_4px_0px_#804CD9] placeholder:text-muted/40 resize-none transition-all"
              />
              <span className="text-[10px] font-black uppercase text-muted tracking-wider self-end">
                max 1000 caratteri
              </span>
            </div>

            {bugSuccess && (
              <div className="w-full bg-emerald-400 border-2 border-black p-3 font-black uppercase text-xs text-black text-center animate-in zoom-in-95">
                Ticket trasmesso con successo. Bug registrato.
              </div>
            )}

            <button
              onClick={handleSendBugReport}
              disabled={isSendingBug || !bugDescription.trim()}
              className="w-full py-4 bg-[#ff331f] text-white border-2 border-line font-black uppercase tracking-widest text-sm shadow-[4px_4px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 outline-none"
            >
              {isSendingBug ? <CleanSpinner size={20} /> : <><Send size={18} strokeWidth={2.5}/> Invia Report</>}
            </button>
          </div>
        </div>

        {/* LOGOUT ORIGINALE */}
        <div className="mt-4">
          <button 
            onClick={handleLogout} 
            className="w-full py-6 bg-brand border-2 border-line flex items-center justify-center gap-3 shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#804CD9] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_#000000] dark:hover:shadow-[4px_4px_0px_#804CD9] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none"
          >
            <LogOut size={24} strokeWidth={3} className="text-base" />
            <span className="text-base font-black uppercase tracking-widest text-lg">Log Out</span>
          </button>
        </div>

      </div>
    </main>
  );
}