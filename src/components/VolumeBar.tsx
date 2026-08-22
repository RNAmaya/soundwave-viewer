import { useCallback, useRef } from "react";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { clamp } from "../lib/time";

interface Props {
  volume: number;
  muted: boolean;
  onChange: (value: number) => void;
  onToggleMute: () => void;
}

export function VolumeBar({ volume, muted, onChange, onToggleMute }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const level = muted ? 0 : volume;
  const Icon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;

  const setFromEvent = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      onChange(clamp((clientX - rect.left) / rect.width, 0, 1));
    },
    [onChange],
  );

  return (
    <div className="flex h-9 items-center gap-2 rounded-full bg-elevated pr-3 pl-1">
      <button
        type="button"
        onClick={onToggleMute}
        title={muted ? "Quitar silencio (M)" : "Silenciar (M)"}
        className="grid size-7 shrink-0 place-items-center rounded-full bg-surface text-ink transition-colors hover:text-accent"
      >
        <Icon className="size-3.5" />
      </button>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Volumen"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(level * 100)}
        className="relative h-1.5 w-24 cursor-pointer rounded-full bg-ink/12 select-none focus:outline-none focus-visible:ring-[3px] focus-visible:ring-rose-400/25"
        onPointerDown={(e) => {
          draggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromEvent(e.clientX);
        }}
        onPointerMove={(e) => {
          if (draggingRef.current) setFromEvent(e.clientX);
        }}
        onPointerUp={(e) => {
          draggingRef.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            onChange(clamp(level + 0.05, 0, 1));
          }
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            onChange(clamp(level - 0.05, 0, 1));
          }
        }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-ink/70 transition-[width] duration-75"
          style={{ width: `${level * 100}%` }}
        />
        <div
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink shadow-sm transition-[left] duration-75"
          style={{ left: `${level * 100}%` }}
        />
      </div>
    </div>
  );
}
