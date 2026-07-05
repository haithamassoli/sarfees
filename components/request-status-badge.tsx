import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n";

type RequestStatus = "open" | "matched" | "completed" | "cancelled";

const LABEL = {
  open: "request_status_open",
  matched: "request_status_matched",
  completed: "request_status_completed",
  cancelled: "request_status_cancelled",
} as const;

const VARIANT = {
  open: "default",
  matched: "secondary",
  completed: "outline",
  cancelled: "destructive",
} as const;

/** Ride-request lifecycle badge with the Arabic status label. Server-safe. */
export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge variant={VARIANT[status]}>{t(LABEL[status])}</Badge>;
}
