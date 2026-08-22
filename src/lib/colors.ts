export const SPEAKER_PALETTE = [
  "#9772e6",
  "#d4599b",
  "#dd6222",
  "#b168d3",
  "#de5778",
  "#ca7400",
  "#c55fb9",
  "#e15a53",
  "#d3a0ed",
  "#f996a9",
  "#eea563",
  "#e49ada",
  "#fb988f",
  "#bea7fb",
  "#f197c2",
  "#f79e77",
];

export const CAPTION_COLOR = "#a89ba1";

export function colorForIndex(i: number): string {
  return SPEAKER_PALETTE[i % SPEAKER_PALETTE.length];
}

export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function readThemeColor(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}
