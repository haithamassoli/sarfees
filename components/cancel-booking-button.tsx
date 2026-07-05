"use client";

import { useMutation } from "convex/react";
import { ConfirmCancelDialog } from "@/components/confirm-cancel-dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { t } from "@/lib/i18n";

/** Booking cancel (either party) with a confirm dialog. */
export function CancelBookingButton({
  bookingId,
}: {
  bookingId: Id<"bookings">;
}) {
  const cancelBooking = useMutation(api.bookings.cancelBooking);
  return (
    <ConfirmCancelDialog
      triggerLabel={t("cancel_booking")}
      title={t("cancel_booking_title")}
      body={t("cancel_booking_body")}
      confirmLabel={t("confirm_cancel_booking")}
      onConfirm={() => cancelBooking({ bookingId })}
    />
  );
}
