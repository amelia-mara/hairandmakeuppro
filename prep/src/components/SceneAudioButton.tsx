/**
 * Owner-tier "read this scene aloud" button.
 *
 * Hits the scene-tts Edge Function, which caches generated audio in
 * Storage so replays are free. Renders nothing for non-owner users.
 *
 * One audio element per mounted button — when a different scene is
 * selected the button unmounts, which stops playback.
 */

import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { isOwnerTier } from '@/utils/tierUtils';
import { fetchSceneAudio } from '@/services/sceneTtsService';

interface Props {
  projectId: string;
  sceneId: string;
  text: string;
}

export function SceneAudioButton({ projectId, sceneId, text }: Props) {
  // Effective tier respects the owner-only "preview as another tier"
  // swap, so previewing as Designer correctly hides the button.
  const tier = useAuthStore((s) => s.getEffectiveTier());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When the scene changes, clean up any in-flight audio so we don't
  // keep playing the previous scene over the new one.
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlaying(false);
      setLoading(false);
      setError(null);
    };
  }, [sceneId]);

  if (!tier || !isOwnerTier(tier)) return null;

  const trimmed = text.trim();
  const disabled = loading || trimmed.length === 0;

  const togglePlay = async () => {
    setError(null);
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play();
        setPlaying(true);
      } else {
        audioRef.current.pause();
        setPlaying(false);
      }
      return;
    }

    setLoading(true);
    const { data, error: fetchErr } = await fetchSceneAudio({
      projectId,
      sceneId,
      text: trimmed,
    });
    setLoading(false);
    if (fetchErr || !data) {
      setError('Audio unavailable');
      return;
    }

    const audio = new Audio(data.audioUrl);
    audioRef.current = audio;
    audio.addEventListener('ended', () => setPlaying(false));
    audio.addEventListener('pause', () => {
      // Only flip "playing" off on a user-initiated pause; "ended"
      // already handles natural end-of-track.
      if (!audio.ended) setPlaying(false);
    });
    audio.addEventListener('play', () => setPlaying(true));
    try {
      await audio.play();
    } catch {
      setError('Playback blocked');
    }
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
            : loading
              ? 'Generating audio…'
              : 'Read this scene aloud'
      }
      aria-label={playing ? 'Pause scene audio' : 'Play scene audio'}
    >
      {loading ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.8s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : playing ? (
        // pause icon
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        // speaker + play icon
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      )}
      <span>{playing ? 'Pause' : loading ? 'Loading' : 'Listen'}</span>
    </button>
  );
}
