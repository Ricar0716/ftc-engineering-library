import { cn } from "@/lib/utils/cn";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "accent" | "cad" | "code" | "tutorial" | "model";
};

const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-canvas text-ink-muted border-line",
  accent: "bg-accent-soft text-accent border-accent/20",
  cad: "bg-cad/10 text-cad border-cad/20",
  code: "bg-code/10 text-code border-code/20",
  tutorial: "bg-tutorial/10 text-tutorial border-tutorial/20",
  model: "bg-model/10 text-model border-model/20",
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
