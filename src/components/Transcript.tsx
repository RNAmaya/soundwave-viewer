import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ListVideo, Pencil, Plus, Search } from "lucide-react";
import type { Cue, Scene, Transcript as TranscriptData } from "../types";
import type { CuePatch } from "../lib/editTranscript";
import { formatTime } from "../lib/time";
import { DUR, enter, reduced, useGSAP } from "../lib/motion";
import { normalizeKey, plainText } from "../lib/text";
import { CueEditor } from "./CueEditor";
import { CueRow } from "./CueRow";

interface Props {
  transcript: TranscriptData;
  activeCueId: string | null;
  time: number;
  colorOf: (cue: Cue) => string;
  hiddenSpeakers: Set<string>;
  onSeekToCue: (cue: Cue) => void;
  onUpdateCue: (id: string, patch: CuePatch) => void;
  onDeleteCue: (id: string) => void;
  onInsertCue: (afterId: string | null) => string;
  onExport: () => void;
}

export function Transcript({
  transcript,
  activeCueId,
  time,
  colorOf,
  hiddenSpeakers,
  onSeekToCue,
  onUpdateCue,
  onDeleteCue,
  onInsertCue,
  onExport,
}: Props) {
  const [query, setQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLDivElement | null>(null);
  const programmaticScroll = useRef(false);

  const normalizedQuery = normalizeKey(query);

  useGSAP(
    () =>
      reduced(() => {
        if (!activeRef.current) return;
        enter(
          activeRef.current,
          { x: -8, opacity: 0.55 },
          { duration: DUR.quick },
        );
      }),
    { dependencies: [activeCueId], scope: listRef },
  );

  useGSAP(
    () =>
      reduced(() => {
        enter("[data-cue]", { y: 10 }, { stagger: 0.012 });
      }),
    { dependencies: [transcript, normalizedQuery], scope: listRef },
  );
  const speakerNames = useMemo(
    () => transcript.speakers.map((s) => s.name),
    [transcript.speakers],
  );

  const groups = useMemo(() => {
    const visible = transcript.cues.filter((cue) => {
      if (cue.speakerKey && hiddenSpeakers.has(cue.speakerKey)) return false;
      if (!normalizedQuery) return true;
      const haystack = normalizeKey(
        `${cue.speaker ?? ""} ${plainText(cue.text)}`,
      );
      return haystack.includes(normalizedQuery);
    });

    if (transcript.scenes.length === 0)
      return [{ scene: null as Scene | null, cues: visible }];

    const byScene = new Map<string, Cue[]>();
    const loose: Cue[] = [];
    for (const cue of visible) {
      if (!cue.sceneId) {
        loose.push(cue);
        continue;
      }
      const list = byScene.get(cue.sceneId);
      if (list) list.push(cue);
      else byScene.set(cue.sceneId, [cue]);
    }
    const result: { scene: Scene | null; cues: Cue[] }[] = [];
    if (loose.length > 0) result.push({ scene: null, cues: loose });
    for (const scene of transcript.scenes) {
      const list = byScene.get(scene.id);
      if (list && list.length > 0) result.push({ scene, cues: list });
    }
    return result;
  }, [transcript, hiddenSpeakers, normalizedQuery]);

  const matchCount = useMemo(
    () => groups.reduce((sum, g) => sum + g.cues.length, 0),
    [groups],
  );

  useEffect(() => {
    if (!autoScroll || editingId || !activeRef.current) return;
    programmaticScroll.current = true;
    activeRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    const id = window.setTimeout(() => {
      programmaticScroll.current = false;
    }, 700);
    return () => window.clearTimeout(id);
  }, [activeCueId, autoScroll, editingId]);

  return (
    <section
      data-anim="card"
      className="card flex min-h-0 min-w-0 flex-col overflow-hidden max-lg:mt-3 max-lg:h-[75vh]"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-hairline p-3">
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
          <input
            id="transcript-search"
            type="search"
            value={query}
            placeholder="Buscar en la transcripción…"
            onChange={(e) => setQuery(e.target.value)}
            className="lintted-input py-2 pr-10 pl-10"
          />
          {query && (
            <span className="absolute top-1/2 right-4 -translate-y-1/2 text-xs tabular-nums text-faint">
              {matchCount}
            </span>
          )}
        </div>

        <button
          type="button"
          className={autoScroll ? "btn-primary btn-xs" : "btn-outline btn-xs"}
          onClick={() => setAutoScroll((v) => !v)}
          title="Seguir automáticamente la línea que suena"
        >
          <ListVideo className="size-3.5" />
          <span className="hidden xl:inline">Autoscroll</span>
        </button>

        <button
          type="button"
          className={editMode ? "btn-primary btn-xs" : "btn-outline btn-xs"}
          onClick={() => {
            setEditMode((v) => !v);
            setEditingId(null);
          }}
          title="Editar la transcripción"
        >
          <Pencil className="size-3.5" />
          <span className="hidden xl:inline">Editar</span>
        </button>

        {editMode && (
          <button
            type="button"
            className="btn-outline btn-xs"
            onClick={onExport}
            title="Descargar el .md actualizado"
          >
            <Download className="size-3.5" />
            <span className="hidden xl:inline">Exportar</span>
          </button>
        )}
      </header>

      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto p-2 pb-8"
        onWheel={() => {
          if (!programmaticScroll.current) setAutoScroll(false);
        }}
        onTouchMove={() => {
          if (!programmaticScroll.current) setAutoScroll(false);
        }}
      >
        {editMode && (
          <button
            type="button"
            className="btn-ghost btn-xs mb-1 w-full justify-start"
            onClick={() => setEditingId(onInsertCue(null))}
          >
            <Plus className="size-3.5" />
            Añadir intervención al principio
          </button>
        )}

        {groups.map((group, gi) => (
          <div key={group.scene?.id ?? `loose-${gi}`}>
            {group.scene && (
              <h3 className="sticky top-0 z-10 mt-3 mb-1 flex items-baseline gap-2 rounded-full bg-surface/95 px-3 py-1.5 text-xs font-medium text-muted backdrop-blur">
                {group.scene.number !== null && (
                  <span className="text-accent">
                    Escena {group.scene.number}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-ink">
                  {group.scene.title}
                </span>
                <span className="tabular-nums text-faint">
                  {formatTime(group.scene.start)}–{formatTime(group.scene.end)}
                </span>
              </h3>
            )}

            {group.cues.map((cue) =>
              editingId === cue.id ? (
                <div key={cue.id} className="my-1">
                  <CueEditor
                    cue={cue}
                    speakerNames={speakerNames}
                    currentTime={time}
                    onSave={(patch) => {
                      onUpdateCue(cue.id, patch);
                      setEditingId(null);
                    }}
                    onCancel={() => setEditingId(null)}
                    onDelete={() => {
                      onDeleteCue(cue.id);
                      setEditingId(null);
                    }}
                  />
                </div>
              ) : (
                <CueRow
                  key={cue.id}
                  cue={cue}
                  isActive={cue.id === activeCueId}
                  color={colorOf(cue)}
                  time={cue.id === activeCueId ? time : 0}
                  editMode={editMode}
                  onSeek={onSeekToCue}
                  onEdit={(c) => setEditingId(c.id)}
                  onInsertAfter={(c) => setEditingId(onInsertCue(c.id))}
                  innerRef={cue.id === activeCueId ? activeRef : undefined}
                />
              ),
            )}
          </div>
        ))}

        {matchCount === 0 && (
          <p className="p-6 text-center text-sm text-muted">
            Sin resultados para «{query}».
          </p>
        )}
      </div>
    </section>
  );
}
