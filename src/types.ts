export type CueKind = "dialogue" | "caption" | "note";

export interface Word {
  text: string;
  start: number;
  end: number;
  estimated: boolean;
}

export interface Cue {
  id: string;
  index: number;
  start: number;
  end: number;
  speaker: string | null;
  speakerKey: string | null;
  text: string;
  kind: CueKind;
  sceneId: string | null;
  words: Word[];
}

export interface Scene {
  id: string;
  number: number | null;
  title: string;
  start: number;
  end: number;
  characters: string[];
  cueIds: string[];
}

export interface Speaker {
  key: string;
  name: string;
  cues: number;
  words: number;
  seconds: number;
  color: string;
  firstAt: number;
}

export interface Transcript {
  title: string;
  source?: string;
  format: "markdown" | "whisper";
  scenes: Scene[];
  cues: Cue[];
  speakers: Speaker[];
  durationHint?: number;
  headerLines: string[];
}
