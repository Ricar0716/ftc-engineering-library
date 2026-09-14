import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type SearchBarProps = {
  defaultValue?: string;
  size?: "sm" | "lg";
  className?: string;
  id?: string;
  hiddenFields?: Record<string, string | null | undefined>;
};

export function SearchBar({
  defaultValue = "",
  size = "sm",
  className,
  id = "resource-search",
  hiddenFields,
}: SearchBarProps) {
  return (
    <form
      action="/explore"
      method="get"
      role="search"
      className={cn("flex min-w-0 w-full items-center gap-2", className)}
    >
      <label htmlFor={id} className="sr-only">
        Search resources
      </label>
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) =>
            value ? <input key={name} type="hidden" name={name} value={value} /> : null,
          )
        : null}
      <input
        id={id}
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search titles, tags, categories…"
        className={cn(
          "min-w-0 flex-1 rounded-md border border-line bg-surface text-ink placeholder:text-ink-muted/80",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          size === "lg" ? "h-12 px-4 text-base" : "h-10 px-3 text-sm",
        )}
      />
      <Button type="submit" size={size === "lg" ? "lg" : "md"} className="shrink-0">
        Search
      </Button>
    </form>
  );
}
