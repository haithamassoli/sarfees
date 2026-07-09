"use client";

import { useMutation } from "convex/react";
import { ConfirmCancelDialog } from "@/components/confirm-cancel-dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { t } from "@/lib/i18n";

/** Request cancel (owner only) with a confirm dialog. Mirrors CancelBookingButton. */
export function CancelRequestButton({
  requestId,
}: {
  requestId: Id<"rideRequests">;
}) {
  const cancelRequest = useMutation(api.requests.cancelRequest);
  return (
    <ConfirmCancelDialog
      triggerLabel={t("cancel_request")}
      title={t("cancel_request_title")}
      body={t("cancel_request_body")}
      confirmLabel={t("confirm_cancel_request")}
      onConfirm={() => cancelRequest({ id: requestId })}
    />
  );
}
