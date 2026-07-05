import { Star } from "lucide-react";
import { t } from "@/lib/i18n";

/** Compact rating aggregate: "★ 4.8 · 34" or "جديد" when unrated. Server-safe. */
export function RatingBadge({ avg, count }: { avg: number; count: number }) {
  if (count === 0) {
    return (
      <span className="text-xs text-muted-foreground">{t("new_member")}</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Star size={12} aria-hidden className="fill-plate text-plate" />
      <span className="font-medium text-foreground">{avg.toFixed(1)}</span>
      <span>· {count}</span>
    </span>
  );
}
