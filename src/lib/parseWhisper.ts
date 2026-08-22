import type { Cue, Transcript, Word } from "../types";
import { estimateWords, normalizeKey } from "./text";
import { buildSpeakers } from "./parseMarkdown";

interface RawSegment {
  start?: number;
  end?: number;
  text?: string;
  speaker?: string;
  timestamp?: [number, number];
  words?: Array<{ word?: string; text?: string; start?: number; end?: number }>;
}

function extractSegments(data: unknown): RawSegment[] {
  if (Array.isArray(data)) return data as RawSegment[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of [
      "segments",
      "chunks",
      "results",
      "transcription",
      "utterances",
    ]) {
      const value = obj[key];
      if (Array.isArray(value)) return value as RawSegment[];
    }
  }
  return [];
}

function segmentTimes(seg: RawSegment): [number, number] | null {
  if (typeof seg.start === "number" && typeof seg.end === "number")
    return [seg.start, seg.end];
  if (Array.isArray(seg.timestamp) && seg.timestamp.length === 2) {
    const [a, b] = seg.timestamp;
    if (typeof a === "number" && typeof b === "number") return [a, b];
  }
  return null;
}

export function parseWhisperTranscript(
  raw: string,
  fileName = "transcripción",
): Transcript {
  const data = JSON.parse(raw);
  const segments = extractSegments(data);
  if (segments.length === 0)
    throw new Error('El JSON no contiene "segments" ni "chunks" con tiempos.');

  const cues: Cue[] = [];
  for (const seg of segments) {
    const times = segmentTimes(seg);
    const text = (seg.text ?? "").trim();
    if (!times || !text) continue;
    const [start, rawEnd] = times;
    const end = rawEnd > start ? rawEnd : start + 1.2;

    let words: Word[] = [];
    if (Array.isArray(seg.words) && seg.words.length > 0) {
      words = seg.words
        .map((w) => ({
          text: (w.word ?? w.text ?? "").trim(),
          start: typeof w.start === "number" ? w.start : start,
          end: typeof w.end === "number" ? w.end : end,
          estimated: false,
        }))
        .filter((w) => w.text.length > 0);
    }
    if (words.length === 0) words = estimateWords(text, start, end);

    const speaker =
      typeof seg.speaker === "string" && seg.speaker.trim()
        ? seg.speaker.trim()
        : null;
    cues.push({
      id: `cue-${cues.length}`,
      index: cues.length,
      start,
      end,
      speaker,
      speakerKey: speaker ? normalizeKey(speaker) : null,
      text,
      kind: "dialogue",
      sceneId: null,
      words,
    });
  }

  cues.sort((a, b) => a.start - b.start);
  cues.forEach((c, i) => {
    c.index = i;
  });

  const rootTitle =
    !Array.isArray(data) && data && typeof data === "object"
      ? (data as Record<string, unknown>).title
      : null;

  return {
    title: typeof rootTitle === "string" && rootTitle ? rootTitle : fileName,
    format: "whisper",
    headerLines: [],
    scenes: [],
    cues,
    speakers: buildSpeakers(cues),
  };
}
