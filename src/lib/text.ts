import type { Word } from "../types";

export function normalizeKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.·:;,!¡?¿"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function plainText(text: string): string {
  return text.replace(/\*/g, "").replace(/\s+/g, " ").trim();
}

export function countWords(text: string): number {
  const t = plainText(text);
  return t ? t.split(/\s+/).length : 0;
}

export function estimateWords(
  text: string,
  start: number,
  end: number,
): Word[] {
  const tokens = text.split(/(\s+)/).filter((t) => t.length > 0);
  const visible = tokens.filter((t) => !/^\s+$/.test(t));
  if (visible.length === 0) return [];
  const weights = visible.map((t) => Math.max(1, plainText(t).length));
  const total = weights.reduce((a, b) => a + b, 0);
  const span = Math.max(0.001, end - start);
  const words: Word[] = [];
  let acc = 0;
  for (let i = 0; i < visible.length; i++) {
    const from = start + (acc / total) * span;
    acc += weights[i];
    const to = start + (acc / total) * span;
    words.push({ text: visible[i], start: from, end: to, estimated: true });
  }
  return words;
}

export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let best = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < best) best = curr[j];
    }
    if (best > max) return max + 1;
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[b.length];
}

export function isNameVariant(a: string, b: string): boolean {
  if (/\d/.test(a) || /\d/.test(b)) return false;
  if (Math.min(a.length, b.length) < 6) return false;
  return editDistance(a, b, 1) <= 1;
}

export interface TextChunk {
  text: string;
  italic: boolean;
  paren: boolean;
}

export function chunkText(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  const re = /\*([^*]+)\*|\(([^)]*)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last)
      chunks.push({
        text: text.slice(last, m.index),
        italic: false,
        paren: false,
      });
    if (m[1] !== undefined) {
      const inner = m[1];
      const isParen = /^\s*\(.*\)\s*$/.test(inner);
      chunks.push({
        text: isParen ? inner : inner,
        italic: true,
        paren: isParen,
      });
    } else {
      chunks.push({ text: `(${m[2]})`, italic: false, paren: true });
    }
    last = re.lastIndex;
  }
  if (last < text.length)
    chunks.push({ text: text.slice(last), italic: false, paren: false });
  return chunks.filter((c) => c.text.length > 0);
}
