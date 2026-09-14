import Link from "next/link";
import { cn } from "@/lib/utils/cn";

const variants = {
  primary: "bg-accent text-white hover:bg-accent-hover disabled:bg-accent/50",
  secondary: "border border-line bg-surface text-ink hover:bg-canvas disabled:text-ink-muted",
  ghost: "text-ink hover:bg-accent-soft disabled:text-ink-muted",
  danger: "bg-danger text-white hover:bg-danger/90 disabled:bg-danger/50",
} as const;

const sizes = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-3.5 text-sm",
  lg: "h-12 px-4 text-base",
} as const;

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

const baseClass =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  href?: undefined;
};

type ButtonLinkProps = Omit<React.ComponentProps<typeof Link>, "className"> & {
  variant?: Variant;
  size?: Size;
  className?: string;
  href: string;
};

function classes(variant: Variant, size: Size, className?: string) {
  return cn(baseClass, variants[variant], sizes[size], className);
}

export function buttonClassName(variant: Variant = "primary", size: Size = "md", className?: string) {
  return classes(variant, size, className);
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={classes(variant, size, className)} {...props} />;
}

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  href,
  ...props
}: ButtonLinkProps) {
  return <Link href={href} className={classes(variant, size, className)} {...props} />;
}
