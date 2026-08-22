import { useRef } from "react";
import type { CSSProperties } from "react";
import { AudioLines, Clapperboard, Pause, ArrowRight } from "lucide-react";
import type { Cue, Scene } from "../types";
import { formatTime } from "../lib/time";
import { withAlpha } from "../lib/colors";
import { DUR, enter, reduced, useGSAP } from "../lib/motion";
import { RichText } from "./RichText";
import { SpeakerMark } from "./SpeakerMark";

interface Props {
  cue: Cue | null;
  nextCue: Cue | null;
  scene: Scene | null;
  time: number;
  color: string;
  nextColor: string;
  onGoToNext: () => void;
}

export function NowPlaying({
  cue,
  nextCue,
  scene,
  time,
  color,
  nextColor,
  onGoToNext,
}: Props) {
  const Icon =
    cue?.kind === "caption" ? Clapperboard : cue ? AudioLines : Pause;
  const rootRef = useRef<HTMLElement | null>(null);

  useGSAP(
    () =>
      reduced(() => {
        enter('[data-anim="cue-body"]', { y: 12 });
      }),
    { dependencies: [cue?.id ?? null], scope: rootRef },
  );

  useGSAP(
    () =>
      reduced(() => {
        enter('[data-anim="next-cue"]', { x: -8 }, { duration: DUR.quick });
      }),
    { dependencies: [nextCue?.id ?? null], scope: rootRef },
  );

  return (
    <section
      ref={rootRef}
      data-anim="card"
      className="card flex shrink-0 flex-col gap-4 p-4 sm:p-5"
      style={{ "--cue-color": color } as CSSProperties}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="grid size-7 shrink-0 place-items-center rounded-full"
            style={{
              backgroundColor: withAlpha(cue ? color : "#a89ba1", 0.14),
            }}
          >
            <Icon
              className="size-3.5"
              style={{ color: cue ? color : undefined }}
            />
          </span>
          <p className="truncate text-sm text-muted">
            {scene ? (
              <>
                {scene.number !== null && (
                  <span className="text-ink">Escena {scene.number} · </span>
                )}
                {scene.title}
              </>
            ) : (
              "En reproducción"
            )}
          </p>
        </div>
        {cue && (
          <span className="shrink-0 text-xs tabular-nums text-faint">
            {formatTime(cue.start)} – {formatTime(cue.end)}
          </span>
        )}
      </div>

      {cue ? (
        <div data-anim="cue-body" className="flex flex-1 flex-col gap-2">
          <p className="text-sm font-medium" style={{ color }}>
            {cue.speaker ??
              (cue.kind === "caption" ? "Cartel en pantalla" : "Sin personaje")}
          </p>
          <p className="flex-1 text-lg leading-relaxed font-medium text-ink sm:text-xl md:text-2xl">
            <RichText words={cue.words} time={time} live />
          </p>
        </div>
      ) : (
        <div data-anim="cue-body" className="flex flex-1 flex-col">
          <p className="text-sm font-medium text-faint">Silencio</p>
          <p className="mt-1.5 flex-1 text-lg leading-relaxed text-muted">
            {nextCue
              ? "Nadie habla ahora mismo."
              : "No hay más intervenciones."}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onGoToNext}
        disabled={!nextCue}
        className="flex items-center gap-2.5 rounded-full border border-hairline px-3.5 py-2.5 text-left text-xs transition-colors hover:bg-ink/4 disabled:opacity-50"
        title={nextCue ? "Ir a la siguiente intervención (N)" : undefined}
      >
        <span className="shrink-0 text-faint">Sigue</span>
        {nextCue ? (
          <span
            data-anim="next-cue"
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <SpeakerMark color={nextColor} className="h-3" />
            <span className="shrink-0 font-medium" style={{ color: nextColor }}>
              {nextCue.speaker ??
                (nextCue.kind === "caption" ? "Cartel" : "Nota")}
            </span>
            <span className="hidden min-w-0 flex-1 truncate text-muted sm:block">
              {nextCue.text.replace(/\*/g, "")}
            </span>
            <span className="ml-auto shrink-0 tabular-nums text-faint sm:ml-0">
              en {formatTime(Math.max(0, nextCue.start - time))}
            </span>
            <ArrowRight className="size-3.5 shrink-0 text-faint" />
          </span>
        ) : (
          <span className="text-muted">fin de la transcripción</span>
        )}
      </button>
    </section>
  );
}
