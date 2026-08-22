import type { Cue, CueKind, Scene, Speaker, Transcript } from "../types";
import { parseTimecode } from "./time";
import {
  countWords,
  estimateWords,
  isNameVariant,
  normalizeKey,
  plainText,
} from "./text";
import { colorForIndex } from "./colors";

const DASH = "[-–—]";
const CUE_RE = new RegExp(
  String.raw`^\[\s*([0-9:.,]+)\s*${DASH}\s*([0-9:.,]+)\s*\]\s*(.*)$`,
);
const SCENE_RE = /^#{2,3}\s+(.*)$/;
const SCENE_NUM_RE = new RegExp(
  String.raw`^ESCENA\s*(\d+)\s*${DASH}\s*(.*)$`,
  "i",
);
const SCENE_RANGE_RE = new RegExp(
  String.raw`\(\s*([0-9:.,]+)\s*${DASH}\s*([0-9:.,]+)\s*\)\s*$`,
);
const CHARACTERS_RE = /^\*\*Personajes:?\*\*\s*(.*)$/i;
const META_RE = /^\*\*([^*]+):?\*\*\s*(.*)$/;
const CAPTION_RE =
  /^\(?\s*(cartel|rótulo|rotulo|acotación|acotacion|nota|texto en pantalla)\s*\)?\s*:?\s*(.*)$/i;
const SPEAKER_RE = /^([^:]{1,44}?)\s*:\s*(.+)$/s;

function stripWrappingAsterisks(s: string): { text: string; wrapped: boolean } {
  const t = s.trim();
  if (
    t.length > 3 &&
    t.startsWith("*") &&
    t.endsWith("*") &&
    !t.slice(1, -1).includes("*")
  ) {
    return { text: t.slice(1, -1).trim(), wrapped: true };
  }
  return { text: t, wrapped: false };
}

function looksLikeSpeaker(name: string): boolean {
  const n = name.trim();
  if (!n) return false;
  if (n.length > 44) return false;
  if (/[.!?¡¿…]/.test(n)) return false;
  if (plainText(n).split(/\s+/).length > 6) return false;
  return true;
}

interface ParsedBody {
  speaker: string | null;
  text: string;
  kind: CueKind;
}

function parseCueBody(rawBody: string): ParsedBody {
  const { text: unwrapped, wrapped } = stripWrappingAsterisks(rawBody);

  const caption = unwrapped.match(CAPTION_RE);
  if (caption) {
    return {
      speaker: null,
      text: caption[2].trim() || unwrapped.trim(),
      kind: "caption",
    };
  }

  const m = unwrapped.match(SPEAKER_RE);
  if (m && looksLikeSpeaker(m[1])) {
    return { speaker: m[1].trim(), text: m[2].trim(), kind: "dialogue" };
  }

  return {
    speaker: null,
    text: unwrapped.trim(),
    kind: wrapped ? "caption" : "note",
  };
}

export function parseMarkdownTranscript(raw: string): Transcript {
  const lines = raw.split(/\r?\n/);

  let title = "";
  let source: string | undefined;
  let durationHint: number | undefined;

  const headerLines: string[] = [];
  const scenes: Scene[] = [];
  const cues: Cue[] = [];
  let currentScene: Scene | null = null;
  let sceneSeq = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("|")) continue;
    if (/^-{3,}$/.test(trimmed)) continue;

    if (!title && /^#\s+/.test(trimmed)) {
      title = trimmed.replace(/^#\s+/, "").trim();
      continue;
    }

    const sceneHeading = trimmed.match(SCENE_RE);
    if (sceneHeading) {
      let heading = sceneHeading[1].trim();
      let start: number | null = null;
      let end: number | null = null;
      const range = heading.match(SCENE_RANGE_RE);
      if (range) {
        start = parseTimecode(range[1]);
        end = parseTimecode(range[2]);
        heading = heading.replace(SCENE_RANGE_RE, "").trim();
      }
      let number: number | null = null;
      const numbered = heading.match(SCENE_NUM_RE);
      if (numbered) {
        number = Number(numbered[1]);
        heading = numbered[2].trim();
      }
      currentScene = {
        id: `scene-${sceneSeq++}`,
        number,
        title: heading.replace(/[*_`]/g, "").trim(),
        start: start ?? Number.POSITIVE_INFINITY,
        end: end ?? 0,
        characters: [],
        cueIds: [],
      };
      scenes.push(currentScene);
      continue;
    }

    const chars = trimmed.match(CHARACTERS_RE);
    if (chars && currentScene) {
      currentScene.characters = chars[1]
        .split(/·|,|\||;/)
        .map((c) => c.replace(/[*_]/g, "").trim())
        .filter(Boolean);
      continue;
    }

    const cueMatch = trimmed.match(CUE_RE);
    if (cueMatch) {
      const start = parseTimecode(cueMatch[1]);
      const end = parseTimecode(cueMatch[2]);
      if (start === null || end === null) continue;
      const body = parseCueBody(cueMatch[3]);
      const safeEnd = end > start ? end : start + 1.2;
      const cue: Cue = {
        id: `cue-${cues.length}`,
        index: cues.length,
        start,
        end: safeEnd,
        speaker: body.speaker,
        speakerKey: body.speaker ? normalizeKey(body.speaker) : null,
        text: body.text,
        kind: body.kind,
        sceneId: currentScene ? currentScene.id : null,
        words: estimateWords(body.text, start, safeEnd),
      };
      cues.push(cue);
      if (currentScene) {
        currentScene.cueIds.push(cue.id);
        currentScene.start = Math.min(currentScene.start, start);
        currentScene.end = Math.max(currentScene.end, safeEnd);
      }
      continue;
    }

    if (!currentScene) {
      if (cues.length === 0 && !trimmed.startsWith("#"))
        headerLines.push(trimmed);
      const meta = trimmed.match(META_RE);
      if (meta) {
        const key = normalizeKey(meta[1]);
        if (key.startsWith("archivo")) source = meta[2].trim();
        if (key.startsWith("duracion")) {
          const t = meta[2].match(/([0-9]{1,3}:[0-9]{2}(?::[0-9]{2})?)/);
          if (t) durationHint = parseTimecode(t[1]) ?? undefined;
        }
      }
    }
  }

  cues.sort((a, b) => a.start - b.start || a.end - b.end);
  cues.forEach((c, i) => {
    c.index = i;
  });

  const usedScenes = scenes.filter((s) => s.cueIds.length > 0);
  usedScenes.forEach((s) => {
    if (!Number.isFinite(s.start)) s.start = 0;
  });
  usedScenes.sort((a, b) => a.start - b.start);

  return {
    title: title || "Transcripción",
    source,
    durationHint,
    headerLines,
    format: "markdown",
    scenes: usedScenes,
    cues,
    speakers: buildSpeakers(cues),
  };
}

export function buildSpeakers(cues: Cue[]): Speaker[] {
  const map = new Map<
    string,
    {
      variants: Map<string, number>;
      cues: number;
      words: number;
      seconds: number;
      firstAt: number;
    }
  >();
  for (const cue of cues) {
    if (!cue.speakerKey || !cue.speaker) continue;
    let entry = map.get(cue.speakerKey);
    if (!entry) {
      entry = {
        variants: new Map(),
        cues: 0,
        words: 0,
        seconds: 0,
        firstAt: cue.start,
      };
      map.set(cue.speakerKey, entry);
    }
    entry.variants.set(cue.speaker, (entry.variants.get(cue.speaker) ?? 0) + 1);
    entry.cues += 1;
    entry.words += countWords(cue.text);
    entry.seconds += Math.max(0, cue.end - cue.start);
    entry.firstAt = Math.min(entry.firstAt, cue.start);
  }

  const alias = new Map<string, string>();
  const keys = [...map.keys()].sort(
    (a, b) => map.get(b)!.cues - map.get(a)!.cues || a.localeCompare(b),
  );
  for (let i = 0; i < keys.length; i++) {
    const target = keys[i];
    if (alias.has(target)) continue;
    for (let j = i + 1; j < keys.length; j++) {
      const other = keys[j];
      if (alias.has(other)) continue;
      if (!isNameVariant(target, other)) continue;
      alias.set(other, target);
      const from = map.get(other)!;
      const into = map.get(target)!;
      for (const [variant, n] of from.variants)
        into.variants.set(variant, (into.variants.get(variant) ?? 0) + n);
      into.cues += from.cues;
      into.words += from.words;
      into.seconds += from.seconds;
      into.firstAt = Math.min(into.firstAt, from.firstAt);
      map.delete(other);
    }
  }
  if (alias.size > 0) {
    for (const cue of cues) {
      if (cue.speakerKey && alias.has(cue.speakerKey))
        cue.speakerKey = alias.get(cue.speakerKey)!;
    }
  }

  const speakers: Speaker[] = [...map.entries()]
    .sort((a, b) => a[1].firstAt - b[1].firstAt)
    .map(([key, data], i) => {
      const name = [...data.variants.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      )[0][0];
      return {
        key,
        name,
        cues: data.cues,
        words: data.words,
        seconds: Math.round(data.seconds * 10) / 10,
        color: colorForIndex(i),
        firstAt: data.firstAt,
      };
    });

  const byKey = new Map(speakers.map((s) => [s.key, s]));
  for (const cue of cues) {
    if (cue.speakerKey && byKey.has(cue.speakerKey))
      cue.speaker = byKey.get(cue.speakerKey)!.name;
  }
  return speakers;
}
