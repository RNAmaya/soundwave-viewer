import { useMemo, useRef } from "react";
import { Eye, EyeOff, Users } from "lucide-react";
import type { Cue, Speaker } from "../types";
import { formatTime } from "../lib/time";
import { withAlpha } from "../lib/colors";
import { enter, reduced, useGSAP } from "../lib/motion";
import { SpeakerMark } from "./SpeakerMark";

interface Props {
  speakers: Speaker[];
  cues: Cue[];
  time: number;
  activeKey: string | null;
  nextKey: string | null;
  hidden: Set<string>;
  onToggle: (key: string) => void;
  onJump: (cue: Cue) => void;
}

export function CastTable({
  speakers,
  cues,
  time,
  activeKey,
  nextKey,
  hidden,
  onToggle,
  onJump,
}: Props) {
  const rootRef = useRef<HTMLElement | null>(null);
  const second = Math.floor(time);

  const rows = useMemo(() => {
    return speakers.map((speaker) => {
      const next =
        cues.find((c) => c.speakerKey === speaker.key && c.start > second) ??
        null;
      const first = cues.find((c) => c.speakerKey === speaker.key) ?? null;
      return { speaker, next, target: next ?? first };
    });
  }, [speakers, cues, second]);

  useGSAP(
    () =>
      reduced(() => {
        enter('[data-anim="cast-row"]', { y: 8 }, { stagger: 0.02 });
      }),
    { dependencies: [speakers.length], scope: rootRef },
  );

  if (speakers.length === 0) return null;

  return (
    <section
      ref={rootRef}
      data-anim="card"
      className="card flex min-h-0 flex-col overflow-hidden max-lg:max-h-80 lg:min-h-40"
    >
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <p className="section-title flex items-center gap-2">
          <Users className="size-4 text-faint" />
          Reparto
        </p>
        <span className="truncate text-xs text-faint">
          {speakers.length} personajes · {cues.length} intervenciones
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        <table className="lt-table">
          <thead>
            <tr>
              <th className="w-8"></th>
              <th>Personaje</th>
              <th className="text-right">Interv.</th>
              <th className="hidden text-right sm:table-cell">Palabras</th>
              <th className="hidden text-right sm:table-cell">En pantalla</th>
              <th className="text-right">Próxima</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ speaker, next, target }) => {
              const off = hidden.has(speaker.key);
              const isNow = activeKey === speaker.key;
              const isNext = !isNow && nextKey === speaker.key;
              return (
                <tr
                  key={speaker.key}
                  data-anim="cast-row"
                  className={`group transition-colors hover:bg-ink/4 ${off ? "opacity-45" : ""}`}
                  style={
                    isNow
                      ? {
                          backgroundImage: `linear-gradient(90deg, ${withAlpha(speaker.color, 0.16)} 0%, transparent 70%)`,
                        }
                      : undefined
                  }
                >
                  <td className="pl-3">
                    <button
                      type="button"
                      onClick={() => onToggle(speaker.key)}
                      title={
                        off
                          ? "Mostrar en la transcripción"
                          : "Ocultar de la transcripción"
                      }
                      className="text-faint transition-colors hover:text-ink"
                    >
                      {off ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </button>
                  </td>

                  <td>
                    <button
                      type="button"
                      onClick={() => target && onJump(target)}
                      className="flex w-full items-center gap-2 text-left"
                      title={
                        target ? `Ir a ${formatTime(target.start)}` : undefined
                      }
                    >
                      <SpeakerMark color={speaker.color} />
                      <span
                        className="truncate text-ink group-hover:text-accent"
                        style={isNow ? { color: speaker.color } : undefined}
                      >
                        {speaker.name}
                      </span>
                      {isNow && <span className="pill pill-accent">Ahora</span>}
                      {isNext && <span className="pill pill-soft">Sigue</span>}
                    </button>
                  </td>

                  <td className="text-right tabular-nums">{speaker.cues}</td>
                  <td className="hidden text-right tabular-nums sm:table-cell">
                    {speaker.words}
                  </td>
                  <td className="hidden text-right tabular-nums sm:table-cell">
                    {speaker.seconds}s
                  </td>
                  <td className="text-right tabular-nums">
                    {next ? (
                      <span className={isNext ? "text-accent" : undefined}>
                        {formatTime(next.start)}
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
