import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clamp } from "../lib/time";

export interface AudioEngine {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  rate: number;
  ready: boolean;
  error: string | null;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
  skip: (delta: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setRate: (r: number) => void;
}

export function useAudioEngine(src: string | null): AudioEngine {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRateState] = useState(1);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (audioRef.current === null && typeof Audio !== "undefined") {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setReady(false);
    setError(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    if (src) {
      audio.src = src;
      audio.load();
    } else {
      audio.removeAttribute("src");
      audio.load();
    }
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setReady(true);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(audio.duration || 0);
    };
    const onError = () => {
      if (audio.currentSrc)
        setError(
          "No se ha podido cargar el audio. ¿Formato soportado por el navegador?",
        );
    };
    const onSeeked = () => setCurrentTime(audio.currentTime);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("durationchange", onLoaded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("seeked", onSeeked);
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("durationchange", onLoaded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("seeked", onSeeked);
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isPlaying) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    const tick = () => {
      setCurrentTime(audio.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
      }
    };
  }, []);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.currentSrc) return;
    void audio
      .play()
      .catch(() => setError("El navegador ha bloqueado la reproducción."));
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.currentSrc) return;
    if (audio.paused) play();
    else audio.pause();
  }, [play]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const max =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : time;
    const next = clamp(time, 0, max);
    audio.currentTime = next;
    setCurrentTime(next);
  }, []);

  const skip = useCallback(
    (delta: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      seek(audio.currentTime + delta);
    },
    [seek],
  );

  const setVolume = useCallback((v: number) => {
    setVolumeState(clamp(v, 0, 1));
    if (v > 0) setMuted(false);
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);
  const setRate = useCallback(
    (r: number) => setRateState(clamp(r, 0.25, 3)),
    [],
  );

  return useMemo(
    () => ({
      isPlaying,
      currentTime,
      duration,
      volume,
      muted,
      rate,
      ready,
      error,
      play,
      pause,
      toggle,
      seek,
      skip,
      setVolume,
      toggleMute,
      setRate,
    }),
    [
      isPlaying,
      currentTime,
      duration,
      volume,
      muted,
      rate,
      ready,
      error,
      play,
      pause,
      toggle,
      seek,
      skip,
      setVolume,
      toggleMute,
      setRate,
    ],
  );
}
