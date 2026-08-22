import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { DUR, enter, reduced, useGSAP } from "../../lib/motion";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
  menuWidth?: number;
}

export function Select({
  value,
  options,
  onChange,
  label,
  icon,
  className = "",
  menuWidth = 120,
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      options.findIndex((o) => o.value === value),
    ),
  );
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, options, value]);

  useGSAP(
    () =>
      reduced(() => {
        if (!open || !menuRef.current) return;
        enter(menuRef.current, { y: -6, scale: 0.97 }, { duration: DUR.quick });
      }),
    { dependencies: [open], scope: wrapRef },
  );

  const commit = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) {
              setOpen(true);
              return;
            }
            setActive((i) =>
              e.key === "ArrowDown"
                ? Math.min(options.length - 1, i + 1)
                : Math.max(0, i - 1),
            );
          }
          if (open && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            commit(options[active].value);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        className="flex h-9 w-full items-center gap-1.5 rounded-full bg-elevated pr-2.5 pl-3 text-sm text-ink transition-colors hover:bg-ink/8 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-rose-400/25"
      >
        {icon && <span className="shrink-0 text-faint">{icon}</span>}
        <span className="flex-1 text-left tabular-nums">{selected?.label}</span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="listbox"
          className="card absolute right-0 bottom-11 z-50 max-h-56 origin-bottom-right overflow-y-auto p-1 shadow-xl"
          style={{ minWidth: menuWidth }}
        >
          {options.map((option, i) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(i)}
                onClick={() => commit(option.value)}
                className={`flex w-full items-center gap-2 rounded-full px-3 py-1.5 text-left text-sm transition-colors ${
                  isSelected ? "text-accent" : "text-muted"
                } ${i === active ? "bg-ink/6" : ""}`}
              >
                <span className="flex-1 tabular-nums">{option.label}</span>
                {isSelected && <Check className="size-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
