"use client";

import Link from "next/link";
import { useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { BookingStatusBadge } from "@/components/booking-status-badge";
import { CancelBookingButton } from "@/components/cancel-booking-button";
import { ContactCard } from "@/components/contact-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { counterpartPhone } from "@/convex/lib/privacy";
import { markEngaged } from "@/lib/engagement";
import { errorMessage } from "@/lib/errors";
import { seatsLabel, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const MAX_SEATS_PER_BOOKING = 4;

/**
 * Live booking island on the trip page. The server page renders the static
 * parts; this subscribes to the trip (live seat count + viewer-aware driver
 * payload) and the viewer's own booking on it.
 */
export function BookPanel({ tripId }: { tripId: Id<"trips"> }) {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const trip = useQuery(api.trips.get, { id: tripId });
  const booking = useQuery(api.bookings.myBookingForTrip, { tripId });

  if (
    authLoading ||
    trip === undefined ||
    (isAuthenticated && booking === undefined)
  ) {
    return (
      <>
        <Separator />
        <Skeleton className="h-10 w-full" />
      </>
    );
  }
  if (trip === null || trip.isMine) return null;

  const driverPhone = counterpartPhone(trip.driver);

  if (booking !== null && booking !== undefined) {
    return (
      <>
        <Separator />
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {t("your_booking")} ({seatsLabel(booking.seats)})
            </span>
            <BookingStatusBadge status={booking.status} />
          </div>
          {driverPhone !== null && (
            <ContactCard name={trip.driver.name} phone={driverPhone} />
          )}
          {(booking.status === "pending" || booking.status === "confirmed") && (
            <div className="flex justify-end">
              <CancelBookingButton bookingId={booking._id} />
            </div>
          )}
        </div>
      </>
    );
  }

  if (trip.status !== "open") return null;

  if (!isAuthenticated) {
    return (
      <>
        <Separator />
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          {t("login_to_book")}
        </Link>
      </>
    );
  }

  return (
    <>
      <Separator />
      <BookForm
        tripId={tripId}
        seatsAvailable={trip.seatsAvailable}
        bookingMode={trip.bookingMode}
      />
    </>
  );
}

function BookForm({
  tripId,
  seatsAvailable,
  bookingMode,
}: {
  tripId: Id<"trips">;
  seatsAvailable: number;
  bookingMode: "instant" | "approve";
}) {
  const book = useMutation(api.bookings.book);
  const [seats, setSeats] = useState(1);
  const [busy, setBusy] = useState(false);

  // Clamp live: another passenger may grab seats while we look at the page.
  const max = Math.max(1, Math.min(MAX_SEATS_PER_BOOKING, seatsAvailable));
  const value = Math.min(seats, max);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{t("seats")}</span>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t("decrease_seats")}
            disabled={value <= 1}
            onClick={() => setSeats(Math.max(1, value - 1))}
          >
            <Minus aria-hidden />
          </Button>
          <span className="min-w-6 text-center font-heading text-lg font-semibold">
            {value}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t("increase_seats")}
            disabled={value >= max}
            onClick={() => setSeats(Math.min(max, value + 1))}
          >
            <Plus aria-hidden />
          </Button>
        </div>
      </div>
      <Button
        size="lg"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await book({ tripId, seats: value });
            markEngaged(); // a booking is the install banner's other trigger
            toast.success(
              bookingMode === "instant"
                ? t("booked_toast")
                : t("requested_toast"),
            );
          } catch (err) {
            toast.error(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        {bookingMode === "instant" ? t("book_now") : t("request_approval")}
      </Button>
    </div>
  );
}
