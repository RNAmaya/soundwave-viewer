import { useRef } from "react";
import {
  FastForward,
  Gauge,
  Pause,
  Play,
  Rewind,
  RotateCcw,
  SkipBack,
  SkipForward,
  Timer,
} from "lucide-react";
import type { AudioEngine } from "../hooks/useAudioEngine";
import { formatTime } from "../lib/time";
import { DUR, enter, gsap, reduced, useGSAP } from "../lib/motion";
import { Select } from "./ui/Select";
import { VolumeBar } from "./VolumeBar";

interface Props {
  engine: AudioEngine;
  offset: number;
  onOffsetChange: (value: number) => void;
  onPrevCue: () => void;
  onNextCue: () => void;
  hasTranscript: boolean;
  pauseNotice: string | null;
}

const RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => ({
  value: String(r),
  label: `${r}×`,
}));

export function Controls({
  engine,
  offset,
  onOffsetChange,
  onPrevCue,
  onNextCue,
  hasTranscript,
  pauseNotice,
}: Props) {
  const { currentTime, duration, isPlaying, rate, volume, muted } = engine;
  const rootRef = useRef<HTMLElement | null>(null);
  const playRef = useRef<HTMLButtonElement | null>(null);
  const noticeRef = useRef<HTMLSpanElement | null>(null);

  useGSAP(
    () =>
      reduced(() => {
        if (!playRef.current) return;
        gsap.fromTo(
          playRef.current,
          { scale: 0.88 },
          {
            scale: 1,
            duration: DUR.base,
            ease: "back.out(2.4)",
            overwrite: "auto",
            clearProps: "transform",
          },
        );
      }),
    { dependencies: [isPlaying], scope: rootRef },
  );

  useGSAP(
    () =>
      reduced(() => {
        if (!noticeRef.current || !pauseNotice) return;
        enter(
          noticeRef.current,
          { y: 6, scale: 0.94 },
          { duration: DUR.quick },
        );
      }),
    { dependencies: [pauseNotice], scope: rootRef },
  );

  return (
    <section
      ref={rootRef}
      data-anim="card"
      className="card relative z-20 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-3 px-3 py-3 sm:px-4"
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn-icon"
          onClick={() => engine.skip(-10)}
          title="Atrás 10 s (J)"
        >
          <Rewind className="size-4" />
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={onPrevCue}
          disabled={!hasTranscript}
          title="Intervención anterior (P)"
        >
          <SkipBack className="size-4" />
        </button>
        <button
          ref={playRef}
          type="button"
          className="btn-primary size-10 rounded-full p-0"
          onClick={engine.toggle}
          title="Reproducir / pausar (espacio)"
        >
          {isPlaying ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4 translate-x-px" />
          )}
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={onNextCue}
          disabled={!hasTranscript}
          title="Intervención siguiente (N)"
        >
          <SkipForward className="size-4" />
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={() => engine.skip(10)}
          title="Adelante 10 s (L)"
        >
          <FastForward className="size-4" />
        </button>
      </div>

      <p className="ml-1 text-sm tabular-nums text-muted">
        <span className="text-ink">{formatTime(currentTime)}</span>
        <span className="mx-1.5 text-faint">/</span>
        {formatTime(duration)}
      </p>

      {pauseNotice && (
        <span ref={noticeRef} className="pill pill-accent">
          {pauseNotice}
        </span>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <VolumeBar
          volume={volume}
          muted={muted}
          onChange={engine.setVolume}
          onToggleMute={engine.toggleMute}
        />

        <Select
          value={String(rate)}
          options={RATE_OPTIONS}
          onChange={(v) => engine.setRate(Number(v))}
          label="Velocidad de reproducción"
          icon={<Gauge className="size-3.5" />}
          className="w-24"
        />

        <label
          className="flex h-9 items-center gap-1.5 rounded-full bg-elevated px-3"
          title="Desplaza los tiempos de la transcripción respecto al audio"
        >
          <Timer className="size-3.5 shrink-0 text-faint" />
          <input
            type="number"
            step={0.1}
            value={Number(offset.toFixed(2))}
            onChange={(e) => onOffsetChange(Number(e.target.value))}
            aria-label="Desfase en segundos"
            className="w-12 bg-transparent text-right text-sm tabular-nums text-ink outline-none"
          />
          <span className="text-xs text-faint">s</span>
          {offset !== 0 && (
            <button
              type="button"
              className="-mr-1.5 btn-icon p-1"
              onClick={() => onOffsetChange(0)}
              title="Volver a 0"
            >
              <RotateCcw className="size-3" />
            </button>
          )}
        </label>
      </div>
    </section>
  );
}
