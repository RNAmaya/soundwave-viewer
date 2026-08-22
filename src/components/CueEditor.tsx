import { useEffect, useRef, useState } from "react";
import { Check, Clock, Trash2, X } from "lucide-react";
import type { Cue } from "../types";
import type { CuePatch } from "../lib/editTranscript";
import { formatTimecode, parseTimecode } from "../lib/time";

interface Props {
  cue: Cue;
  speakerNames: string[];
  currentTime: number;
  onSave: (patch: CuePatch) => void;
  onCancel: () => void;
  onDelete: () => void;
}

export function CueEditor({
  cue,
  speakerNames,
  currentTime,
  onSave,
  onCancel,
  onDelete,
}: Props) {
  const [start, setStart] = useState(formatTimecode(cue.start));
  const [end, setEnd] = useState(formatTimecode(cue.end));
  const [speaker, setSpeaker] = useState(cue.speaker ?? "");
  const [text, setText] = useState(cue.text);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const startSeconds = parseTimecode(start);
  const endSeconds = parseTimecode(end);
  const invalid =
    startSeconds === null || endSeconds === null || endSeconds <= startSeconds;

  const save = () => {
    if (invalid) return;
    onSave({
      start: startSeconds,
      end: endSeconds,
      speaker: speaker.trim() ? speaker.trim() : null,
      text: text.trim(),
      kind: speaker.trim()
        ? "dialogue"
        : cue.kind === "dialogue"
          ? "caption"
          : cue.kind,
    });
  };

  return (
    <div
      className="rounded-2xl border border-hairline bg-elevated p-3"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          save();
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <TimeField
          value={start}
          invalid={startSeconds === null}
          onChange={setStart}
          onUseCurrent={() => setStart(formatTimecode(currentTime))}
          label="Inicio"
        />
        <TimeField
          value={end}
          invalid={endSeconds === null || invalid}
          onChange={setEnd}
          onUseCurrent={() => setEnd(formatTimecode(currentTime))}
          label="Fin"
        />
        <input
          list="sv-speaker-names"
          value={speaker}
          onChange={(e) => setSpeaker(e.target.value)}
          placeholder="Personaje (vacío = cartel)"
          className="lintted-input min-w-40 flex-1 bg-surface px-3 py-1.5 text-sm"
        />
        <datalist id="sv-speaker-names">
          {speakerNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      <textarea
        ref={textRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="lintted-input mt-2 resize-y bg-surface px-3 py-2 text-sm leading-relaxed"
      />

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          className="btn-primary btn-xs"
          onClick={save}
          disabled={invalid}
        >
          <Check className="size-3.5" />
          Guardar
        </button>
        <button type="button" className="btn-outline btn-xs" onClick={onCancel}>
          <X className="size-3.5" />
          Cancelar
        </button>
        <button
          type="button"
          className="btn-ghost btn-xs ml-auto text-rose-400 hover:text-rose-500"
          onClick={onDelete}
          title="Eliminar esta intervención"
        >
          <Trash2 className="size-3.5" />
          Eliminar
        </button>
      </div>

      <p className="mt-1.5 text-xs text-faint">
        {invalid
          ? "Revisa los tiempos: el fin debe ir después del inicio (mm:ss)."
          : "Ctrl+Enter guarda · Esc cancela"}
      </p>
    </div>
  );
}

function TimeField({
  value,
  label,
  invalid,
  onChange,
  onUseCurrent,
}: {
  value: string;
  label: string;
  invalid: boolean;
  onChange: (value: string) => void;
  onUseCurrent: () => void;
}) {
  return (
    <span className="flex items-center gap-1">
      <input
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className={`lintted-input w-24 bg-surface px-3 py-1.5 text-center text-sm tabular-nums ${
          invalid ? "border-rose-400! text-rose-400" : ""
        }`}
      />
      <button
        type="button"
        className="btn-icon"
        onClick={onUseCurrent}
        title={`${label} = tiempo actual del audio`}
      >
        <Clock className="size-3.5" />
      </button>
    </span>
  );
}
