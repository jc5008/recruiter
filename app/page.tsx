'use client';

import { useState, useRef, useEffect } from 'react';
import { LiveAvatarSession, SessionEvent } from '@heygen/liveavatar-web-sdk';

type ChatMessage = {
  sender: 'User' | 'Avatar';
  text: string;
};

export default function Home() {
  const [status, setStatus] = useState('Idle');
  const [session, setSession] = useState<LiveAvatarSession | null>(null);
  const [transcripts, setTranscripts] = useState<ChatMessage[]>([]);
  const [streamActive, setStreamActive] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [livekitUrl, setLivekitUrl] = useState<string>("");
  const [livekitToken, setLivekitToken] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addDebug = (msg: string) => {
    console.log(msg);
    setDebugInfo(prev => prev + "\n" + msg);
  };

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  // When SDK reports stream ready, attach the video element so user can see and hear the avatar
  useEffect(() => {
    if (!streamReady || !session || !videoRef.current) return;
    addDebug("Attaching video element to avatar stream...");
    try {
      session.attach(videoRef.current);
      addDebug("Attach completed. Starting playback...");
      videoRef.current.play()
        .then(() => {
          addDebug("Avatar video/audio playback started.");
          setStreamActive(true);
          setStatus('Connected');
        })
        .catch((e: Error) => {
          addDebug("Autoplay blocked: " + e.message);
          setStatus('Click "Force Play" to hear and see the avatar');
        });
    } catch (e: unknown) {
      addDebug("Attach error: " + (e instanceof Error ? e.message : String(e)));
    }
  }, [streamReady, session]);

  const startSession = async () => {
    setStatus('Initializing...');
    setTranscripts([]);
    setStreamReady(false);
    setStreamActive(false);
    setDebugInfo("Starting...");

    try {
      // Use token-only so the SDK is the only one that calls start (avoids "Session already exists")
      const response = await fetch('/api/token', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error ?? "Token failed");

      const sessionToken = data.data?.session_token ?? data.session_token;
      if (!sessionToken) throw new Error("No session token found");

      const newSession = new LiveAvatarSession(sessionToken, {
        voiceChat: true,
      });

      // SDK: when the avatar stream is ready, we attach the video element via session.attach() in a useEffect
      newSession.on(SessionEvent.SESSION_STREAM_READY, () => {
        addDebug("Avatar stream ready (session.stream_ready)");
        setStreamReady(true);
      });

      // Transcript handling (use SDK event names)
      newSession.on("user.transcription" as any, (e: any) => {
        const text = e?.detail?.text ?? e?.text ?? '';
        if (text) setTranscripts(prev => [...prev, { sender: 'User', text }]);
      });
      newSession.on("avatar.transcription" as any, (e: any) => {
        const text = e?.detail?.text ?? e?.text ?? '';
        if (text) setTranscripts(prev => [...prev, { sender: 'Avatar', text }]);
      });

      await newSession.start();
      setSession(newSession);
      setStatus('Waiting for avatar stream...');
    } catch (error: any) {
      addDebug("Error: " + (error?.message ?? String(error)));
      setStatus("Failed");
    }
  };

  const stopSession = async () => {
    await session?.stop();
    setSession(null);
    setStreamActive(false);
    setStreamReady(false);
    setStatus('Idle');
  };

  const fetchLiveKitCredentials = async () => {
    addDebug("Fetching LiveKit credentials (uses a separate test session)...");
    try {
      const response = await fetch('/api/start', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed");
      setLivekitUrl(data.livekit_url ?? "");
      setLivekitToken(data.livekit_client_token ?? "");
      addDebug("LiveKit URL and Room Token ready for connection test.");
    } catch (e: unknown) {
      addDebug("Error: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => addDebug(`Copied ${label}`),
      () => addDebug(`Failed to copy ${label}`)
    );
  };

  const meetUrl =
    livekitUrl && livekitToken
      ? `https://meet.livekit.io/custom?liveKitUrl=${encodeURIComponent(livekitUrl)}&token=${encodeURIComponent(livekitToken)}`
      : "";

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

        {/* LiveKit connection test (per https://docs.liveavatar.com/docs/quick-start-guide step 3) */}
        <div className="mt-4 w-full max-w-2xl bg-gray-950 p-4 border border-gray-800 rounded space-y-3">
          <div className="text-xs font-bold text-amber-400 uppercase tracking-wide">
            LiveKit connection test
          </div>
          {!(livekitUrl || livekitToken) ? (
            <>
              <p className="text-xs text-gray-400">
                Get URL and Room Token to test at{" "}
                <a
                  href="https://livekit.io/connection-test"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  livekit.io/connection-test
                </a>
                . Uses a separate test session (not the in-app conversation).
              </p>
              <button
                type="button"
                onClick={fetchLiveKitCredentials}
                className="px-4 py-2 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 rounded text-sm border border-amber-600/50"
              >
                Get LiveKit credentials
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-400">
                Use these at{" "}
                <a
                  href="https://livekit.io/connection-test"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  livekit.io/connection-test
                </a>{" "}
                or open the meet URL to join the room in your browser.
              </p>
              {livekitUrl && (
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">LiveKit URL</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={livekitUrl}
                    className="flex-1 min-w-0 bg-gray-900 text-gray-300 text-xs font-mono p-2 rounded border border-gray-700"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(livekitUrl, "LiveKit URL")}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs whitespace-nowrap"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
            {livekitToken && (
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Room Token</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={livekitToken}
                    className="flex-1 min-w-0 bg-gray-900 text-gray-300 text-xs font-mono p-2 rounded border border-gray-700 truncate"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(livekitToken, "Room Token")}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs whitespace-nowrap"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
            {meetUrl && (
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Meet URL (join room)</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={meetUrl}
                    className="flex-1 min-w-0 bg-gray-900 text-gray-300 text-xs font-mono p-2 rounded border border-gray-700 truncate"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(meetUrl, "Meet URL")}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs whitespace-nowrap"
                  >
                    Copy
                  </button>
                  <a
                    href={meetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs whitespace-nowrap"
                  >
                    Open
                  </a>
                </div>
              </div>
            )}
              <a
                href="https://livekit.io/connection-test"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded text-xs border border-amber-600/50"
              >
                Open LiveKit Connection Tester →
              </a>
            </>
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