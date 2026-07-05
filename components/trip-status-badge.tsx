import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n";

type TripStatus = "open" | "full" | "completed" | "cancelled";

const LABEL = {
  open: "status_open",
  full: "status_full",
  completed: "status_completed",
  cancelled: "status_cancelled",
} as const;

const VARIANT = {
  open: "default",
  full: "secondary",
  completed: "outline",
  cancelled: "destructive",
} as const;

/** Trip lifecycle badge with the Arabic status label. Server-safe. */
export function TripStatusBadge({ status }: { status: TripStatus }) {
  return <Badge variant={VARIANT[status]}>{t(LABEL[status])}</Badge>;
}
