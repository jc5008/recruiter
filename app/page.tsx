'use client';

import { useState, useRef, useEffect } from 'react';
import { LiveAvatarSession, SessionEvent } from '@heygen/liveavatar-web-sdk';
import Image from 'next/image';

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
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [showHelpPopover, setShowHelpPopover] = useState(false);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const [showDiagnosticsDialog, setShowDiagnosticsDialog] = useState(false);
  const [showAudioTestPopup, setShowAudioTestPopup] = useState(true);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [audioTestStep, setAudioTestStep] = useState<'speaker' | 'speaker-playing' | 'speaker-paused' | 'speaker-done' | 'mic' | 'mic-recording' | 'mic-playback'>('speaker');
  const [speakerLevel, setSpeakerLevel] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [audioInputDevices, setAudioInputDevices] = useState<{ deviceId: string; label: string }[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<{ deviceId: string; label: string }[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const speakerAnalyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micAnimationRef = useRef<number>(0);
  const recordedChunksRef = useRef<Blob[]>([]);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakerTestAudioRef = useRef<HTMLAudioElement | null>(null);

  const addDebug = (msg: string) => {
    console.log(msg);
    setDebugInfo((prev) => prev + '\n' + msg);
  };

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  // Enumerate microphone and speaker devices (request permission first so labels are available)
  useEffect(() => {
    let cancelled = false;
    async function loadDevices() {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        // Permission denied or no mic; still try to list what we can
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (cancelled) return;
      const inputs = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 8)}` }));
      const outputs = devices
        .filter((d) => d.kind === 'audiooutput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Speaker ${d.deviceId.slice(0, 8)}` }));
      setAudioInputDevices(inputs);
      setAudioOutputDevices(outputs);
      setSelectedMicId((prev) => (prev ? prev : inputs[0]?.deviceId ?? ''));
      setSelectedSpeakerId((prev) => (prev ? prev : outputs[0]?.deviceId ?? ''));
    }
    loadDevices();
    return () => {
      cancelled = true;
    };
  }, []);

  // When SDK reports stream ready, attach the video element
  useEffect(() => {
    if (!streamReady || !session || !videoRef.current) return;
    addDebug('Attaching video element to avatar stream...');
    try {
      session.attach(videoRef.current);
      addDebug('Attach completed. Starting playback...');
      videoRef.current
        .play()
        .then(() => {
          addDebug('Avatar video/audio playback started.');
          setStreamActive(true);
          setStatus('Connected');
        })
        .catch((e: Error) => {
          addDebug('Autoplay blocked: ' + e.message);
          setStatus('Click "Force Play" to hear and see the avatar');
        });
    } catch (e: unknown) {
      addDebug('Attach error: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [streamReady, session]);

  const startSession = async () => {
    setStatus('Initializing...');
    setTranscripts([]);
    setStreamReady(false);
    setStreamActive(false);
    setDebugInfo('Starting...');

    try {
      const response = await fetch('/api/token', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error ?? 'Token failed');

      const sessionToken = data.data?.session_token ?? data.session_token;
      if (!sessionToken) throw new Error('No session token found');

      const newSession = new LiveAvatarSession(sessionToken, {
        voiceChat: true,
      });

      newSession.on(SessionEvent.SESSION_STREAM_READY, () => {
        addDebug('Avatar stream ready (session.stream_ready)');
        setStreamReady(true);
      });

      newSession.on('user.transcription' as any, (e: any) => {
        const text = e?.detail?.text ?? e?.text ?? '';
        if (text) setTranscripts((prev) => [...prev, { sender: 'User', text }]);
      });
      newSession.on('avatar.transcription' as any, (e: any) => {
        const text = e?.detail?.text ?? e?.text ?? '';
        if (text) setTranscripts((prev) => [...prev, { sender: 'Avatar', text }]);
      });

      await newSession.start();
      setSession(newSession);
      setStatus('Waiting for avatar stream...');
    } catch (error: unknown) {
      addDebug('Error: ' + (error instanceof Error ? error.message : String(error)));
      setStatus('Failed');
    }
  };

  const stopSession = async () => {
    await session?.stop();
    setSession(null);
    setStreamActive(false);
    setStreamReady(false);
    setStatus('Idle');
  };

  const forcePlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      videoRef.current.muted = false;
      setStreamActive(true);
    }
  };

  // --- Audio device test ---
  const playSpeakerTest = () => {
    setAudioTestStep('speaker-playing');
    setSpeakerLevel(0);
    const audio = speakerTestAudioRef.current ?? new Audio('/speaker_test.mp3');
    if (!speakerTestAudioRef.current) {
      audio.loop = false;
      speakerTestAudioRef.current = audio;
      audio.addEventListener('ended', () => {
        if (micAnimationRef.current) cancelAnimationFrame(micAnimationRef.current);
        setAudioTestStep('speaker-done');
        setSpeakerLevel(0);
      });
      audio.addEventListener('error', () => setAudioTestStep('speaker'));
    } else {
      if (!audio.paused || audio.ended) audio.currentTime = 0;
    }
    try {
      const ctx = audioContextRef.current ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      if (!audioContextRef.current) audioContextRef.current = ctx;
      let analyser = speakerAnalyserRef.current;
      if (!analyser) {
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        const source = ctx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        speakerAnalyserRef.current = analyser;
      }
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (audio.ended || audio.paused) return;
        analyser!.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setSpeakerLevel(Math.min(100, (avg / 128) * 100));
        micAnimationRef.current = requestAnimationFrame(tick);
      };
      micAnimationRef.current = requestAnimationFrame(tick);
      audio.play().catch(() => setAudioTestStep('speaker'));
    } catch {
      audio.play().catch(() => setAudioTestStep('speaker'));
    }
  };

  const pauseSpeakerTest = () => {
    if (micAnimationRef.current) cancelAnimationFrame(micAnimationRef.current);
    speakerTestAudioRef.current?.pause();
    setAudioTestStep('speaker-paused');
    setSpeakerLevel(0);
  };

  const startMicTest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true,
      });
      micStreamRef.current = stream;
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      micAnalyserRef.current = analyser;
      setAudioTestStep('mic');
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let recordingStarted = false;
      let recordingStartTime = 0;
      const tick = () => {
        if (!micAnalyserRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const level = Math.min(100, (avg / 128) * 120);
        setMicLevel(level);
        if (level > 3 && !recordingStarted) {
          recordingStarted = true;
          recordingStartTime = Date.now();
          recordedChunksRef.current = [];
          const recorder = new MediaRecorder(stream);
          recorder.ondataavailable = (e) => {
            if (e.data.size) recordedChunksRef.current.push(e.data);
          };
          recorder.onstop = () => {
            if (micAnimationRef.current) cancelAnimationFrame(micAnimationRef.current);
            micStreamRef.current?.getTracks().forEach((t) => t.stop());
            micStreamRef.current = null;
            const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            playbackAudioRef.current = audio;
            setAudioTestStep('mic-playback');
            setMicLevel(0);
            audio.onended = () => {
              URL.revokeObjectURL(url);
            };
            audio.play().catch(() => setAudioTestStep('mic'));
          };
          recorder.start(100);
          setTimeout(() => recorder.stop(), 3000);
        }
        if (recordingStarted && Date.now() - recordingStartTime > 3200) {
          return;
        }
        micAnimationRef.current = requestAnimationFrame(tick);
      };
      micAnimationRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setAudioTestStep('mic');
    }
  };

  const closeAudioTest = () => {
    if (micAnimationRef.current) cancelAnimationFrame(micAnimationRef.current);
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    playbackAudioRef.current?.pause();
    speakerTestAudioRef.current?.pause();
    speakerTestAudioRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    speakerAnalyserRef.current = null;
    setShowAudioTestPopup(false);
    setShowSkipConfirm(false);
    setAudioTestStep('speaker');
    setSpeakerLevel(0);
    setMicLevel(0);
  };

  const openAudioTest = () => {
    setShowSettingsPopover(false);
    setShowAudioTestPopup(true);
    setShowSkipConfirm(false);
    setAudioTestStep('speaker');
    setSpeakerLevel(0);
    setMicLevel(0);
  };

  const confirmSkip = () => {
    setShowSkipConfirm(false);
    closeAudioTest();
  };

  const goToMicStep = () => {
    if (micAnimationRef.current) cancelAnimationFrame(micAnimationRef.current);
    speakerTestAudioRef.current?.pause();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    playbackAudioRef.current?.pause();
    setAudioTestStep('mic');
    setSpeakerLevel(0);
    setMicLevel(0);
    startMicTest();
  };

  return (
    <div className="virtual-interview-page flex flex-col min-h-screen">
      {/* 1. Navigation & Branding Layer */}
      <header className="nav-container grid grid-cols-3 items-center">
        <div className="flex items-center gap-2">
          <Image src="/wvs_logo.png" alt="WV Supply Logo" width={128} height={36} className="shrink-0 w-[128px] h-[36px] object-contain" />
        </div>
        <h1 className="display-title text-center justify-self-center">
          Virtual Interview
        </h1>
        <div className="flex items-center gap-1 justify-self-end">
          <div className="relative" ref={helpRef}>
            <button
              type="button"
              className="nav-pills"
              onClick={() => { setShowHelpPopover((v) => !v); setShowSettingsPopover(false); }}
            >
              Help
            </button>
            {showHelpPopover && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  aria-hidden
                  onClick={() => setShowHelpPopover(false)}
                />
                <div
                  className="absolute right-0 top-full mt-2 z-50 w-80 transcript-panel p-4 shadow-lg rounded-xl border border-black/08"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    While this is a virtual interview, simply speak to the interviewer as you would to a person.
                  </p>
                  <hr className="my-4 border-black/10" />
                  <p className="text-sm sub-text">
                    If you need technical assistance, please call Human Resources at{' '}
                    <a href="tel:+13043994568" className="font-medium underline" style={{ color: 'var(--accent-red)' }}>
                      (304) 399-4568
                    </a>
                    .
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              className="nav-pills"
              onClick={() => { setShowSettingsPopover((v) => !v); setShowHelpPopover(false); }}
            >
              Settings
            </button>
            {showSettingsPopover && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  aria-hidden
                  onClick={() => setShowSettingsPopover(false)}
                />
                <div
                  className="absolute right-0 top-full mt-2 z-50 w-80 transcript-panel p-4 shadow-lg rounded-xl border border-black/08"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <div className="sub-text font-semibold uppercase tracking-wide mb-3">AUDIO DEVICES</div>
                  <div className="space-y-3 text-sm">
                    <div>
                      <label className="sub-text block mb-1">Microphone</label>
                      <select
                        value={selectedMicId}
                        onChange={(e) => setSelectedMicId(e.target.value)}
                        className="w-full bg-[var(--bg-color)] border border-black/10 rounded-lg p-2 text-sm"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {audioInputDevices.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="sub-text block mb-1">Speaker</label>
                      <select
                        value={selectedSpeakerId}
                        onChange={(e) => setSelectedSpeakerId(e.target.value)}
                        className="w-full bg-[var(--bg-color)] border border-black/10 rounded-lg p-2 text-sm"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {audioOutputDevices.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-black/08">
                    <button
                      type="button"
                      className="btn btn-primary w-full text-sm"
                      onClick={openAudioTest}
                    >
                      Test audio devices
                    </button>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      className="text-xs sub-text hover:opacity-80 underline"
                      onClick={() => {
                        setShowSettingsPopover(false);
                        setShowDiagnosticsDialog(true);
                      }}
                    >
                      Diagnostics
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Primary content – at md+: video 70vw, transcript 3% from right */}
      <main className="flex-1 w-full mx-auto px-5 py-6 flex flex-col md:flex-row md:pl-[2%] md:pr-[3%] gap-6">
        {/* Center: Video Stage – 70% viewport width at md+ */}
        <div className="flex-1 min-w-0 md:flex-none md:w-[70vw] flex flex-col items-center">
          <div className="info-card relative w-full max-w-2xl md:max-w-none aspect-video bg-[var(--text-primary)] overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {!streamActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10">
                <span className="text-lg font-medium text-white/90">{status}</span>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            {!session && (
              <button type="button" onClick={startSession} className="btn btn-primary">
                Start Interview
              </button>
            )}
          </div>

        </div>

        {/* Right: Transcript Panel – fills remainder, 3% from right via main pr-[3%] */}
        <aside className="w-full md:w-auto md:flex-1 md:min-w-0 shrink-0 flex flex-col">
          <div className="transcript-panel flex-1 flex flex-col min-h-[280px] overflow-hidden">
            <div
              className="px-4 py-3 border-b border-black/06 font-semibold text-sm"
              style={{ color: 'var(--text-primary)' }}
            >
              Transcript
            </div>
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
              style={{ color: 'var(--text-primary)' }}
            >
              {transcripts.map((msg, i) => (
                <div
                  key={`${i}-${msg.text.slice(0, 12)}`}
                  className={`animate-fade flex flex-col ${msg.sender === 'User' ? 'items-end' : 'items-start'}`}
                >
                  <span className="sub-text mb-1">{msg.sender}</span>
                  <div
                    className={`px-3 py-2 rounded-lg text-sm max-w-[90%] ${
                      msg.sender === 'User'
                        ? 'bg-[var(--text-primary)] text-white'
                        : 'bg-[var(--bg-color)]'
                    }`}
                    style={
                      msg.sender === 'Avatar'
                        ? { color: 'var(--text-primary)', border: '1px solid rgba(0,0,0,0.06)' }
                        : undefined
                    }
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {/* 3. Utility Footer */}
      <footer
        className="flex items-center px-5 py-4 border-t border-black/06"
        style={{ background: 'var(--card-bg)' }}
      >
        <button
          type="button"
          onClick={stopSession}
          className="btn btn-danger"
          disabled={!session}
        >
          Leave Interview
        </button>
      </footer>

      {/* Diagnostics dialog (opened from Settings → Diagnostics) */}
      {showDiagnosticsDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setShowDiagnosticsDialog(false)}
        >
          <div
            className="transcript-panel w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ color: 'var(--text-primary)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/08">
              <span className="font-semibold text-sm">Diagnostics</span>
              <button
                type="button"
                className="text-sm sub-text hover:opacity-80"
                onClick={() => setShowDiagnosticsDialog(false)}
              >
                Close
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4 overflow-y-auto">
              <div>
                <button
                  type="button"
                  onClick={forcePlay}
                  className="btn btn-primary"
                >
                  ▶ Force Play
                </button>
                <p className="sub-text text-xs mt-2">Use if audio or video does not start automatically.</p>
              </div>
              <div>
                <div className="sub-text font-semibold uppercase tracking-wide mb-2">Diagnostic log</div>
                <div className="h-48 overflow-y-auto bg-[var(--bg-color)] rounded-lg p-3 text-xs font-mono sub-text border border-black/08">
                  <pre className="whitespace-pre-wrap break-words">{debugInfo || '—'}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audio device test popup (on load + from Settings) */}
      {showAudioTestPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div
            className="transcript-panel w-full max-w-md shadow-xl rounded-xl overflow-hidden"
            style={{ color: 'var(--text-primary)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/08">
              <span className="font-semibold text-sm">Check your audio</span>
              {!showSkipConfirm && (
                <button
                  type="button"
                  className="text-sm sub-text hover:opacity-80"
                  onClick={() => setShowSkipConfirm(true)}
                >
                  Skip
                </button>
              )}
            </div>
            <div className="p-5 space-y-5">
              {/* Skip confirmation */}
              {showSkipConfirm ? (
                <>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Are you sure you want to skip the audio check?
                  </p>
                  <p className="text-sm sub-text leading-relaxed">
                    Audio is required for the virtual interview. We strongly recommend completing this setup before connecting. You can run these tests again anytime from the Settings menu.
                  </p>
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={confirmSkip} className="btn btn-danger flex-1">
                      Continue
                    </button>
                    <button type="button" onClick={() => setShowSkipConfirm(false)} className="btn btn-primary flex-1">
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Speaker step */}
                  {(audioTestStep === 'speaker' || audioTestStep === 'speaker-playing' || audioTestStep === 'speaker-paused' || audioTestStep === 'speaker-done') && (
                    <>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        We&apos;ll play a short test so you can confirm your speakers are working.
                      </p>
                      <div className="space-y-2">
                        <div className="h-3 bg-[var(--bg-color)] rounded-full overflow-hidden border border-black/08">
                          <div
                            className="h-full bg-[var(--accent-red)] rounded-full transition-all duration-75"
                            style={{ width: `${Math.round(speakerLevel)}%` }}
                          />
                        </div>
                        <span className="sub-text text-xs">
                          {audioTestStep === 'speaker-playing' ? 'Playing…' : audioTestStep === 'speaker-paused' ? 'Paused' : audioTestStep === 'speaker-done' ? 'Playback complete' : 'Level'}
                        </span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {audioTestStep === 'speaker' && (
                          <button type="button" onClick={playSpeakerTest} className="btn btn-primary flex-1">
                            Play test sound
                          </button>
                        )}
                        {audioTestStep === 'speaker-playing' && (
                          <>
                            <button type="button" onClick={pauseSpeakerTest} className="btn btn-primary flex-1 min-w-[80px]">
                              Pause
                            </button>
                            <button type="button" onClick={goToMicStep} className="btn btn-primary flex-1 min-w-[80px]">
                              Next
                            </button>
                          </>
                        )}
                        {audioTestStep === 'speaker-paused' && (
                          <>
                            <button type="button" onClick={playSpeakerTest} className="btn btn-primary flex-1 min-w-[80px]">
                              Play
                            </button>
                            <button type="button" onClick={goToMicStep} className="btn btn-primary flex-1 min-w-[80px]">
                              Next
                            </button>
                          </>
                        )}
                        {audioTestStep === 'speaker-done' && (
                          <>
                            <button type="button" onClick={playSpeakerTest} className="btn btn-primary flex-1 min-w-[80px]">
                              Repeat
                            </button>
                            <button type="button" onClick={goToMicStep} className="btn btn-primary flex-1 min-w-[80px]">
                              Next
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}

                  {/* Mic step */}
                  {(audioTestStep === 'mic' || audioTestStep === 'mic-recording' || audioTestStep === 'mic-playback') && (
                    <>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {audioTestStep === 'mic-playback'
                          ? 'Playing back the first 3 seconds we heard from your microphone.'
                          : 'Speak into your microphone. We\'ll record a few seconds once we hear you.'}
                      </p>
                      <div className="space-y-2">
                        <div className="h-3 bg-[var(--bg-color)] rounded-full overflow-hidden border border-black/08">
                          <div
                            className="h-full rounded-full transition-all duration-75"
                            style={{
                              width: `${Math.round(micLevel)}%`,
                              background: audioTestStep === 'mic-playback' ? 'var(--text-secondary)' : 'var(--accent-red)',
                            }}
                          />
                        </div>
                        <span className="sub-text text-xs">
                          {audioTestStep === 'mic-playback' ? 'Playing back…' : micLevel > 3 ? 'Recording…' : 'Speak to see level'}
                        </span>
                      </div>
                      {audioTestStep === 'mic' && (
                        <p className="sub-text text-xs">Say something — recording will start automatically when we detect sound.</p>
                      )}
                      {audioTestStep === 'mic-playback' && (
                        <div className="flex gap-2 flex-wrap">
                          <button type="button" onClick={goToMicStep} className="btn btn-primary flex-1 min-w-[80px]">
                            Repeat
                          </button>
                          <button type="button" onClick={closeAudioTest} className="btn btn-primary flex-1 min-w-[80px]">
                            Finish
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
