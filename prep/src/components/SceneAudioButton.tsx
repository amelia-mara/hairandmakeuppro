/**
 * Owner-tier "read this scene aloud" button.
 *
 * Uses the browser's built-in SpeechSynthesis API so there's no server
 * cost and no edge function to deploy. Voices come from the user's OS.
 * Renders nothing for non-owner users.
 */

import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { isOwnerTier } from '@/utils/tierUtils';

interface Props {
  projectId: string;
  sceneId: string;
  text: string;
}

export function SceneAudioButton({ sceneId, text }: Props) {
  const tier = useAuthStore((s) => s.getEffectiveTier());
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cancel any in-flight speech when the scene changes or the button unmounts.
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      utteranceRef.current = null;
      setPlaying(false);
      setError(null);
    };
  }, [sceneId]);

  if (!tier || !isOwnerTier(tier)) return null;

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const trimmed = text.trim();
  const disabled = !supported || trimmed.length === 0;

  const togglePlay = () => {
    setError(null);
    if (!supported) {
      setError('Speech not supported in this browser');
      return;
    }

    const synth = window.speechSynthesis;

    // Pause / resume an existing utterance.
    if (utteranceRef.current) {
      if (synth.paused) {
        synth.resume();
        setPlaying(true);
      } else if (synth.speaking) {
        synth.pause();
        setPlaying(false);
      }
      return;
    }

    // Fresh utterance.
    const utter = new SpeechSynthesisUtterance(trimmed);
    utter.rate = 1;
    utter.pitch = 1;
    utter.onend = () => {
      utteranceRef.current = null;
      setPlaying(false);
    };
    utter.onerror = () => {
      utteranceRef.current = null;
      setPlaying(false);
      setError('Playback failed');
    };
    utteranceRef.current = utter;
    synth.cancel(); // clear any stale queue
    synth.speak(utter);
    setPlaying(true);
  };

  return (
    <button
      type="button"
      className="scene-audio-btn"
      onClick={togglePlay}
      disabled={disabled}
      title={
        error
          ? error
          : playing
            ? 'Pause'
            : 'Read this scene aloud'
      }
      aria-label={playing ? 'Pause scene audio' : 'Play scene audio'}
    >
      {playing ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      )}
      <span>{playing ? 'Pause' : 'Listen'}</span>
    </button>
  );
}
