"use client";

import Link from "next/link";
import { useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { CircleCheck } from "lucide-react";
import { FormError } from "@/components/field-error";
import { CancelRequestButton } from "@/components/cancel-request-button";
import { ContactCard } from "@/components/contact-card";
import { RequestStatusBadge } from "@/components/request-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { counterpartPhone } from "@/convex/lib/privacy";
import { isValidPrice } from "@/convex/lib/text";
import { markEngaged } from "@/lib/engagement";
import { errorMessage } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { ammanTimeInput, ammanToday, ammanWallClockToMs } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * Live island on the request page: the owner manages their request, a signed-in
 * driver accepts it, and after accepting the passenger's contact appears (the
 * server only sends the phone to the accepting driver or the owner).
 */
export function RequestPanel({ requestId }: { requestId: Id<"rideRequests"> }) {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const request = useQuery(api.requests.get, { id: requestId });

  if (authLoading || request === undefined) {
    return (
      <>
        <Separator />
        <Skeleton className="h-10 w-full" />
      </>
    );
  }
  if (request === null) return null;

  if (request.isMine) {
    return (
      <>
        <Separator />
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {t("request_status_label")}
            </span>
            <RequestStatusBadge status={request.status} />
          </div>
          {request.status === "matched" && (
            <Link
              href="/activity"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              {t("matched_see_activity")}
            </Link>
          )}
          {request.status === "open" && (
            <div className="flex justify-end">
              <CancelRequestButton requestId={request._id} />
            </div>
          )}
        </div>
      </>
    );
  }

  // The server sends the phone only to the accepting driver (or the owner,
  // handled above) — its presence IS the "you accepted this" signal.
  const passengerPhone = counterpartPhone(request.passenger);
  if (passengerPhone !== null) {
    return (
      <>
        <Separator />
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <CircleCheck size={18} aria-hidden />
            {t("request_accepted_title")}
          </p>
          <ContactCard
            name={request.passenger.name}
            phone={passengerPhone}
            detail={t("passenger")}
          />
          <Link href="/activity" className={cn(buttonVariants({}))}>
            {t("go_to_activity")}
          </Link>
        </div>
      </>
    );
  }

  if (request.status !== "open") {
    return (
      <>
        <Separator />
        <div className="flex justify-center">
          <RequestStatusBadge status={request.status} />
        </div>
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Separator />
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          {t("login_to_accept")}
        </Link>
      </>
    );
  }

  return (
    <>
      <Separator />
      <AcceptRequestDialog
        requestId={request._id}
        desiredAt={request.desiredAt}
      />
    </>
  );
}

function AcceptRequestDialog({
  requestId,
  desiredAt,
}: {
  requestId: Id<"rideRequests">;
  desiredAt: number;
}) {
  const accept = useMutation(api.requests.accept);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  // Prefilled from the passenger's desired time; the driver can adjust.
  const [date, setDate] = useState(() => ammanToday(desiredAt));
  const [time, setTime] = useState(() => ammanTimeInput(desiredAt));

  const submit = async () => {
    setError(null);
    const pricePerSeat = Number(price);
    if (price.trim() === "" || !isValidPrice(pricePerSeat)) {
      setError(t("error_invalid_price"));
      return;
    }
    const departAt = ammanWallClockToMs(date, time);
    if (!Number.isFinite(departAt) || departAt <= Date.now()) {
      setError(t("error_depart_in_past"));
      return;
    }
    setBusy(true);
    try {
      await accept({ requestId, pricePerSeat, departAt });
      markEngaged(); // accepting creates a confirmed booking — engagement moment
      toast.success(t("accept_success_toast"));
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger render={<Button size="lg" />}>
        {t("accept_request")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("accept_request_title")}</DialogTitle>
          <DialogDescription>{t("accept_request_body")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accept-price">{t("price_per_seat")}</Label>
            <Input
              id="accept-price"
              type="number"
              dir="ltr"
              inputMode="decimal"
              min={0}
              max={999}
              step={0.25}
              placeholder={`3.5 ${t("jod")}`}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="accept-date">{t("date")}</Label>
              <Input
                id="accept-date"
                type="date"
                min={ammanToday()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="accept-time">{t("time")}</Label>
              <Input
                id="accept-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          <FormError message={error} />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("back")}
          </DialogClose>
          <Button disabled={busy} onClick={submit}>
            {t("accept_request")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
