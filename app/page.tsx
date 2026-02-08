'use client';

import { useState, useRef, useEffect } from 'react';
import { LiveAvatarSession } from '@heygen/liveavatar-web-sdk';

type ChatMessage = {
  sender: 'User' | 'Avatar';
  text: string;
};

export default function Home() {
  const [status, setStatus] = useState('Idle');
  const [session, setSession] = useState<LiveAvatarSession | null>(null);
  const [transcripts, setTranscripts] = useState<ChatMessage[]>([]);
  const [streamActive, setStreamActive] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  const addDebug = (msg: string) => {
    console.log(msg);
    setDebugInfo(prev => prev + "\n" + msg);
  };

  const startSession = async () => {
    setStatus('Initializing...');
    setTranscripts([]);
    setDebugInfo("Starting...");
    
    try {
      const response = await fetch('/api/token', { method: 'POST' });
      const data = await response.json();

      if (!data.data?.session_token) throw new Error("No token found");

      // --- NEW DEBUGGING CODE ---
      console.log("============================================");
      console.log("🔴 COPY THESE VALUES FOR THE LIVEKIT TESTER:");
      console.log("URL:", data.data.livekit_url || "wss://heygen-....livekit.cloud"); 
      console.log("TOKEN:", data.data.livekit_access_token || data.data.access_token);
      console.log("============================================");
      // --------------------------

      const newSession = new LiveAvatarSession(data.data.session_token, {
        voiceChat: true
      });

      // --- CRITICAL: MEDIA HANDLING ---
      const handleStream = (stream: MediaStream) => {
        addDebug(`Stream received with ${stream.getTracks().length} tracks`);
        
        stream.getTracks().forEach(track => {
            addDebug(`Track found: ${track.kind} (enabled: ${track.enabled})`);
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            addDebug("Video metadata loaded. Attempting play...");
            videoRef.current?.play()
              .then(() => {
                  addDebug("Playback started successfully!");
                  setStreamActive(true);
                  setStatus('Connected');
              })
              .catch(e => {
                  addDebug("Autoplay blocked: " + e.message);
                  setStatus('Click "Force Play" button!');
              });
          };
        }
      };

      // Listen to ALL possible events
      newSession.on("stream-ready" as any, (e: any) => handleStream(e.detail || e));
      newSession.on("stream" as any, (e: any) => handleStream(e.detail || e));

      // Transcript handling
      newSession.on("user.transcription" as any, (e: any) => {
        setTranscripts(prev => [...prev, { sender: 'User', text: e.detail?.text || e.text }]);
      });
      newSession.on("avatar.transcription" as any, (e: any) => {
        setTranscripts(prev => [...prev, { sender: 'Avatar', text: e.detail?.text || e.text }]);
      });

      await newSession.start();
      setSession(newSession);
      setStatus('Waiting for media...');

    } catch (error: any) {
      addDebug("Error: " + error.message);
      setStatus("Failed");
    }
  };

  const stopSession = async () => {
    await session?.stop();
    setSession(null);
    setStreamActive(false);
    setStatus('Idle');
  };

  // Manual override for browser restrictions
  const forcePlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      videoRef.current.muted = false; // Ensure audio is on
      setStreamActive(true);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-900 text-white font-sans">
      
      {/* LEFT: Video & Controls */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative border-r border-gray-800">
        
        <div className="relative w-full max-w-2xl aspect-video bg-black rounded-lg overflow-hidden shadow-2xl border border-gray-700">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          
          {/* Status Overlay */}
          {!streamActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
              <span className="text-xl font-bold mb-4 text-blue-400">{status}</span>
              {status !== 'Idle' && (
                <button 
                  onClick={forcePlay}
                  className="px-6 py-2 bg-green-500 hover:bg-green-600 rounded text-white font-bold transition"
                >
                  ▶ FORCE UNMUTE / PLAY
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-4">
          {!session ? (
            <button
              onClick={startSession}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-full font-bold shadow-lg transition"
            >
              Start Conversation
            </button>
          ) : (
            <button
              onClick={stopSession}
              className="px-8 py-3 bg-red-600 hover:bg-red-500 rounded-full font-bold shadow-lg transition"
            >
              End Session
            </button>
          )}
        </div>

        {/* Debug Log (Tiny text at bottom left) */}
        <div className="mt-4 w-full max-w-2xl h-32 overflow-y-auto bg-gray-950 p-2 text-[10px] font-mono text-gray-500 border border-gray-800 rounded">
            <pre>{debugInfo}</pre>
        </div>
      </div>

      {/* RIGHT: Transcripts */}
      <div className="w-full md:w-80 bg-gray-800 flex flex-col">
        <div className="p-4 bg-gray-900 border-b border-gray-700 font-bold text-gray-300">
          TRANSCRIPT
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {transcripts.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.sender === 'User' ? 'items-end' : 'items-start'}`}>
              <span className="text-xs text-gray-500 mb-1">{msg.sender}</span>
              <div className={`px-3 py-2 rounded-lg text-sm max-w-[90%] ${
                msg.sender === 'User' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}