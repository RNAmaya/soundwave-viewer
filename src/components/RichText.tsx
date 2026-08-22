import { useMemo } from "react";
import type { Word } from "../types";

interface Props {
  words: Word[];
  time: number;
  live: boolean;
}

interface Token {
  text: string;
  start: number;
  end: number;
  italic: boolean;
  paren: boolean;
}

function tokenize(words: Word[]): Token[] {
  let italic = false;
  let paren = 0;
  return words.map((w) => {
    const asterisks = (w.text.match(/\*/g) ?? []).length;
    const startsItalic = italic || (asterisks > 0 && w.text.startsWith("*"));
    const opens = (w.text.match(/\(/g) ?? []).length;
    const closes = (w.text.match(/\)/g) ?? []).length;
    const inParen = paren > 0 || opens > 0;
    paren = Math.max(0, paren + opens - closes);
    if (asterisks % 2 === 1) italic = !italic;
    else if (asterisks > 0 && !w.text.startsWith("*")) italic = false;
    return {
      text: w.text.replace(/\*/g, ""),
      start: w.start,
      end: w.end,
      italic: startsItalic,
      paren: inParen,
    };
  });
}

export function RichText({ words, time, live }: Props) {
  const tokens = useMemo(() => tokenize(words), [words]);

  return (
    <>
      {tokens.map((t, i) => {
        if (!t.text) return null;
        const past = live && time >= t.end;
        const now = live && time >= t.start && time < t.end;
        const classes = ["w"];
        if (past) classes.push("w--past");
        if (now) classes.push("w--now");
        if (t.italic || t.paren) classes.push("w--aside");
        return (
          <span key={i} className={classes.join(" ")}>
            {t.text}{" "}
          </span>
        );
      })}
    </>
  );
}
