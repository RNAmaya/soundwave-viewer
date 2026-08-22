import type { Cue, Transcript } from "../types";
import { formatTimecode } from "./time";

function cueLine(cue: Cue): string {
  const times = `[${formatTimecode(cue.start)} - ${formatTimecode(cue.end)}]`;
  if (cue.kind === "dialogue" && cue.speaker)
    return `${times} ${cue.speaker}: ${cue.text}`;
  if (cue.kind === "caption") return `${times} *(Cartel): ${cue.text}*`;
  return `${times} ${cue.text}`;
}

export function serializeMarkdown(transcript: Transcript): string {
  const out: string[] = [];
  out.push(`# ${transcript.title}`, "");

  if (transcript.headerLines.length > 0) {
    out.push(...transcript.headerLines, "");
  }

  const loose = transcript.cues.filter(
    (c) => !c.sceneId || !transcript.scenes.some((s) => s.id === c.sceneId),
  );
  if (loose.length > 0) {
    out.push("---", "");
    for (const cue of loose) out.push(cueLine(cue));
    out.push("");
  }

  for (const scene of transcript.scenes) {
    const cues = scene.cueIds
      .map((id) => transcript.cues.find((c) => c.id === id))
      .filter((c): c is Cue => Boolean(c));
    if (cues.length === 0) continue;

    const number = scene.number !== null ? `ESCENA ${scene.number} — ` : "";
    const range = `(${formatTimecode(scene.start)} – ${formatTimecode(scene.end)})`;
    out.push("---", "", `## ${number}${scene.title} ${range}`.trim());

    const characters = [
      ...new Set(
        cues.map((c) => c.speaker).filter((n): n is string => Boolean(n)),
      ),
    ];
    if (characters.length > 0)
      out.push(`**Personajes:** ${characters.join(" · ")}`);
    out.push("");
    for (const cue of cues) out.push(cueLine(cue));
    out.push("");
  }

  return (
    out
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd() + "\n"
  );
}

export function downloadMarkdown(
  transcript: Transcript,
  fileName: string,
): void {
  const blob = new Blob([serializeMarkdown(transcript)], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.replace(/\.(md|markdown|txt|json)$/i, "") + ".md";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
