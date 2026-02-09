'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

const INTERVIEW_ID_KEY = 'interview_id';
const CANDIDATE_FIRST_NAME_KEY = 'candidate_first_name';

type WizardStep = 'welcome' | 'audio' | 'code';
type AudioTestStep = 'speaker' | 'speaker-playing' | 'speaker-paused' | 'speaker-done' | 'mic' | 'mic-recording' | 'mic-playback';

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>('welcome');

  // Code step
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Audio check (wizard step 2)
  const [audioTestStep, setAudioTestStep] = useState<AudioTestStep>('speaker');
  const [speakerLevel, setSpeakerLevel] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const speakerAnalyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micAnimationRef = useRef<number>(0);
  const recordedChunksRef = useRef<Blob[]>([]);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakerTestAudioRef = useRef<HTMLAudioElement | null>(null);

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        if (recordingStarted && Date.now() - recordingStartTime > 3200) return;
        micAnimationRef.current = requestAnimationFrame(tick);
      };
      micAnimationRef.current = requestAnimationFrame(tick);
    } catch {
      setAudioTestStep('mic');
    }
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

  const finishAudioCheck = () => {
    if (micAnimationRef.current) cancelAnimationFrame(micAnimationRef.current);
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    playbackAudioRef.current?.pause();
    speakerTestAudioRef.current?.pause();
    speakerTestAudioRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    speakerAnalyserRef.current = null;
    setAudioTestStep('speaker');
    setSpeakerLevel(0);
    setMicLevel(0);
    setStep('code');
  };

  const skipAudioConfirm = () => {
    setShowSkipConfirm(false);
    finishAudioCheck();
  };

  const handleSubmitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(INTERVIEW_ID_KEY, data.interviewId ?? '');
        sessionStorage.setItem(CANDIDATE_FIRST_NAME_KEY, data.candidateFirstName ?? '');
      }
      router.push('/interview');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="virtual-interview-page flex flex-col min-h-screen">
      <header className="nav-container grid grid-cols-3 items-center">
        <div className="flex items-center gap-2">
          <Image src="/wvs_logo.png" alt="WV Supply Logo" width={128} height={36} className="shrink-0 w-[128px] h-[36px] object-contain" />
        </div>
        <h1 className="display-title text-center justify-self-center">Virtual Interview</h1>
        <div className="flex-1" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <div className="info-card w-full max-w-md p-8 rounded-2xl shadow-md" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>
          {/* Step 1: Welcome */}
          {step === 'welcome' && (
            <>
              <h2 className="text-xl font-semibold mb-2">Welcome</h2>
              <p className="text-sm sub-text mb-4 leading-relaxed">
                You&apos;ll complete a virtual interview with an AI interviewer. Your conversation will be transcribed for our team. Please use a quiet space and a working microphone.
              </p>
              <p className="text-xs sub-text mb-4">
                By continuing, you agree that your audio may be recorded and used for evaluation. See our privacy policy for details.
              </p>
              <div className="mb-6 w-full max-w-[700px] mx-auto aspect-video rounded-xl border border-black/08 overflow-hidden bg-black/5">
                <video
                  src="/welcome.mp4"
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                  title="Virtual Interview Preparation"
                />
              </div>
              <button type="button" onClick={() => setStep('audio')} className="btn btn-primary w-full">
                Get started
              </button>
            </>
          )}

          {/* Step 2: Check your audio */}
          {step === 'audio' && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold">Check your audio</h2>
              {showSkipConfirm ? (
                <>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Skip the audio check?</p>
                  <p className="text-sm sub-text leading-relaxed">
                    Audio is required for the interview. We recommend completing this step. You can test again from Settings during the interview.
                  </p>
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={skipAudioConfirm} className="btn btn-danger flex-1">Skip</button>
                    <button type="button" onClick={() => setShowSkipConfirm(false)} className="btn btn-primary flex-1">Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  {(audioTestStep === 'speaker' || audioTestStep === 'speaker-playing' || audioTestStep === 'speaker-paused' || audioTestStep === 'speaker-done') && (
                    <>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        We&apos;ll play a short test so you can confirm your speakers are working.
                      </p>
                      <div className="space-y-2">
                        <div className="h-3 bg-[var(--bg-color)] rounded-full overflow-hidden border border-black/08">
                          <div className="h-full bg-[var(--accent-red)] rounded-full transition-all duration-75" style={{ width: `${Math.round(speakerLevel)}%` }} />
                        </div>
                        <span className="sub-text text-xs">
                          {audioTestStep === 'speaker-playing' ? 'Playing…' : audioTestStep === 'speaker-paused' ? 'Paused' : audioTestStep === 'speaker-done' ? 'Playback complete' : 'Level'}
                        </span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {audioTestStep === 'speaker' && <button type="button" onClick={playSpeakerTest} className="btn btn-primary flex-1">Play test sound</button>}
                        {audioTestStep === 'speaker-playing' && (
                          <>
                            <button type="button" onClick={pauseSpeakerTest} className="btn btn-primary flex-1 min-w-[80px]">Pause</button>
                            <button type="button" onClick={goToMicStep} className="btn btn-primary flex-1 min-w-[80px]">Next</button>
                          </>
                        )}
                        {audioTestStep === 'speaker-paused' && (
                          <>
                            <button type="button" onClick={playSpeakerTest} className="btn btn-primary flex-1 min-w-[80px]">Play</button>
                            <button type="button" onClick={goToMicStep} className="btn btn-primary flex-1 min-w-[80px]">Next</button>
                          </>
                        )}
                        {audioTestStep === 'speaker-done' && (
                          <>
                            <button type="button" onClick={playSpeakerTest} className="btn btn-primary flex-1 min-w-[80px]">Repeat</button>
                            <button type="button" onClick={goToMicStep} className="btn btn-primary flex-1 min-w-[80px]">Next</button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                  {(audioTestStep === 'mic' || audioTestStep === 'mic-recording' || audioTestStep === 'mic-playback') && (
                    <>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {audioTestStep === 'mic-playback'
                          ? 'Playing back the first 3 seconds we heard from your microphone.'
                          : "Speak into your microphone. We'll record a few seconds once we hear you."}
                      </p>
                      <div className="space-y-2">
                        <div className="h-3 bg-[var(--bg-color)] rounded-full overflow-hidden border border-black/08">
                          <div className="h-full rounded-full transition-all duration-75" style={{ width: `${Math.round(micLevel)}%`, background: audioTestStep === 'mic-playback' ? 'var(--text-secondary)' : 'var(--accent-red)' }} />
                        </div>
                        <span className="sub-text text-xs">
                          {audioTestStep === 'mic-playback' ? 'Playing back…' : micLevel > 3 ? 'Recording…' : 'Speak to see level'}
                        </span>
                      </div>
                      {audioTestStep === 'mic' && <p className="sub-text text-xs">Say something — recording will start automatically when we detect sound.</p>}
                      {audioTestStep === 'mic-playback' && (
                        <div className="flex gap-2 flex-wrap">
                          <button type="button" onClick={goToMicStep} className="btn btn-primary flex-1 min-w-[80px]">Repeat</button>
                          <button type="button" onClick={finishAudioCheck} className="btn btn-primary flex-1 min-w-[80px]">Continue</button>
                        </div>
                      )}
                    </>
                  )}
                  <div className="pt-2">
                    <button type="button" onClick={() => setShowSkipConfirm(true)} className="text-xs sub-text hover:opacity-80 underline">
                      Skip audio check
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Enter code */}
          {step === 'code' && (
            <>
              <h2 className="text-xl font-semibold mb-2">Enter your code</h2>
              <p className="text-sm sub-text mb-4 leading-relaxed">
                Enter the interview code you received. You&apos;ll then connect to your session.
              </p>
              <form onSubmit={handleSubmitCode} className="space-y-4">
                <div>
                  <label htmlFor="code" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                    Interview code
                  </label>
                  <input
                    id="code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Enter the code you received"
                    className="w-full px-4 py-3 rounded-lg border border-black/10 bg-[var(--bg-color)] text-sm"
                    style={{ color: 'var(--text-primary)' }}
                    autoComplete="off"
                    autoFocus
                    disabled={submitting}
                  />
                </div>
                {error && <p className="text-sm font-medium" style={{ color: 'var(--accent-red)' }}>{error}</p>}
                <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
                  {submitting ? 'Connecting…' : 'Connect to session'}
                </button>
              </form>
            </>
          )}

          <p className="text-xs sub-text mt-6 pt-4 border-t border-black/06">
            Need help? Contact Human Resources at{' '}
            <a href="tel:+13043994568" className="font-medium underline" style={{ color: 'var(--accent-red)' }}>
              (304) 399-4568
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
