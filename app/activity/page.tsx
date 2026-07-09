"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Authenticated,
  AuthLoading,
  useMutation,
  useQuery,
} from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { CirclePlus, Flag, Hand, Search } from "lucide-react";
import { BookingStatusBadge } from "@/components/booking-status-badge";
import { CancelBookingButton } from "@/components/cancel-booking-button";
import { CancelRequestButton } from "@/components/cancel-request-button";
import { ConfirmCancelDialog } from "@/components/confirm-cancel-dialog";
import { ContactCard } from "@/components/contact-card";
import { PushToggle } from "@/components/push-toggle";
import { RateControl } from "@/components/rate-control";
import { RequestStatusBadge } from "@/components/request-status-badge";
import { RouteSign } from "@/components/route-sign";
import { TripStatusBadge } from "@/components/trip-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { counterpartPhone } from "@/convex/lib/privacy";
import { errorMessage } from "@/lib/errors";
import { seatsLabel, t } from "@/lib/i18n";
import { fmtDayTime } from "@/lib/time";
import { cn } from "@/lib/utils";

type MyTrip = FunctionReturnType<typeof api.trips.mine>[number];
type MyBooking = FunctionReturnType<typeof api.bookings.myBookings>[number];
type TripBooking = FunctionReturnType<typeof api.bookings.forMyTrip>[number];
type MyRequest = FunctionReturnType<typeof api.requests.mine>[number];
type MyRatings = FunctionReturnType<typeof api.ratings.myRatingsForBookings>;

export default function ActivityPage() {
  return (
    <>
      <AuthLoading>
        <ActivitySkeleton />
      </AuthLoading>
      <Authenticated>
        <ActivityContent />
      </Authenticated>
    </>
  );
}

function ActivityContent() {
  const bookings = useQuery(api.bookings.myBookings);
  const requests = useQuery(api.requests.mine);
  const trips = useQuery(api.trips.mine);
  // My stars on completed bookings (passenger side) — drives قيّم vs read-only.
  const myRatings = useQuery(api.ratings.myRatingsForBookings, {
    bookingIds: (bookings ?? [])
      .filter((booking) => booking.status === "completed")
      .map((booking) => booking._id),
  });
  if (bookings === undefined || requests === undefined || trips === undefined) {
    return <ActivitySkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("activity_title")}</h1>

      <PushToggle />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("my_bookings")}</h2>
        {bookings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center">
            <p className="text-muted-foreground">{t("no_my_bookings")}</p>
            <Link href="/" className={cn(buttonVariants({}))}>
              <Search size={16} aria-hidden />
              {t("search_trips")}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {bookings.map((booking) => (
              <MyBookingCard
                key={booking._id}
                booking={booking}
                myRatings={myRatings}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("my_requests")}</h2>
        {requests.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center">
            <p className="text-muted-foreground">{t("no_my_requests")}</p>
            <Link
              href="/requests/new"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <Hand size={16} aria-hidden />
              {t("post_request")}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((request) => (
              <MyRequestCard key={request._id} request={request} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("my_trips")}</h2>
        {trips.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center">
            <p className="text-muted-foreground">{t("no_my_trips")}</p>
            <Link href="/trips/new" className={cn(buttonVariants({}))}>
              <CirclePlus size={16} aria-hidden />
              {t("post_trip")}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {trips.map((trip) => (
              <MyTripCard key={trip._id} trip={trip} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------- passenger ------------------------------- */

function MyBookingCard({
  booking,
  myRatings,
}: {
  booking: MyBooking;
  myRatings: MyRatings | undefined;
}) {
  const cancellable =
    booking.status === "pending" || booking.status === "confirmed";
  const driverPhone = counterpartPhone(booking.driver);

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/trips/${booking.trip._id}`}
            className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <RouteSign
              from={booking.trip.originGov}
              to={booking.trip.destGov}
              size="sm"
            />
          </Link>
          <BookingStatusBadge status={booking.status} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{fmtDayTime(booking.trip.departAt)}</span>
          <span>
            {seatsLabel(booking.seats)} × {booking.trip.pricePerSeat} {t("jod")}
          </span>
        </div>
        {driverPhone !== null && (
          <ContactCard
            name={booking.driver.name}
            phone={driverPhone}
            detail={t("driver")}
          />
        )}
        {cancellable && (
          <div className="flex justify-end">
            <CancelBookingButton bookingId={booking._id} />
          </div>
        )}
        {booking.status === "completed" && myRatings !== undefined && (
          <div className="flex justify-end">
            <RateControl
              bookingId={booking._id}
              rateeName={booking.driver.name}
              myStars={myRatings[booking._id]}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Passenger's ride request: status, matched driver contact, cancel. */
function MyRequestCard({ request }: { request: MyRequest }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/requests/${request._id}`}
            className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <RouteSign
              from={request.originGov}
              to={request.destGov}
              size="sm"
            />
          </Link>
          <RequestStatusBadge status={request.status} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{fmtDayTime(request.trip?.departAt ?? request.desiredAt)}</span>
          <span>
            {seatsLabel(request.seats)}
            {request.trip !== undefined && (
              <>
                {" "}
                × {request.trip.pricePerSeat} {t("jod")}
              </>
            )}
          </span>
        </div>
        {request.driver !== undefined && (
          <ContactCard
            name={request.driver.name}
            phone={request.driver.phone}
            detail={t("driver")}
          />
        )}
        {request.status === "open" && (
          <div className="flex justify-end">
            <CancelRequestButton requestId={request._id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------- driver --------------------------------- */

function MyTripCard({ trip }: { trip: MyTrip }) {
  const active = trip.status === "open" || trip.status === "full";

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/trips/${trip._id}`}
            className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <RouteSign from={trip.originGov} to={trip.destGov} size="sm" />
          </Link>
          <TripStatusBadge status={trip.status} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{fmtDayTime(trip.departAt)}</span>
          <span>
            {trip.pricePerSeat} {t("jod")}
          </span>
          <span>
            {t("seats_available")}: {trip.seatsAvailable}
          </span>
        </div>
        {active && (
          <>
            <TripBookings tripId={trip._id} />
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CompleteTripButton tripId={trip._id} />
              <CancelTripButton tripId={trip._id} />
            </div>
          </>
        )}
        {trip.status === "completed" && <RatePassengers tripId={trip._id} />}
      </CardContent>
    </Card>
  );
}

/** Driver side of ratings: one قيّم control per completed booking. */
function RatePassengers({ tripId }: { tripId: MyTrip["_id"] }) {
  const bookings = useQuery(api.bookings.forMyTrip, { tripId });
  const completed = (bookings ?? []).filter(
    (booking) => booking.status === "completed",
  );
  const myRatings = useQuery(api.ratings.myRatingsForBookings, {
    bookingIds: completed.map((booking) => booking._id),
  });
  if (bookings === undefined || myRatings === undefined) {
    return <Skeleton className="h-9 w-full rounded-lg" />;
  }
  if (completed.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-sm font-medium">{t("rate_passengers")}</h3>
      {completed.map((booking) => (
        <div
          key={booking._id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary p-2.5"
        >
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {booking.passenger.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {seatsLabel(booking.seats)}
            </span>
          </div>
          <RateControl
            bookingId={booking._id}
            rateeName={booking.passenger.name}
            myStars={myRatings[booking._id]}
          />
        </div>
      ))}
    </div>
  );
}

/** Live bookings on one of my open/full trips: approve queue + passenger list. */
function TripBookings({ tripId }: { tripId: MyTrip["_id"] }) {
  const bookings = useQuery(api.bookings.forMyTrip, { tripId });
  if (bookings === undefined) {
    return <Skeleton className="h-9 w-full rounded-lg" />;
  }
  const pending = bookings.filter((b) => b.status === "pending");
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  if (pending.length === 0 && confirmed.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      {pending.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-medium">{t("pending_requests")}</h3>
          {pending.map((booking) => (
            <PendingBookingRow key={booking._id} booking={booking} />
          ))}
        </div>
      )}
      {confirmed.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-medium">{t("confirmed_passengers")}</h3>
          {confirmed.map((booking) => {
            const phone = counterpartPhone(booking.passenger);
            if (phone === null) return null; // confirmed always has it
            return (
              <ContactCard
                key={booking._id}
                name={booking.passenger.name}
                phone={phone}
                detail={seatsLabel(booking.seats)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function PendingBookingRow({ booking }: { booking: TripBooking }) {
  const approve = useMutation(api.bookings.approve);
  const reject = useMutation(api.bookings.reject);
  const [busy, setBusy] = useState(false);

  const act = async (action: "approve" | "reject") => {
    setBusy(true);
    try {
      if (action === "approve") {
        await approve({ bookingId: booking._id });
        toast.success(t("booking_approved_toast"));
      } else {
        await reject({ bookingId: booking._id });
        toast.success(t("booking_rejected_toast"));
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary p-2.5">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{booking.passenger.name}</span>
        <span className="text-xs text-muted-foreground">
          {seatsLabel(booking.seats)}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Button size="sm" disabled={busy} onClick={() => act("approve")}>
          {t("approve")}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => act("reject")}
        >
          {t("reject")}
        </Button>
      </div>
    </div>
  );
}

function CompleteTripButton({ tripId }: { tripId: MyTrip["_id"] }) {
  const completeTrip = useMutation(api.bookings.completeTrip);
  const [busy, setBusy] = useState(false);

  return (
    <Button
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await completeTrip({ tripId });
          toast.success(t("trip_completed_toast"));
        } catch (err) {
          toast.error(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Flag size={16} aria-hidden />
      {t("complete_trip")}
    </Button>
  );
}

function CancelTripButton({ tripId }: { tripId: MyTrip["_id"] }) {
  const cancelTrip = useMutation(api.trips.cancelTrip);
  return (
    <ConfirmCancelDialog
      triggerLabel={t("cancel_trip")}
      title={t("cancel_trip_title")}
      body={t("cancel_trip_body")}
      confirmLabel={t("confirm_cancel")}
      onConfirm={() => cancelTrip({ id: tripId })}
    />
  );
}

function ActivitySkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  );
}
