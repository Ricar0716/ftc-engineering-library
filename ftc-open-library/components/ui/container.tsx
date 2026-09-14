import { cn } from "@/lib/utils/cn";

type ContainerProps = React.HTMLAttributes<HTMLElement> & {
  as?: "div" | "main" | "section";
  width?: "default" | "narrow" | "wide";
};

const widths = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
};

export function Container({
  as: Component = "div",
  width = "default",
  className,
  ...props
}: ContainerProps) {
  return (
    <Component className={cn("mx-auto w-full px-4 sm:px-6", widths[width], className)} {...props} />
  );
}
