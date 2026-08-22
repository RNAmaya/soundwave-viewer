import type { Transcript } from "../types";
import { parseMarkdownTranscript } from "./parseMarkdown";
import { parseWhisperTranscript } from "./parseWhisper";

export function parseTranscript(raw: string, fileName: string): Transcript {
  const looksJson = /\.json$/i.test(fileName) || /^\s*[[{]/.test(raw);
  const transcript = looksJson
    ? parseWhisperTranscript(raw, fileName.replace(/\.[^.]+$/, ""))
    : parseMarkdownTranscript(raw);

  if (transcript.cues.length === 0) {
    throw new Error(
      'No se ha encontrado ningún bloque con tiempos. Se esperan líneas tipo "[00:04 - 00:12] Personaje: texto" o un JSON de Whisper.',
    );
  }
  return transcript;
}

export const TRANSCRIPT_EXTENSIONS = [".md", ".markdown", ".txt", ".json"];

export function isTranscriptFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return TRANSCRIPT_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function isAudioFile(file: File): boolean {
  if (file.type.startsWith("audio/") || file.type.startsWith("video/"))
    return true;
  return /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|weba|webm|mp4|m4v|mov)$/i.test(
    file.name,
  );
}
