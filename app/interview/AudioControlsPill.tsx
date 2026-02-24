'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { LiveAvatarSession } from '@heygen/liveavatar-web-sdk';
import { VoiceChatEvent } from '@heygen/liveavatar-web-sdk';

type DeviceInfo = { deviceId: string; label: string };

function isSetSinkIdSupported(): boolean {
  if (typeof document === 'undefined' || typeof HTMLMediaElement === 'undefined') return false;
  return 'setSinkId' in HTMLMediaElement.prototype;
}

export type AudioControlsPillProps = {
  session: LiveAvatarSession | null;
  remoteAudioElementRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>;
  selectedMicId: string;
  selectedSpeakerId: string;
  onMicChange: (deviceId: string) => void;
  onSpeakerChange: (deviceId: string) => void;
  onOpenAudioTest?: () => void;
};

export function AudioControlsPill({
  session,
  remoteAudioElementRef,
  selectedMicId,
  selectedSpeakerId,
  onMicChange,
  onSpeakerChange,
  onOpenAudioTest,
}: AudioControlsPillProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [mics, setMics] = useState<DeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<DeviceInfo[]>([]);
  const [hasMicPermission, setHasMicPermission] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
        }));
      const outputs = devices
        .filter((d) => d.kind === 'audiooutput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${d.deviceId.slice(0, 8)}`,
        }));
      setMics(inputs);
      setSpeakers(outputs);
    } catch {
      setMics([]);
      setSpeakers([]);
    }
  }, []);

  const refreshDevicesWithPermission = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setHasMicPermission(true);
    } catch {
      setHasMicPermission(false);
    }
    await refreshDevices();
  }, [refreshDevices]);

  useEffect(() => {
    refreshDevicesWithPermission();
    const handleDeviceChange = () => refreshDevices();
    navigator.mediaDevices?.addEventListener('devicechange', handleDeviceChange);
    return () =>
      navigator.mediaDevices?.removeEventListener('devicechange', handleDeviceChange);
  }, [refreshDevicesWithPermission, refreshDevices]);

  useEffect(() => {
    if (!session?.voiceChat) return;
    const vc = session.voiceChat;
    setIsMuted(vc.isMuted);
    const onMuted = () => setIsMuted(true);
    const onUnmuted = () => setIsMuted(false);
    vc.on(VoiceChatEvent.MUTED, onMuted);
    vc.on(VoiceChatEvent.UNMUTED, onUnmuted);
    return () => {
      vc.off(VoiceChatEvent.MUTED, onMuted);
      vc.off(VoiceChatEvent.UNMUTED, onUnmuted);
    };
  }, [session]);

  useEffect(() => {
    if (!isSetSinkIdSupported() || !remoteAudioElementRef.current || !selectedSpeakerId) return;
    const el = remoteAudioElementRef.current;
    el.setSinkId(selectedSpeakerId).catch(() => {});
  }, [selectedSpeakerId, remoteAudioElementRef]);

  useEffect(() => {
    if (!isPopoverOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsPopoverOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        moreButtonRef.current &&
        !moreButtonRef.current.contains(target)
      ) {
        setIsPopoverOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPopoverOpen]);

  const handleToggleMute = useCallback(() => {
    if (!session?.voiceChat) return;
    const vc = session.voiceChat;
    if (vc.isMuted) {
      vc.unmute();
      setIsMuted(false);
    } else {
      vc.mute();
      setIsMuted(true);
    }
  }, [session]);

  const handleMicSelect = useCallback(
    async (deviceId: string) => {
      onMicChange(deviceId);
      if (session?.voiceChat) {
        try {
          await session.voiceChat.setDevice(deviceId);
        } catch {
          // Keep UI in sync; device may apply on next interaction
        }
      }
    },
    [session, onMicChange]
  );

  const handleSpeakerSelect = useCallback(
    (deviceId: string) => {
      onSpeakerChange(deviceId);
    },
    [onSpeakerChange]
  );

  const micDisabled = !session || !hasMicPermission;
  const selectedMicLabel = mics.find((d) => d.deviceId === selectedMicId)?.label ?? (selectedMicId || 'Default');

  return (
    <div
      className="flex flex-row items-center rounded-full bg-[rgba(255,255,255,0.25)] backdrop-blur-sm border border-[var(--border-line)] p-0.5 gap-0.5"
      role="group"
      aria-label="Audio controls"
    >
      {/* More / Audio settings */}
      <div className="relative" ref={popoverRef}>
        <button
          ref={moreButtonRef}
          type="button"
          className="audio-pill-btn"
          onClick={() => {
            setIsPopoverOpen((o) => !o);
            if (!isPopoverOpen) refreshDevicesWithPermission();
          }}
          aria-label="Audio settings"
          aria-haspopup="true"
          aria-expanded={isPopoverOpen}
          data-state={isPopoverOpen ? 'open' : 'closed'}
        >
          <ThreeDotsIcon />
        </button>
        {isPopoverOpen && (
          <div
            className="absolute left-0 bottom-full mb-2 z-50 w-72 rounded-xl border border-[var(--border-line)] bg-[var(--card-bg)] shadow-lg p-4"
            style={{ color: 'var(--text-primary)' }}
            role="dialog"
            aria-label="Audio settings menu"
          >
            <p className="text-xs sub-text mb-2">
              Mic: {isMuted ? 'Muted' : 'On'} · {selectedMicLabel}
            </p>
            <div className="space-y-3 text-sm">
              <div>
                <label className="sub-text block mb-1">Microphone</label>
                <select
                  value={selectedMicId}
                  onChange={(e) => handleMicSelect(e.target.value)}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border-line)] rounded-lg p-2 text-sm"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {mics.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              {isSetSinkIdSupported() && (
                <div>
                  <label className="sub-text block mb-1">Speaker</label>
                  <select
                    value={selectedSpeakerId}
                    onChange={(e) => handleSpeakerSelect(e.target.value)}
                    className="w-full bg-[var(--bg-color)] border border-[var(--border-line)] rounded-lg p-2 text-sm"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {speakers.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!isSetSinkIdSupported() && (
                <p className="text-xs sub-text">Speaker selection not supported in this browser.</p>
              )}
            </div>
            {onOpenAudioTest && (
              <div className="mt-4 pt-4 border-t border-[var(--border-line)]">
                <button
                  type="button"
                  className="btn btn-primary w-full text-sm"
                  onClick={() => {
                    onOpenAudioTest();
                    setIsPopoverOpen(false);
                  }}
                >
                  Test audio devices
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mute / Unmute */}
      <button
        type="button"
        className="audio-pill-btn"
        disabled={micDisabled}
        onClick={handleToggleMute}
        aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        data-muted={isMuted ? 'true' : undefined}
      >
        {isMuted ? <MicOffIcon /> : <MicOnIcon />}
      </button>
    </div>
  );
}

function ThreeDotsIcon() {
  return (
    <span className="flex items-center justify-center gap-0.5" aria-hidden>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
    </span>
  );
}

function MicOnIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5.77" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}
