import { GOV_AR, type Gov } from "@/convex/lib/shared";
import { MoveLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The signature element: origin ← destination as a highway-gantry sign.
 * In RTL the journey reads right (origin) to left (destination), so the
 * arrow points toward the destination like an overhead sign on the صحراوي.
 */
export function RouteSign({
  from,
  to,
  size = "md",
  className,
}: {
  from: Gov;
  to: Gov;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "px-3 py-1.5 text-sm gap-2",
    md: "px-4 py-2.5 text-lg gap-3",
    lg: "px-5 py-4 text-2xl gap-4",
  } as const;
  const icon = { sm: 14, md: 18, lg: 24 } as const;

  return (
    <div
      className={cn(
        "route-sign inline-flex items-center font-semibold tracking-wide",
        sizes[size],
        className,
      )}
    >
      <span>{GOV_AR[from]}</span>
      <MoveLeft
        aria-hidden
        size={icon[size]}
        className="shrink-0 opacity-80 rtl:rotate-0"
      />
      <span>{GOV_AR[to]}</span>
    </div>
  );
}
