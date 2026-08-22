import { useRef } from "react";
import { AudioLines, FileText, Headphones } from "lucide-react";
import { DUR, enter, reduced, useGSAP } from "../lib/motion";

interface Props {
  onFiles: (files: File[]) => void;
  audioName: string | null;
  transcriptName: string | null;
  error: string | null;
}

export function DropZone({ onFiles, audioName, transcriptName, error }: Props) {
  const audioInput = useRef<HTMLInputElement | null>(null);
  const textInput = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () =>
      reduced(() => {
        enter('[data-anim="drop-card"]', { y: 18 }, { duration: DUR.slow });
        enter(
          '[data-anim="drop-slot"]',
          { y: 10 },
          { stagger: 0.08, delay: 0.15 },
        );
      }),
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="grid flex-1 place-items-center p-4 sm:p-6">
      <div
        data-anim="drop-card"
        className="card card-pad w-full max-w-xl text-center"
      >
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-rose-500/12">
          <AudioLines className="size-5 text-accent" />
        </span>
        <h1 className="text-2xl font-medium text-ink">SoundViewer</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Arrastra aquí la transcripción y el audio. El texto se irá resaltando
          al ritmo de la reproducción sobre la onda del archivo.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Slot
            icon={<FileText className="size-4" />}
            label="Transcripción"
            hint={transcriptName ?? ".md o .json de Whisper"}
            filled={!!transcriptName}
            onClick={() => textInput.current?.click()}
          />
          <Slot
            icon={<Headphones className="size-4" />}
            label="Audio"
            hint={audioName ?? "mp3, wav, m4a, ogg…"}
            filled={!!audioName}
            onClick={() => audioInput.current?.click()}
          />
        </div>

        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

        <input
          ref={textInput}
          type="file"
          accept=".md,.markdown,.txt,.json"
          hidden
          onChange={(e) => {
            onFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <input
          ref={audioInput}
          type="file"
          accept="audio/*,video/*"
          hidden
          onChange={(e) => {
            onFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function Slot({
  icon,
  label,
  hint,
  filled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  filled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-anim="drop-slot"
      className={`grid gap-1 rounded-2xl border border-dashed p-5 text-left transition-colors ${
        filled
          ? "border-solid border-rose-400/45 bg-rose-500/8"
          : "border-hairline hover:border-rose-400/50 hover:bg-ink/4"
      }`}
    >
      <span
        className={`flex items-center gap-2 text-sm font-medium ${filled ? "text-accent" : "text-ink"}`}
      >
        {icon}
        {label}
      </span>
      <span className="truncate text-xs text-faint">{hint}</span>
    </button>
  );
}
