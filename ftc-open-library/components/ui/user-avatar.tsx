import { cn } from "@/lib/utils/cn";

type UserAvatarProps = {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function UserAvatar({ name, src, size = "md", className }: UserAvatarProps) {
  const dimension =
    size === "lg" ? "h-20 w-20 text-lg" : size === "sm" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-sm";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${name} avatar`}
        className={cn("rounded-full object-cover", dimension, className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-accent-soft font-mono font-medium text-accent",
        dimension,
        className,
      )}
    >
      {initials(name) || "?"}
    </span>
  );
}
