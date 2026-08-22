import { withAlpha } from "../lib/colors";

interface Props {
  color: string;
  className?: string;
}

export function SpeakerMark({ color, className = "" }: Props) {
  return (
    <span
      aria-hidden
      className={`block h-3.5 w-1 shrink-0 rounded-full ${className}`}
      style={{
        backgroundImage: `linear-gradient(180deg, ${color} 0%, ${withAlpha(color, 0.2)} 100%)`,
      }}
    />
  );
}
