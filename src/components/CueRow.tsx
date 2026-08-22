import { memo } from "react";
import type { CSSProperties } from "react";
import { Pencil, Plus } from "lucide-react";
import type { Cue } from "../types";
import { formatTime } from "../lib/time";
import { withAlpha } from "../lib/colors";
import { RichText } from "./RichText";
import { SpeakerMark } from "./SpeakerMark";

interface Props {
  cue: Cue;
  isActive: boolean;
  color: string;
  time: number;
  editMode: boolean;
  onSeek: (cue: Cue) => void;
  onEdit: (cue: Cue) => void;
  onInsertAfter: (cue: Cue) => void;
  innerRef?: React.Ref<HTMLDivElement>;
}

function CueRowBase({
  cue,
  isActive,
  color,
  time,
  editMode,
  onSeek,
  onEdit,
  onInsertAfter,
  innerRef,
}: Props) {
  return (
    <div
      ref={innerRef}
      data-cue={cue.id}
      className={`group relative flex gap-3 rounded-2xl px-2.5 py-2 transition-colors ${
        isActive ? "text-ink" : "cue-idle text-muted hover:bg-ink/4"
      }`}
      style={
        isActive
          ? ({
              "--cue-color": color,
              backgroundImage: `linear-gradient(100deg, ${withAlpha(color, 0.18)} 0%, ${withAlpha(color, 0.06)} 55%, transparent 100%)`,
            } as CSSProperties)
          : ({ "--cue-color": color } as CSSProperties)
      }
    >
      <button
        type="button"
        onClick={() => onSeek(cue)}
        className="shrink-0 pt-0.5 text-xs tabular-nums transition-colors hover:text-accent"
        style={{ color: isActive ? color : undefined }}
        title={`Ir a ${formatTime(cue.start)}`}
      >
        {formatTime(cue.start)}
      </button>

      <button
        type="button"
        onClick={() => onSeek(cue)}
        className="min-w-0 flex-1 text-left"
      >
        <span
          className="flex items-center gap-1.5 text-xs font-medium"
          style={{ color: isActive ? color : undefined }}
        >
          <SpeakerMark color={color} className="h-3" />
          {cue.speaker ?? (cue.kind === "caption" ? "Cartel" : "Nota")}
        </span>
        <span
          className={`block text-sm leading-relaxed ${cue.kind !== "dialogue" ? "italic" : ""}`}
        >
          <RichText words={cue.words} time={time} live={isActive} />
        </span>
      </button>

      {editMode && (
        <span className="flex shrink-0 flex-col items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            className="btn-icon p-1.5"
            onClick={() => onEdit(cue)}
            title="Editar esta intervención"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            className="btn-icon p-1.5"
            onClick={() => onInsertAfter(cue)}
            title="Añadir una intervención después"
          >
            <Plus className="size-3.5" />
          </button>
        </span>
      )}
    </div>
  );
}

export const CueRow = memo(CueRowBase);
