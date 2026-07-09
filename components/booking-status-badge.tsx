import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n";

type BookingStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "cancelled"
  | "completed";

const LABEL = {
  pending: "booking_status_pending",
  confirmed: "booking_status_confirmed",
  rejected: "booking_status_rejected",
  cancelled: "booking_status_cancelled",
  completed: "booking_status_completed",
} as const;

const VARIANT = {
  pending: "secondary",
  confirmed: "default",
  rejected: "destructive",
  cancelled: "destructive",
  completed: "outline",
} as const;

/** Booking lifecycle badge; pending gets the amber plate look. Server-safe. */
export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge variant={status === "pending" ? "plate" : VARIANT[status]}>
      {t(LABEL[status])}
    </Badge>
  );
}
