import { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import { DUR, enter, reduced, useGSAP } from "../lib/motion";

export interface PlaybackSettings {
  pauseBetweenScenes: boolean;
  pauseOnSilence: boolean;
  minSilence: number;
}

export const DEFAULT_SETTINGS: PlaybackSettings = {
  pauseBetweenScenes: false,
  pauseOnSilence: false,
  minSilence: 0.8,
};

interface Props {
  settings: PlaybackSettings;
  onChange: (settings: PlaybackSettings) => void;
  silenceCount: number;
}

export function SettingsMenu({ settings, onChange, silenceCount }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () =>
      reduced(() => {
        if (!open || !panelRef.current) return;
        enter(
          panelRef.current,
          { y: -8, scale: 0.97 },
          { duration: DUR.quick },
        );
      }),
    { dependencies: [open], scope: wrapRef },
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = settings.pauseBetweenScenes || settings.pauseOnSilence;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        className="btn-icon relative"
        onClick={() => setOpen((v) => !v)}
        title="Ajustes de reproducción"
        aria-expanded={open}
      >
        <Settings2 className="size-4" />
        {active && (
          <span className="absolute top-1 right-1 size-1.5 rounded-full bg-accent" />
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="card absolute top-11 right-0 z-50 w-[min(20rem,calc(100vw-2rem))] origin-top-right p-4 shadow-xl"
        >
          <p className="section-title mb-3">Pausa automática</p>

          <Toggle
            label="Entre escenas"
            hint="Se detiene al terminar cada escena de la transcripción."
            checked={settings.pauseBetweenScenes}
            onChange={(v) => onChange({ ...settings, pauseBetweenScenes: v })}
          />

          <Toggle
            label="En los silencios"
            hint={
              silenceCount > 0
                ? `Se detiene al entrar en un tramo sin sonido (${silenceCount} detectados).`
                : "Se detiene al entrar en un tramo sin sonido del audio."
            }
            checked={settings.pauseOnSilence}
            onChange={(v) => onChange({ ...settings, pauseOnSilence: v })}
          />

          <label className="mt-3 flex items-center justify-between gap-3 text-sm text-muted">
            <span>Silencio mínimo</span>
            <span className="flex items-center gap-1.5">
              <input
                type="number"
                min={0.2}
                max={10}
                step={0.1}
                value={settings.minSilence}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    minSilence: Number(e.target.value) || 0.2,
                  })
                }
                className="lintted-input w-20 px-3 py-1.5 text-right"
              />
              <span className="text-xs text-faint">s</span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-ink/4"
    >
      <span
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          checked ? "bg-accent" : "bg-ink/15"
        }`}
      >
        <span
          className={`size-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-ink">{label}</span>
        <span className="block text-xs text-faint">{hint}</span>
      </span>
    </button>
  );
}
