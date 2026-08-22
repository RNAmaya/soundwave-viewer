import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Cue, Scene } from "../types";
import type { Region } from "../lib/silence";
import { resamplePeaks } from "../lib/peaks";
import { clamp, findCueIndexAt, formatTime } from "../lib/time";
import { readThemeColor, withAlpha } from "../lib/colors";

interface Props {
  peaks: Float32Array | null;
  duration: number;
  currentTime: number;
  cues: Cue[];
  scenes: Scene[];
  silences: Region[];
  colorOf: (cue: Cue) => string;
  offset: number;
  loading: boolean;
  theme: string;
  onSeek: (time: number) => void;
}

const BAR_WIDTH = 3;
const BAR_GAP = 2;
const TOP_PAD = 18;
const BOTTOM_PAD = 40;
const RULER_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800];

function rulerStep(duration: number, width: number): number {
  const target = (duration / Math.max(1, width)) * 80;
  return (
    RULER_STEPS.find((s) => s >= target) ?? RULER_STEPS[RULER_STEPS.length - 1]
  );
}

export function Waveform({
  peaks,
  duration,
  currentTime,
  cues,
  scenes,
  silences,
  colorOf,
  offset,
  loading,
  theme,
  onSeek,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const litRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 190 });
  const [hoverX, setHoverX] = useState<number | null>(null);
  const draggingRef = useRef(false);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(120, Math.floor(rect.height)),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dpr =
    typeof window !== "undefined"
      ? Math.min(2, window.devicePixelRatio || 1)
      : 1;
  const { width, height } = size;

  useEffect(() => {
    if (!peaks || width === 0) return;
    const bars = Math.max(1, Math.floor(width / (BAR_WIDTH + BAR_GAP)));
    const values = resamplePeaks(peaks, bars);
    const usable = height - TOP_PAD - BOTTOM_PAD;
    const center = TOP_PAD + usable / 2;
    const maxBar = usable / 2;
    const accent = readThemeColor("--canvas-accent", "#fb7185");
    const muted = readThemeColor("--canvas-muted", "#6b5d65");

    const make = (lit: boolean) => {
      const c = document.createElement("canvas");
      c.width = Math.floor(width * dpr);
      c.height = Math.floor(height * dpr);
      const ctx = c.getContext("2d");
      if (!ctx) return c;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = lit ? accent : withAlpha(muted, 0.45);

      for (let i = 0; i < bars; i++) {
        const x = i * (BAR_WIDTH + BAR_GAP);
        const amp = Math.pow(values[i], 0.72);
        const h = Math.max(1.5, amp * maxBar);
        ctx.beginPath();
        if (typeof ctx.roundRect === "function")
          ctx.roundRect(x, center - h, BAR_WIDTH, h * 2, BAR_WIDTH / 2);
        else ctx.rect(x, center - h, BAR_WIDTH, h * 2);
        ctx.fill();
      }
      return c;
    };

    baseRef.current = make(false);
    litRef.current = make(true);
  }, [peaks, width, height, dpr, theme]);

  const timeToX = useCallback(
    (t: number) => (duration > 0 ? (t / duration) * width : 0),
    [duration, width],
  );
  const xToTime = useCallback(
    (x: number) => (width > 0 ? (clamp(x, 0, width) / width) * duration : 0),
    [duration, width],
  );

  const activeCue = useMemo(() => {
    const t = currentTime - offset;
    const i = findCueIndexAt(cues, t);
    if (i < 0) return null;
    const cue = cues[i];
    return t <= cue.end ? cue : null;
  }, [cues, currentTime, offset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = Math.floor(width * dpr);
    const h = Math.floor(height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const muted = readThemeColor("--canvas-muted", "#6b5d65");
    const ink = readThemeColor("--canvas-ink", "#efe6ea");
    const usable = height - TOP_PAD - BOTTOM_PAD;
    const center = TOP_PAD + usable / 2;

    for (const region of silences) {
      const x1 = timeToX(region.start);
      const x2 = timeToX(region.end);
      ctx.fillStyle = withAlpha(muted, 0.1);
      ctx.fillRect(x1, TOP_PAD - 8, Math.max(1, x2 - x1), usable + 16);
    }

    ctx.strokeStyle = withAlpha(muted, 0.25);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, center + 0.5);
    ctx.lineTo(width, center + 0.5);
    ctx.stroke();

    if (activeCue && duration > 0) {
      const x1 = timeToX(activeCue.start + offset);
      const x2 = timeToX(activeCue.end + offset);
      const color = colorOf(activeCue);
      ctx.fillStyle = withAlpha(color, 0.12);
      ctx.fillRect(x1, TOP_PAD - 8, Math.max(2, x2 - x1), usable + 16);
      ctx.fillStyle = withAlpha(color, 0.7);
      ctx.fillRect(x1, height - BOTTOM_PAD + 2, Math.max(2, x2 - x1), 3);
    }

    const base = baseRef.current;
    const lit = litRef.current;
    const progressX = timeToX(currentTime);

    if (base) ctx.drawImage(base, 0, 0, width, height);
    if (lit && progressX > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, progressX, height);
      ctx.clip();
      ctx.drawImage(lit, 0, 0, width, height);
      ctx.restore();
    }

    const markerY = height - BOTTOM_PAD + 10;
    for (const cue of cues) {
      const x = timeToX(cue.start + offset);
      if (x < 0 || x > width) continue;
      ctx.fillStyle = withAlpha(colorOf(cue), cue === activeCue ? 0.95 : 0.45);
      ctx.fillRect(x, markerY, 2, cue === activeCue ? 7 : 4);
    }

    for (const scene of scenes) {
      const x = timeToX(scene.start + offset);
      if (x < 0 || x > width) continue;
      ctx.fillStyle = withAlpha(ink, 0.35);
      ctx.fillRect(x, 4, 1, 10);
    }

    if (duration > 0) {
      const step = rulerStep(duration, width);
      const baseY = height - 16;
      ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
      ctx.textBaseline = "top";
      for (let t = 0; t <= duration + 0.001; t += step) {
        const x = timeToX(t);
        if (x > width) break;
        const major = true;
        ctx.fillStyle = withAlpha(muted, major ? 0.55 : 0.3);
        ctx.fillRect(Math.min(width - 1, x), baseY - 6, 1, 5);
        const label = formatTime(t);
        const w = ctx.measureText(label).width;
        const lx = Math.min(Math.max(x - w / 2, 2), width - w - 2);
        ctx.fillStyle = withAlpha(muted, 0.85);
        ctx.fillText(label, lx, baseY);
      }
      ctx.fillStyle = withAlpha(muted, 0.28);
      for (let t = step / 2; t <= duration; t += step) {
        const x = timeToX(t);
        if (x > width) break;
        ctx.fillRect(Math.min(width - 1, x), baseY - 4, 1, 3);
      }
    }

    if (duration > 0) {
      ctx.fillStyle = ink;
      ctx.fillRect(progressX - 1, TOP_PAD - 10, 2, usable + 20);
      ctx.beginPath();
      ctx.arc(progressX, TOP_PAD - 10, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (hoverX !== null) {
      ctx.strokeStyle = withAlpha(muted, 0.5);
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(hoverX + 0.5, 0);
      ctx.lineTo(hoverX + 0.5, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [
    width,
    height,
    dpr,
    currentTime,
    duration,
    cues,
    scenes,
    silences,
    activeCue,
    hoverX,
    offset,
    colorOf,
    timeToX,
    theme,
  ]);

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      onSeek(xToTime(clientX - rect.left));
    },
    [onSeek, xToTime],
  );

  const silentAudio = useMemo(() => {
    if (!peaks || peaks.length === 0) return false;
    let max = 0;
    for (let i = 0; i < peaks.length; i++) if (peaks[i] > max) max = peaks[i];
    return max < 0.02;
  }, [peaks]);

  const hoverInfo = useMemo(() => {
    if (hoverX === null || duration === 0) return null;
    const time = xToTime(hoverX);
    const i = findCueIndexAt(cues, time - offset);
    const cue = i >= 0 && time - offset <= cues[i].end ? cues[i] : null;
    return { time, cue };
  }, [hoverX, duration, xToTime, cues, offset]);

  return (
    <div
      ref={wrapRef}
      data-anim="card"
      className="card relative h-40 shrink-0 overflow-hidden sm:h-44 lg:h-51"
    >
      <canvas
        ref={canvasRef}
        className="block size-full cursor-pointer touch-none"
        onPointerDown={(e) => {
          draggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromEvent(e.clientX);
        }}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHoverX(e.clientX - rect.left);
          if (draggingRef.current) seekFromEvent(e.clientX);
        }}
        onPointerUp={(e) => {
          draggingRef.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerLeave={() => {
          draggingRef.current = false;
          setHoverX(null);
        }}
      />

      {hoverInfo && (
        <div
          className="pointer-events-none absolute bottom-2 flex max-w-105 -translate-x-1/2 items-center gap-2 truncate rounded-full border border-hairline bg-surface px-3 py-1 text-xs"
          style={{
            left: clamp(timeToX(hoverInfo.time), 80, Math.max(80, width - 80)),
          }}
        >
          <span className="tabular-nums text-accent">
            {formatTime(hoverInfo.time)}
          </span>
          {hoverInfo.cue && (
            <span className="truncate text-muted">
              {hoverInfo.cue.speaker ? `${hoverInfo.cue.speaker}: ` : ""}
              {hoverInfo.cue.text.replace(/\*/g, "").slice(0, 70)}
            </span>
          )}
        </div>
      )}

      {!loading && peaks && silentAudio && (
        <div className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-fit rounded-full bg-elevated px-3 py-1 text-xs text-muted">
          El audio decodificado no tiene señal audible
        </div>
      )}

      {(loading || !peaks) && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted">
          {loading
            ? "Analizando la onda del audio…"
            : "Carga un audio para ver su onda"}
        </div>
      )}
    </div>
  );
}
