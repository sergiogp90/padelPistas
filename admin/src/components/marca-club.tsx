import { cn } from "@/lib/utils";

export function MarcaClub({
  size = "default",
  className,
}: {
  size?: "default" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex select-none items-center justify-center rounded-md bg-clay-500 font-mono font-semibold text-white shadow-sm",
        size === "lg" ? "h-10 w-10 text-sm" : "h-7 w-7 text-[11px]",
        className,
      )}
    >
      LG
    </span>
  );
}
