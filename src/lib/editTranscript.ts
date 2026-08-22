import type { Cue, Scene, Transcript } from "../types";
import { buildSpeakers } from "./parseMarkdown";
import { estimateWords, normalizeKey } from "./text";

let newCueSeq = 0;

export interface CuePatch {
  start?: number;
  end?: number;
  speaker?: string | null;
  text?: string;
  kind?: Cue["kind"];
}

function cloneCue(cue: Cue): Cue {
  return { ...cue, words: cue.words.map((w) => ({ ...w })) };
}

export function rebuildTranscript(base: Transcript, cues: Cue[]): Transcript {
  const next = cues
    .map(cloneCue)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  next.forEach((cue, i) => {
    cue.index = i;
  });

  const scenes: Scene[] = base.scenes.map((scene) => ({
    ...scene,
    cueIds: [],
    start: Infinity,
    end: 0,
  }));
  const byId = new Map(scenes.map((s) => [s.id, s]));
  for (const cue of next) {
    if (!cue.sceneId) continue;
    const scene = byId.get(cue.sceneId);
    if (!scene) continue;
    scene.cueIds.push(cue.id);
    scene.start = Math.min(scene.start, cue.start);
    scene.end = Math.max(scene.end, cue.end);
  }
  const usedScenes = scenes
    .filter((s) => s.cueIds.length > 0)
    .map((s) => (Number.isFinite(s.start) ? s : { ...s, start: 0 }))
    .sort((a, b) => a.start - b.start);

  return {
    ...base,
    cues: next,
    scenes: usedScenes,
    speakers: buildSpeakers(next),
  };
}

export function updateCue(
  transcript: Transcript,
  id: string,
  patch: CuePatch,
): Transcript {
  const cues = transcript.cues.map((cue) => {
    if (cue.id !== id) return cue;
    const start = patch.start ?? cue.start;
    const rawEnd = patch.end ?? cue.end;
    const end = rawEnd > start ? rawEnd : start + 0.5;
    const text = patch.text ?? cue.text;
    const speaker = patch.speaker !== undefined ? patch.speaker : cue.speaker;
    const kind =
      patch.kind ??
      (speaker ? "dialogue" : cue.kind === "dialogue" ? "caption" : cue.kind);
    return {
      ...cue,
      start,
      end,
      speaker: speaker && speaker.trim() ? speaker.trim() : null,
      speakerKey: speaker && speaker.trim() ? normalizeKey(speaker) : null,
      text,
      kind,
      words: estimateWords(text, start, end),
    };
  });
  return rebuildTranscript(transcript, cues);
}

export function deleteCue(transcript: Transcript, id: string): Transcript {
  return rebuildTranscript(
    transcript,
    transcript.cues.filter((cue) => cue.id !== id),
  );
}

export function insertCueAfter(
  transcript: Transcript,
  afterId: string | null,
  atTime?: number,
): { transcript: Transcript; id: string } {
  const cues = transcript.cues;
  const index = afterId ? cues.findIndex((c) => c.id === afterId) : -1;
  const prev = index >= 0 ? cues[index] : null;
  const following = cues[index + 1] ?? null;

  const start = atTime ?? (prev ? prev.end + 0.1 : 0);
  const roomEnd = following ? following.start - 0.1 : start + 3;
  const end = roomEnd > start + 0.4 ? Math.min(roomEnd, start + 3) : start + 1;

  const id = `cue-new-${newCueSeq++}`;
  const text = "Texto nuevo";
  const speaker = prev?.speaker ?? transcript.speakers[0]?.name ?? null;

  const cue: Cue = {
    id,
    index: 0,
    start,
    end,
    speaker,
    speakerKey: speaker ? normalizeKey(speaker) : null,
    text,
    kind: speaker ? "dialogue" : "caption",
    sceneId: prev?.sceneId ?? following?.sceneId ?? null,
    words: estimateWords(text, start, end),
  };

  return { transcript: rebuildTranscript(transcript, [...cues, cue]), id };
}
