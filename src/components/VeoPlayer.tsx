import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Sparkles, Cpu, Volume2, VolumeX, Heart, MessageCircle, Share2, AlertCircle, RefreshCw, Check, Video, Download, Lock, Unlock, Shield } from 'lucide-react';
import { ScriptScene } from '../types';

interface VeoPlayerProps {
  scene: ScriptScene;
  productName: string;
  category?: string;
  credits: number;
  spendCredits: (amount: number) => boolean;
  userTier: 'free' | 'premium1' | 'premium2' | 'premium3';
}

export const VeoPlayer: React.FC<VeoPlayerProps> = ({ scene, productName, category = "Umum", credits, spendCredits, userTier }) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating' | 'completed' | 'failed'>('idle');
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state if scene changes
  useEffect(() => {
    setGenerationStatus('idle');
    setVideoUrl(null);
    setErrorDetails(null);
    setGenerationProgress(0);
    setStatusMessage('');
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    if (statusTimerRef.current) clearInterval(statusTimerRef.current);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
  }, [scene]);

  // Clean timers on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (statusTimerRef.current) clearInterval(statusTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const handleSpeakVoiceOver = () => {
    if (userTier === 'free') {
      alert("❌ Fitur Voice-Over Audio Terkunci!\n\nNaskah dialog dapat dibaca secara bebas di Free Tier, tapi untuk memperdengarkan rekaman Audio Voice-Over secara langsung, silakan upgrade ke Akun Premium Satu.");
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert("Browser Anda tidak mendukung Web Speech API.");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(scene.speech);
      utterance.lang = 'id-ID';
      
      utterance.onend = () => {
        setIsSpeaking(false);
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
      };

      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Simulate loading steps for engaging UI when generating
  const startProgressSimulation = () => {
    setGenerationProgress(1);
    let step = 0;
    const messages = [
      "Menganalisis prompt Veo...",
      "Menyesuaikan aspek rasio 9:16 untuk Reels/TikTok...",
      "Menghubungkan ke server model Veo 3.1 Lite...",
      "Mulai merender frame demi frame...",
      "Mengoptimalkan saturasi warna & sinematografi...",
      "Menghaluskan transisi gerakan kamera...",
      "Mengompres hasil akhir video berkualitas tinggi..."
    ];

    setStatusMessage(messages[0]);

    progressTimerRef.current = setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev >= 98) {
          if (progressTimerRef.current) clearInterval(progressTimerRef.current);
          return 98;
        }
        return prev + Math.floor(Math.random() * 4) + 1;
      });
    }, 1200);

    statusTimerRef.current = setInterval(() => {
      step++;
      if (step < messages.length) {
        setStatusMessage(messages[step]);
      }
    }, 4500);
  };

  const handlesGenerateVideo = async () => {
    if (userTier === 'free' || userTier === 'premium1') {
      alert("❌ Fitur Rendering Video Veo AI Terkunci!\n\nFitur ini khusus untuk pengguna Premium 2 dan Premium 3. Silakan upgrade keanggotaan Anda dengan membeli paket atau pilih simulasi tier di atas!");
      return;
    }

    if (generationStatus === 'generating') return;
    
    // Spend 2 credits for video generation
    if (!spendCredits(2)) {
      setGenerationStatus('idle');
      setErrorDetails("Kredit tidak mencukupi! Setiap render adegan video Veo membutuhkan 2 koin kredit.");
      setStatusMessage("Kredit kurang! Silakan Isi Kredit via GoPay di panel samping.");
      return;
    }

    setGenerationStatus('generating');
    setErrorDetails(null);
    setVideoUrl(null);
    startProgressSimulation();

    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: scene.veoPrompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal memulai pembuatan video dengan Veo.");
      }

      const operationName = data.operationName;
      pollVideoStatus(operationName);

    } catch (err: any) {
      console.error(err);
      // Fallback gracefully as Veo might require a paid key or workspace permissions
      triggerSimulatedVideoFallback(err.message || "Pembuatan video gagal.");
    }
  };

  // Poll video status from Express backend
  const pollVideoStatus = (operationName: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5s interval)

    pollTimerRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        triggerSimulatedVideoFallback("Timeout: Server memakan waktu terlalu lama untuk membuat video.");
        return;
      }

      try {
        const response = await fetch('/api/video-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationName }),
        });

        const statusData = await response.json();

        if (!response.ok) {
          throw new Error(statusData.error || "Gagal memantau status video.");
        }

        if (statusData.completed) {
          // Video generation is finished! Download/Stream binary
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          downloadAndPlayVideo(operationName);
        } else if (statusData.error) {
          throw new Error(statusData.error.message || "Model video Veo melaporkan kegagalan.");
        }

      } catch (err: any) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        triggerSimulatedVideoFallback(err.message || "Gagal memanggil status video.");
      }
    }, 5000);
  };

  const downloadAndPlayVideo = async (operationName: string) => {
    setStatusMessage("Mengunduh hasil akhir video...");
    try {
      const response = await fetch('/api/video-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationName }),
      });

      if (!response.ok) {
        throw new Error("Gagal mengunduh file video dari server.");
      }

      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);
      
      setVideoUrl(localUrl);
      setGenerationStatus('completed');
      setGenerationProgress(100);
      setStatusMessage("Video Veo berhasil dibuat!");
    } catch (err: any) {
      triggerSimulatedVideoFallback(err.message || "Masalah saat mengunduh video.");
    }
  };

  // A ultra-premium dynamic fallback generator that turns the scene prompt into a highly creative, animated video card
  const triggerSimulatedVideoFallback = (errorMsg: string) => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    if (statusTimerRef.current) clearInterval(statusTimerRef.current);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    setErrorDetails(errorMsg);
    setGenerationStatus('failed');
    setStatusMessage("Beralih ke Simulator Klip Sinematik...");
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 items-stretch shadow-2xl">
      {/* 9:16 Portrait Phone Simulation Viewport */}
      <div className="relative w-full max-w-[290px] mx-auto aspect-[9/16] bg-black rounded-3xl overflow-hidden border-8 border-slate-950 shadow-2xl flex flex-col items-stretch shrink-0 self-center">
        
        {/* Dynamic Background Screen based on video state */}
        {videoUrl ? (
          // REAL VEO VIDEO RENDERED
          <video
            src={videoUrl}
            className="w-full h-full object-cover"
            autoPlay={isPlaying}
            loop
            muted={isMuted}
            playsInline
          />
        ) : (
          // SIMULATED OR ANIMATED PLACEHOLDER
          <div className={`relative w-full h-full flex flex-col justify-between p-4 overflow-hidden transition-all duration-700 bg-gradient-to-br ${
            generationStatus === 'generating' 
              ? 'from-indigo-950 via-slate-900 to-indigo-900' 
              : 'from-slate-950 via-slate-900 to-slate-950'
          }`}>
            
            {/* Elegant light rays or abstract animation inside simulator */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-violet-600 rounded-full blur-3xl animate-pulse"></div>
              <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-indigo-600 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }}></div>
            </div>

            {/* Simulated camera focus box / guides */}
            <div className="absolute inset-4 border border-white/10 rounded-xl pointer-events-none flex flex-col justify-between p-2">
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-white/40 font-mono">REC [VEO-3.1]</span>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[8px] text-white/30 font-mono">9:16 portrait</span>
                <span className="text-[8px] text-white/30 font-mono">{scene.duration}</span>
              </div>
            </div>

            {/* Top Indicator bar */}
            <div className="z-10 flex justify-between items-center bg-black/40 backdrop-blur-md py-1.5 px-3 rounded-full text-[10px] text-white/90">
              <div className="flex items-center gap-1">
                <Sparkles size={11} className="text-violet-400 animate-spin" />
                <span className="font-semibold tracking-wider font-display">Scene {scene.scene}</span>
              </div>
              <span className="text-white/60 font-mono text-[9px]">{scene.duration}</span>
            </div>

            {/* Middle state view: Idle, Generating, or Fallback Simulator */}
            <div className="z-10 flex flex-col items-center justify-center text-center px-2 py-8 my-auto">
              {generationStatus === 'idle' && (
                <div className="flex flex-col items-center animate-float">
                  <div className="w-16 h-16 rounded-full bg-violet-600/30 border border-violet-500 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(139,92,246,0.5)]">
                    <Video size={28} className="text-violet-300" />
                  </div>
                  <h4 className="text-white text-sm font-bold tracking-wide">Klip Belum Dibuat</h4>
                  <p className="text-white/60 text-[11px] mt-1.5 max-w-[180px]">
                    Siap dirender dengan model video Veo AI menggunakan tombol di sebelah kanan.
                  </p>
                </div>
              )}

              {generationStatus === 'generating' && (
                <div className="flex flex-col items-center">
                  {/* Radial creative progress loader */}
                  <div className="relative w-18 h-18 flex items-center justify-center mb-3">
                    <svg className="absolute w-full h-full transform -rotate-90">
                      <circle
                        cx="36"
                        cy="36"
                        r="30"
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth="3"
                        fill="transparent"
                      />
                      <circle
                        cx="36"
                        cy="36"
                        r="30"
                        stroke="#8b5cf6"
                        strokeWidth="4"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 30}
                        strokeDashoffset={2 * Math.PI * 30 * (1 - generationProgress / 100)}
                        className="transition-all duration-300"
                      />
                    </svg>
                    <span className="text-xs font-mono font-bold text-white">{generationProgress}%</span>
                  </div>
                  
                  <span className="text-[11px] font-semibold text-violet-300 animate-pulse tracking-wide uppercase">Merender dengan Veo...</span>
                  <p className="text-[10px] text-white/50 px-2 mt-2 leading-relaxed max-w-[170px] min-h-[30px] italic">
                    "{statusMessage}"
                  </p>
                </div>
              )}

              {generationStatus === 'failed' && (
                <div className="flex flex-col items-center">
                  <div className="p-3 bg-indigo-500/10 border border-indigo-400/20 rounded-2xl w-full mb-3 flex flex-col items-center">
                    {/* Simulator visual active state */}
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center mb-2">
                      <Sparkles size={16} className="text-indigo-400 animate-spin" />
                    </div>
                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest leading-none">Simulasi Visual</span>
                    <span className="text-[9px] text-indigo-400/80 font-mono mt-1 break-all max-w-[180px] line-clamp-1">{productName}</span>
                  </div>
                  
                  {/* Dynamic word clouds flowing based on visual description */}
                  <div className="py-2 flex flex-col gap-1 items-center justify-center">
                    <span className="text-xs text-white/95 font-medium px-2 py-1 bg-white/10 rounded-md backdrop-blur-sm animate-pulse shadow-md font-display">
                      {scene.visual.length > 50 ? scene.visual.substring(0, 50) + "..." : scene.visual}
                    </span>
                    <span className="text-[9px] text-indigo-200/80 italic mt-1 bg-black/30 px-2 py-0.5 rounded">
                      Audio: {scene.audio.length > 40 ? scene.audio.substring(0, 40) + "..." : scene.audio}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Content Overlays like on TikTok */}
            <div className="z-10 flex flex-col gap-2 mt-auto">
              
              {/* Profile name and dialogue caption overlay */}
              <div className="flex flex-col gap-1 text-left bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 rounded-xl backdrop-blur-[2px]">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-violet-600 border border-white/25 flex items-center justify-center text-[10px] font-bold text-white">A</div>
                  <span className="text-[11px] font-bold text-white truncate max-w-[130px]" title="Affiliate AI">@affiliate.creator</span>
                  <span className="text-[8px] bg-red-500 text-white px-1 py-0.5 rounded font-bold uppercase scale-90">LIVE</span>
                </div>
                
                {/* Narrator script subtitle / caption overlay */}
                <p className="text-[11px] text-yellow-300 font-medium leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] mt-1.5 min-h-[38px] line-clamp-3">
                  "{scene.speech}"
                </p>
              </div>

              {/* Fake TikTok sidebar buttons */}
              <div className="absolute right-2.5 bottom-16 flex flex-col gap-3.5 items-center z-20">
                <button className="flex flex-col items-center text-white/90 hover:text-white transition group focus:outline-none">
                  <div className="p-2 bg-black/40 backdrop-blur-md rounded-full group-hover:scale-110 active:scale-95 duration-150">
                    <Heart size={14} className="fill-red-500 text-red-500" />
                  </div>
                  <span className="text-[9px] font-mono mt-0.5 font-semibold text-white/80">421k</span>
                </button>
                <button className="flex flex-col items-center text-white/90 hover:text-white transition group focus:outline-none">
                  <div className="p-2 bg-black/40 backdrop-blur-md rounded-full group-hover:scale-110 active:scale-95 duration-150">
                    <MessageCircle size={14} className="text-white fill-white/10" />
                  </div>
                  <span className="text-[9px] font-mono mt-0.5 font-semibold text-white/80">2.8k</span>
                </button>
                <button className="flex flex-col items-center text-white/90 hover:text-white transition group focus:outline-none">
                  <div className="p-2 bg-black/40 backdrop-blur-md rounded-full group-hover:scale-110 active:scale-95 duration-150">
                    <Share2 size={14} className="text-white" />
                  </div>
                  <span className="text-[9px] font-mono mt-0.5 font-semibold text-white/80">6.1k</span>
                </button>
              </div>
            </div>

          </div>
        )}

        {/* Small persistent custom control bar at very bottom of screen emulator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 bg-black/60 backdrop-blur-md flex items-center justify-around w-[90%] py-1 px-4 rounded-full border border-white/5">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="text-white/80 hover:text-white transition focus:outline-none focus:ring-0"
            title={isPlaying ? "Pause Video" : "Play Video"}
          >
            {isPlaying ? <Pause size={12} className="fill-white" /> : <Play size={12} className="fill-white" />}
          </button>
          
          {/* Progress bar simulation */}
          <div className="w-1/2 h-0.5 bg-white/20 rounded-full overflow-hidden">
            <div className={`h-full bg-violet-400 ${isPlaying ? 'w-full transition-all duration-[6000ms] ease-linear' : 'w-1/3'}`}></div>
          </div>

          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="text-white/80 hover:text-white transition focus:outline-none focus:ring-0"
            title={isMuted ? "Unmute Audio" : "Mute Audio"}
          >
            {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </button>
        </div>
      </div>

      {/* Text Details & Controls Suite */}
      <div className="flex-1 flex flex-col justify-between text-left p-1 lg:pl-3">
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono tracking-wider text-violet-400 uppercase bg-violet-950/40 px-2 py-0.5 rounded border border-violet-800/30">
                Aset Naskah Scene {scene.scene}
              </span>
              <span className="text-xs text-slate-400 font-mono">Dukungan Veo AI</span>
            </div>
            
            <h3 className="text-white text-lg font-bold font-display tracking-tight mt-1">
              Visualisasi & Skrip Detail
            </h3>
          </div>

          {/* Details fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/50">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-mono">Visual Direction (Arah Kamera)</span>
              {userTier === 'free' ? (
                <div className="flex items-center gap-1.5 mt-2 text-rose-455 text-[11px] font-mono leading-relaxed bg-rose-950/20 px-2 py-1 rounded">
                  <Lock size={12} className="shrink-0 text-rose-500 animate-pulse" />
                  <span>Aksi Terkunci (Premium 1 Dibutuhkan)</span>
                </div>
              ) : (
                <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                  {scene.visual}
                </p>
              )}
            </div>

            <div className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/50">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-mono">Audio & SFX Design</span>
              {userTier === 'free' ? (
                <div className="flex items-center gap-1.5 mt-2 text-rose-455 text-[11px] font-mono leading-relaxed bg-rose-950/20 px-2 py-1 rounded">
                  <Lock size={12} className="shrink-0 text-rose-500 animate-pulse" />
                  <span>Suara Terkunci (Premium 1 Dibutuhkan)</span>
                </div>
              ) : (
                <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                  {scene.audio}
                </p>
              )}
            </div>
          </div>

          {/* Narrator Dialogue Speech Block with active TTS */}
          <div className="bg-violet-950/20 border border-violet-900/30 p-4 rounded-xl flex flex-col sm:flex-row gap-3 items-start justify-between">
            <div className="flex-1 w-full">
              <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest block font-mono">Naskah Dialog / Voice-Over</span>
              <p className="text-white text-sm font-medium mt-1.5 leading-relaxed bg-black/25 p-3 rounded-lg border border-violet-950/40">
                "{scene.speech}"
              </p>
            </div>
            
            <button
              type="button"
              onClick={handleSpeakVoiceOver}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer self-start sm:self-center shrink-0 ${
                userTier === 'free'
                  ? 'bg-slate-905 hover:bg-slate-850 text-slate-500 border-slate-800'
                  : isSpeaking
                  ? 'bg-rose-600 border-rose-500 text-white font-bold animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-550 text-white border-indigo-500'
              }`}
            >
              {userTier === 'free' ? <Lock size={12} className="text-rose-500" /> : <Volume2 size={12} />}
              <span>{isSpeaking ? 'Matikan Suara' : 'Mainkan VO (TTS)'}</span>
            </button>
          </div>

          {/* Prompt Veo Detail block */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={13} className="text-amber-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Prompt Model Video Veo (English)</span>
              </div>
              {userTier !== 'free' && userTier !== 'premium1' && (
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(scene.veoPrompt);
                  }}
                  className="text-[11px] text-violet-400 hover:text-violet-300 flex items-center gap-1 cursor-pointer transition focus:outline-none"
                >
                  Salin Prompt
                </button>
              )}
            </div>
            
            {userTier === 'free' || userTier === 'premium1' ? (
              <div className="flex items-center gap-1.5 mt-2 text-rose-455 text-[11px] font-mono leading-relaxed bg-rose-955/10 px-3 py-2 rounded-lg border border-rose-950/20">
                <Lock size={12} className="shrink-0 text-rose-500 animate-pulse" />
                <span>Prompt Veo Terkunci (Premium 2 & 3 Dibutuhkan)</span>
              </div>
            ) : (
              <p className="text-slate-300 text-xs mt-2 italic leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 font-mono">
                {scene.veoPrompt}
              </p>
            )}
          </div>
        </div>

        {/* Action Controls for AI Veo Rendering */}
        <div className="border-t border-slate-800 pt-4 mt-6 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            
            <button
              onClick={handlesGenerateVideo}
              disabled={generationStatus === 'generating' || userTier === 'free' || userTier === 'premium1'}
              className={`w-full sm:w-auto px-5 py-2.5 text-white font-medium text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer text-center ${
                userTier === 'free' || userTier === 'premium1'
                  ? 'bg-slate-900 hover:bg-slate-850 text-slate-600 border border-slate-800 shadow-none cursor-not-allowed'
                  : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-550 hover:to-indigo-550 active:scale-[0.98] shadow-violet-500/10'
              }`}
            >
              {userTier === 'free' || userTier === 'premium1' ? (
                <>
                  <Lock size={14} className="text-rose-505" />
                  <span>Render Terkunci (Premium 2/3 Dibutuhkan)</span>
                </>
              ) : generationStatus === 'generating' ? (
                <>
                  <RefreshCw size={14} className="animate-spin text-white" />
                  Generating Video ({generationProgress}%)
                </>
              ) : videoUrl ? (
                <>
                  <Video size={14} className="text-white" />
                  Hasilkan Ulang dengan Veo AI
                </>
              ) : (
                <>
                  <Sparkles size={14} className="text-amber-300 fill-amber-300" />
                  Hasilkan Video Realistis dengan Veo AI
                </>
              )}
            </button>

            {videoUrl && (
              <a 
                href={videoUrl}
                download={`veo-scene-${scene.scene}.mp4`}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 font-medium text-xs text-white rounded-xl text-center flex items-center justify-center gap-1.5 transition"
              >
                <Download size={14} />
                Unduh Video Mp4
              </a>
            )}

            {generationStatus === 'generating' && (
              <span className="text-[11px] text-slate-400 font-mono italic animate-pulse">
                Proses rendering Veo membutuhkan waktu kira-kira 1-2 menit...
              </span>
            )}
          </div>

          {/* Info error / paid advice callouts */}
          {generationStatus === 'failed' && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 select-none">
              <div className="flex gap-2 items-start">
                <AlertCircle size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-slate-300">
                    Sistem mengaktifkan Mode Simulasi Visual interaktif
                  </p>
                  <p className="leading-relaxed">
                    Model Veo 3.1 Lite memerlukan akses premium berbayar atau penataan kuota khusus developer. Anda tetap dapat menyalin prompt di atas untuk dimasukkan secara manual ke Google AI Studio / Veo Lab secara gratis!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
