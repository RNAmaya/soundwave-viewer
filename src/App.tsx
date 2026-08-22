import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  CircleAlert,
  FilePlus2,
  FileText,
  Headphones,
  Moon,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { CastTable } from "./components/CastTable";
import { Controls } from "./components/Controls";
import { DropZone } from "./components/DropZone";
import { NowPlaying } from "./components/NowPlaying";
import {
  SettingsMenu,
  DEFAULT_SETTINGS,
  type PlaybackSettings,
} from "./components/SettingsMenu";
import { Transcript } from "./components/Transcript";
import { Waveform } from "./components/Waveform";
import { useAudioEngine } from "./hooks/useAudioEngine";
import { useTheme } from "./hooks/useTheme";
import { CAPTION_COLOR } from "./lib/colors";
import { DUR, enter, reduced, useGSAP } from "./lib/motion";
import {
  deleteCue,
  insertCueAfter,
  updateCue,
  type CuePatch,
} from "./lib/editTranscript";
import {
  isAudioFile,
  isTranscriptFile,
  parseTranscript,
} from "./lib/parseTranscript";
import { computeWaveform, type WaveformData } from "./lib/peaks";
import { downloadMarkdown, serializeMarkdown } from "./lib/serializeMarkdown";
import {
  crossedRegionStart,
  detectSilences,
  DEFAULT_SILENCE,
} from "./lib/silence";
import { clearSession, loadSession, saveSession } from "./lib/storage";
import { findCueIndexAt } from "./lib/time";
import type { Cue, Transcript as TranscriptData } from "./types";

const SETTINGS_KEY = "soundviewer-settings";

function readSettings(): PlaybackSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return {
      ...DEFAULT_SETTINGS,
      ...(JSON.parse(raw) as Partial<PlaybackSettings>),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function App() {
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [transcriptName, setTranscriptName] = useState<string | null>(null);
  const [wave, setWave] = useState<WaveformData | null>(null);
  const [waveLoading, setWaveLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hiddenSpeakers, setHiddenSpeakers] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<PlaybackSettings>(readSettings);
  const [pauseNotice, setPauseNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [restored, setRestored] = useState(false);

  const engine = useAudioEngine(audioUrl);
  const { theme, toggle: toggleTheme } = useTheme();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const veilRef = useRef<HTMLDivElement | null>(null);
  const dragDepth = useRef(0);
  const prevTimeRef = useRef(0);
  const noticeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!audioBlob) {
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(audioBlob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioBlob]);

  useEffect(() => {
    if (!audioBlob) {
      setWave(null);
      return;
    }
    let cancelled = false;
    setWaveLoading(true);
    computeWaveform(audioBlob)
      .then((data) => {
        if (!cancelled) setWave(data);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) {
          setWave(null);
          setError(
            "No se ha podido analizar la onda de este audio (formato no decodificable).",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setWaveLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [audioBlob]);

  const applyTranscriptText = useCallback((text: string, name: string) => {
    try {
      const parsed = parseTranscript(text, name);
      setTranscript(parsed);
      setTranscriptText(text);
      setTranscriptName(name);
      setHiddenSpeakers(new Set());
      setError(null);
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se ha podido leer la transcripción.",
      );
      return false;
    }
  }, []);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      let touched = false;
      for (const file of files) {
        if (isTranscriptFile(file)) {
          const text = await file.text();
          if (applyTranscriptText(text, file.name)) touched = true;
        } else if (isAudioFile(file)) {
          setAudioBlob(file);
          setAudioName(file.name);
          setError(null);
          touched = true;
        }
      }
      if (!touched)
        setError(
          "Formato no reconocido. Usa .md/.json para el texto y mp3/wav/m4a/ogg para el audio.",
        );
    },
    [applyTranscriptText],
  );

  useEffect(() => {
    let cancelled = false;
    loadSession().then((session) => {
      if (cancelled || !session) {
        setRestored(true);
        return;
      }
      if (session.audioBlob) {
        setAudioBlob(session.audioBlob);
        setAudioName(session.audioName);
      }
      if (session.transcriptText && session.transcriptName) {
        applyTranscriptText(session.transcriptText, session.transcriptName);
      }
      setOffset(session.offset ?? 0);
      setRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, [applyTranscriptText]);

  useEffect(() => {
    if (!restored) return;
    if (!audioBlob && !transcriptText) return;
    const id = window.setTimeout(() => {
      void saveSession({
        audioBlob,
        audioName,
        transcriptText,
        transcriptName,
        offset,
        savedAt: Date.now(),
      });
    }, 600);
    return () => window.clearTimeout(id);
  }, [restored, audioBlob, audioName, transcriptText, transcriptName, offset]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const cues = transcript?.cues ?? [];
  const shiftedTime = engine.currentTime - offset;

  const silences = useMemo(
    () =>
      detectSilences(wave?.peaks ?? null, wave?.duration ?? 0, {
        ...DEFAULT_SILENCE,
        minDuration: settings.minSilence,
      }),
    [wave, settings.minSilence],
  );

  const activeIndex = useMemo(() => {
    const i = findCueIndexAt(cues, shiftedTime);
    if (i < 0) return -1;
    return shiftedTime <= cues[i].end ? i : -1;
  }, [cues, shiftedTime]);

  const activeCue = activeIndex >= 0 ? cues[activeIndex] : null;
  const nextCue = useMemo(
    () => cues.find((c) => c.start > shiftedTime) ?? null,
    [cues, shiftedTime],
  );
  const activeScene = useMemo(() => {
    if (!transcript || !activeCue?.sceneId) return null;
    return transcript.scenes.find((s) => s.id === activeCue.sceneId) ?? null;
  }, [transcript, activeCue]);

  const speakerColors = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of transcript?.speakers ?? []) map.set(s.key, s.color);
    return map;
  }, [transcript]);

  const colorOf = useCallback(
    (cue: Cue) =>
      cue.speakerKey
        ? (speakerColors.get(cue.speakerKey) ?? CAPTION_COLOR)
        : CAPTION_COLOR,
    [speakerColors],
  );

  const seekToCue = useCallback(
    (cue: Cue) => {
      engine.seek(cue.start + offset);
    },
    [engine, offset],
  );

  const goToCue = useCallback(
    (direction: 1 | -1) => {
      if (cues.length === 0) return;
      const current = findCueIndexAt(cues, shiftedTime);
      const target =
        direction === 1
          ? current + 1
          : current >= 0 && shiftedTime - cues[current].start > 1.2
            ? current
            : current - 1;
      seekToCue(cues[Math.max(0, Math.min(cues.length - 1, target))]);
    },
    [cues, shiftedTime, seekToCue],
  );

  const notice = useCallback((message: string) => {
    setPauseNotice(message);
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setPauseNotice(null), 5000);
  }, []);

  useEffect(() => {
    const t = engine.currentTime;
    const prev = prevTimeRef.current;
    prevTimeRef.current = t;
    if (!engine.isPlaying || t <= prev) return;

    if (settings.pauseBetweenScenes && transcript) {
      for (const scene of transcript.scenes) {
        const boundary = scene.end + offset;
        if (boundary > prev && boundary <= t) {
          engine.pause();
          engine.seek(boundary);
          notice(`Pausa: fin de la escena ${scene.number ?? ""}`.trim());
          return;
        }
      }
    }

    if (settings.pauseOnSilence) {
      const region = crossedRegionStart(silences, prev, t);
      if (region) {
        engine.pause();
        engine.seek(region.start);
        notice("Pausa: tramo sin sonido");
      }
    }
  }, [
    engine,
    engine.currentTime,
    engine.isPlaying,
    settings,
    transcript,
    silences,
    offset,
    notice,
  ]);

  const applyEdit = useCallback((next: TranscriptData) => {
    setTranscript(next);
    setTranscriptText(serializeMarkdown(next));
    setTranscriptName((name) =>
      name ? name.replace(/\.json$/i, ".md") : name,
    );
  }, []);

  const handleUpdateCue = useCallback(
    (id: string, patch: CuePatch) => {
      if (transcript) applyEdit(updateCue(transcript, id, patch));
    },
    [transcript, applyEdit],
  );

  const handleDeleteCue = useCallback(
    (id: string) => {
      if (transcript) applyEdit(deleteCue(transcript, id));
    },
    [transcript, applyEdit],
  );

  const handleInsertCue = useCallback(
    (afterId: string | null) => {
      if (!transcript) return "";
      const { transcript: next, id } = insertCueAfter(
        transcript,
        afterId,
        afterId ? undefined : Math.max(0, shiftedTime),
      );
      applyEdit(next);
      return id;
    },
    [transcript, applyEdit, shiftedTime],
  );

  const handleExport = useCallback(() => {
    if (transcript)
      downloadMarkdown(transcript, transcriptName ?? "transcripcion");
  }, [transcript, transcriptName]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) {
        if (e.key === "Escape") target.blur();
        return;
      }
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          engine.toggle();
          break;
        case "ArrowRight":
          e.preventDefault();
          engine.skip(5);
          break;
        case "ArrowLeft":
          e.preventDefault();
          engine.skip(-5);
          break;
        case "ArrowUp":
          e.preventDefault();
          engine.setVolume(engine.volume + 0.05);
          break;
        case "ArrowDown":
          e.preventDefault();
          engine.setVolume(engine.volume - 0.05);
          break;
        case "l":
          engine.skip(10);
          break;
        case "j":
          engine.skip(-10);
          break;
        case "n":
          goToCue(1);
          break;
        case "p":
          goToCue(-1);
          break;
        case "m":
          engine.toggleMute();
          break;
        case "Home":
          engine.seek(0);
          break;
        case ".":
          engine.setRate(Math.round((engine.rate + 0.25) * 100) / 100);
          break;
        case ",":
          engine.setRate(Math.round((engine.rate - 0.25) * 100) / 100);
          break;
        case "/":
        case "f":
          e.preventDefault();
          document.getElementById("transcript-search")?.focus();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine, goToCue]);

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current += 1;
      setDragOver(true);
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragOver(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragOver(false);
      void handleFiles(Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFiles]);

  const toggleSpeaker = useCallback((key: string) => {
    setHiddenSpeakers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    engine.pause();
    setAudioBlob(null);
    setAudioName(null);
    setTranscript(null);
    setTranscriptText(null);
    setTranscriptName(null);
    setWave(null);
    setOffset(0);
    setHiddenSpeakers(new Set());
    setError(null);
    void clearSession();
  }, [engine]);

  const empty = !transcript && !audioBlob;

  useGSAP(
    () =>
      reduced(() => {
        enter('[data-anim="topbar"]', { y: -12 });
        enter(
          '[data-anim="card"]',
          { y: 18 },
          { duration: DUR.slow, stagger: 0.07, delay: 0.12 },
        );
      }),
    { dependencies: [empty], scope: shellRef },
  );

  useGSAP(
    () =>
      reduced(() => {
        if (!dragOver || !veilRef.current) return;
        enter(veilRef.current, {}, { duration: DUR.quick });
      }),
    { dependencies: [dragOver], scope: shellRef },
  );

  return (
    <div ref={shellRef} className="flex h-full flex-col bg-bg">
      {empty ? (
        <DropZone
          onFiles={(f) => void handleFiles(f)}
          audioName={audioName}
          transcriptName={transcriptName}
          error={error}
        />
      ) : (
        <>
          <header
            data-anim="topbar"
            className="relative z-50 flex w-full shrink-0 items-center justify-between gap-2 border-b border-hairline px-3 py-2.5 sm:gap-3 sm:px-4 md:px-6"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-rose-500/12">
                <AudioLines className="size-4 text-accent" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-base font-medium text-ink sm:text-lg">
                  SoundViewer
                </h1>
                <p className="truncate text-xs text-faint">
                  {transcript?.title ?? "Sin transcripción"}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <FileBadge
                icon={<FileText className="size-3.5" />}
                name={transcriptName}
                missing="falta la transcripción"
              />
              <FileBadge
                icon={<Headphones className="size-3.5" />}
                name={audioName}
                missing="falta el audio"
              />

              <label className="btn-outline btn-xs cursor-pointer max-sm:px-2.5">
                <FilePlus2 className="size-3.5" />
                <span className="hidden sm:inline">Añadir archivos</span>
                <input
                  type="file"
                  multiple
                  accept=".md,.markdown,.txt,.json,audio/*,video/*"
                  hidden
                  onChange={(e) => {
                    void handleFiles(Array.from(e.target.files ?? []));
                    e.target.value = "";
                  }}
                />
              </label>

              <SettingsMenu
                settings={settings}
                onChange={setSettings}
                silenceCount={silences.length}
              />

              <button
                type="button"
                className="btn-icon"
                onClick={toggleTheme}
                title="Cambiar tema"
              >
                {theme === "dark" ? (
                  <Sun className="size-4" />
                ) : (
                  <Moon className="size-4" />
                )}
              </button>

              <button
                type="button"
                className="btn-icon"
                onClick={reset}
                title="Vaciar y empezar de cero"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </header>

          {(error || engine.error) && (
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline bg-rose-500/10 px-4 py-2 text-sm text-rose-400">
              <span className="flex items-center gap-2">
                <CircleAlert className="size-4 shrink-0" />
                {error ?? engine.error}
              </span>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setError(null)}
              >
                <X className="size-4" />
              </button>
            </div>
          )}

          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.9fr)] lg:gap-4 lg:overflow-hidden">
            <section className="flex min-w-0 flex-col gap-3 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
              <NowPlaying
                cue={activeCue}
                nextCue={nextCue}
                scene={activeScene}
                time={shiftedTime}
                color={activeCue ? colorOf(activeCue) : CAPTION_COLOR}
                nextColor={nextCue ? colorOf(nextCue) : CAPTION_COLOR}
                onGoToNext={() => goToCue(1)}
              />

              <Waveform
                peaks={wave?.peaks ?? null}
                duration={
                  engine.duration ||
                  wave?.duration ||
                  transcript?.durationHint ||
                  0
                }
                currentTime={engine.currentTime}
                cues={cues}
                scenes={transcript?.scenes ?? []}
                silences={silences}
                colorOf={colorOf}
                offset={offset}
                loading={waveLoading}
                theme={theme}
                onSeek={engine.seek}
              />

              <Controls
                engine={engine}
                offset={offset}
                onOffsetChange={setOffset}
                onPrevCue={() => goToCue(-1)}
                onNextCue={() => goToCue(1)}
                hasTranscript={cues.length > 0}
                pauseNotice={pauseNotice}
              />

              {transcript && (
                <CastTable
                  speakers={transcript.speakers}
                  cues={cues}
                  time={shiftedTime}
                  activeKey={activeCue?.speakerKey ?? null}
                  nextKey={nextCue?.speakerKey ?? null}
                  hidden={hiddenSpeakers}
                  onToggle={toggleSpeaker}
                  onJump={seekToCue}
                />
              )}

              <p className="hidden flex-wrap items-center gap-x-2 gap-y-1 text-xs text-faint sm:flex">
                <Key>espacio</Key> play <Key>←</Key>
                <Key>→</Key> 5 s <Key>J</Key>
                <Key>L</Key> 10 s <Key>P</Key>
                <Key>N</Key> intervención <Key>↑</Key>
                <Key>↓</Key> volumen <Key>,</Key>
                <Key>.</Key> velocidad <Key>F</Key> buscar
              </p>
            </section>

            {transcript ? (
              <Transcript
                transcript={transcript}
                activeCueId={activeCue?.id ?? null}
                time={shiftedTime}
                colorOf={colorOf}
                hiddenSpeakers={hiddenSpeakers}
                onSeekToCue={seekToCue}
                onUpdateCue={handleUpdateCue}
                onDeleteCue={handleDeleteCue}
                onInsertCue={handleInsertCue}
                onExport={handleExport}
              />
            ) : (
              <section className="card card-pad flex min-w-0 flex-col items-start gap-2">
                <p className="text-sm text-muted">
                  Arrastra una transcripción (.md o .json) para sincronizarla
                  con este audio.
                </p>
              </section>
            )}
          </main>
        </>
      )}

      {dragOver && (
        <div
          ref={veilRef}
          className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-bg/80 backdrop-blur-sm"
        >
          <p className="rounded-full border border-dashed border-rose-400 px-6 py-4 text-sm font-medium text-ink">
            Suelta aquí la transcripción o el audio
          </p>
        </div>
      )}
    </div>
  );
}

function FileBadge({
  icon,
  name,
  missing,
}: {
  icon: React.ReactNode;
  name: string | null;
  missing: string;
}) {
  return (
    <span
      title={name ?? missing}
      className={`pill hidden max-w-47.5 md:inline-flex ${name ? "pill-soft" : "bg-rose-500/12 text-rose-400"}`}
    >
      {icon}
      <span className="truncate">{name ?? missing}</span>
    </span>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-hairline bg-elevated px-1.5 py-0.5 text-[10px] text-muted">
      {children}
    </kbd>
  );
}
