"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useForm } from "@tanstack/react-form";
import { CircleCheck } from "lucide-react";
import { FieldError, FormError } from "@/components/field-error";
import { GovSelect } from "@/components/gov-select";
import { PushToggle } from "@/components/push-toggle";
import { RequestCard } from "@/components/request-card";
import { RouteSign } from "@/components/route-sign";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Gov } from "@/convex/lib/shared";
import { markEngaged } from "@/lib/engagement";
import { errorMessage } from "@/lib/errors";
import { seatsLabel, t } from "@/lib/i18n";
import { ammanToday, ammanWallClockToMs, fmtDayTime } from "@/lib/time";
import { dateSchema, priceSchema, timeSchema } from "@/lib/validators";
import { cn } from "@/lib/utils";

type CreateResult = FunctionReturnType<typeof api.trips.createTrip>;

type PostedTrip = {
  id: CreateResult["tripId"];
  from: Gov;
  to: Gov;
  departAt: number;
  price: number;
  seats: number;
  matches: CreateResult["matches"];
};

export default function NewTripPage() {
  // Distinct success state: M4 adds inline matches here, M5 the push toggle.
  const [posted, setPosted] = useState<PostedTrip | null>(null);
  if (posted !== null) return <PostSuccess trip={posted} />;
  return <NewTripForm onPosted={setPosted} />;
}

function NewTripForm({ onPosted }: { onPosted: (trip: PostedTrip) => void }) {
  const createTrip = useMutation(api.trips.createTrip);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      from: "amman" as Gov,
      to: "irbid" as Gov,
      date: "",
      time: "",
      seats: "4",
      price: "",
      bookingMode: "instant" as "instant" | "approve",
      originArea: "",
      destArea: "",
      stops: "",
      note: "",
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      if (value.from === value.to) {
        setSubmitError(t("error_same_gov"));
        return;
      }
      const departAt = ammanWallClockToMs(value.date, value.time);
      if (!Number.isFinite(departAt) || departAt <= Date.now()) {
        setSubmitError(t("error_depart_in_past"));
        return;
      }
      const stops = value.stops
        .split(/[،,]/)
        .map((stop) => stop.trim())
        .filter((stop) => stop.length > 0);
      try {
        const { tripId, matches } = await createTrip({
          originGov: value.from,
          destGov: value.to,
          departAt,
          seatsTotal: Number(value.seats),
          pricePerSeat: Number(value.price),
          bookingMode: value.bookingMode,
          originArea: value.originArea.trim() || undefined,
          destArea: value.destArea.trim() || undefined,
          stops: stops.length > 0 ? stops : undefined,
          note: value.note.trim() || undefined,
        });
        onPosted({
          id: tripId,
          from: value.from,
          to: value.to,
          departAt,
          price: Number(value.price),
          seats: Number(value.seats),
          matches,
        });
      } catch (error) {
        setSubmitError(errorMessage(error));
      }
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("post_trip")}</h1>
      <Card>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <form.Field name="from">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={field.name}>{t("from")}</Label>
                    <GovSelect
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) =>
                        field.handleChange(e.target.value as Gov)
                      }
                    />
                  </div>
                )}
              </form.Field>
              <form.Field name="to">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={field.name}>{t("to")}</Label>
                    <GovSelect
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) =>
                        field.handleChange(e.target.value as Gov)
                      }
                    />
                  </div>
                )}
              </form.Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <form.Field name="date" validators={{ onSubmit: dateSchema }}>
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={field.name}>{t("date")}</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="date"
                      min={ammanToday()}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={
                        field.state.meta.errors.length > 0 || undefined
                      }
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </div>
                )}
              </form.Field>
              <form.Field name="time" validators={{ onSubmit: timeSchema }}>
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={field.name}>{t("time")}</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="time"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={
                        field.state.meta.errors.length > 0 || undefined
                      }
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </div>
                )}
              </form.Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <form.Field name="seats">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={field.name}>{t("seats")}</Label>
                    <NativeSelect
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                )}
              </form.Field>
              <form.Field name="price" validators={{ onSubmit: priceSchema }}>
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={field.name}>{t("price_per_seat")}</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="number"
                      dir="ltr"
                      inputMode="decimal"
                      min={0}
                      max={999}
                      step={0.25}
                      placeholder={`3.5 ${t("jod")}`}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={
                        field.state.meta.errors.length > 0 || undefined
                      }
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </div>
                )}
              </form.Field>
            </div>

            <form.Field name="bookingMode">
              {(field) => (
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mb-1.5 text-sm font-medium">
                    {t("booking_mode")}
                  </legend>
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        ["instant", t("booking_instant"), t("booking_instant_hint")],
                        ["approve", t("booking_approve"), t("booking_approve_hint")],
                      ] as const
                    ).map(([mode, label, hint]) => (
                      <label
                        key={mode}
                        className={cn(
                          "flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 transition-colors",
                          field.state.value === mode
                            ? "border-primary bg-secondary ring-1 ring-primary"
                            : "border-input hover:bg-muted",
                        )}
                      >
                        <input
                          type="radio"
                          name={field.name}
                          value={mode}
                          checked={field.state.value === mode}
                          onChange={() => field.handleChange(mode)}
                          className="sr-only"
                        />
                        <span className="text-sm font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground">
                          {hint}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </form.Field>

            <div className="grid grid-cols-2 gap-3">
              <form.Field name="originArea">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={field.name}>{t("origin_area")}</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      maxLength={200}
                      placeholder={t("origin_area_placeholder")}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </div>
                )}
              </form.Field>
              <form.Field name="destArea">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={field.name}>{t("dest_area")}</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      maxLength={200}
                      placeholder={t("dest_area_placeholder")}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </div>
                )}
              </form.Field>
            </div>

            <form.Field name="stops">
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={field.name}>{t("stops_label")}</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    maxLength={200}
                    placeholder={t("stops_placeholder")}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="note">
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={field.name}>{t("note_label")}</Label>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    maxLength={200}
                    rows={2}
                    placeholder={t("note_placeholder")}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>

            <FormError message={submitError} />

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" size="lg" disabled={isSubmitting}>
                  {t("post_trip")}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function PostSuccess({ trip }: { trip: PostedTrip }) {
  // Posting is the engagement moment the install banner waits for.
  useEffect(() => markEngaged(), []);

  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <CircleCheck size={48} aria-hidden className="text-primary" />
      <div>
        <h1 className="text-2xl font-bold">{t("trip_posted")}</h1>
        <p className="mt-1 text-muted-foreground">{t("trip_posted_hint")}</p>
      </div>

      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-3">
          <RouteSign from={trip.from} to={trip.to} size="md" />
          <p className="text-sm text-muted-foreground">
            {fmtDayTime(trip.departAt)}
          </p>
          <div className="flex items-center gap-3">
            <span className="font-heading text-lg font-semibold">
              {trip.price} {t("jod")}
            </span>
            <Badge variant="plate">{seatsLabel(trip.seats)}</Badge>
          </div>
        </CardContent>
      </Card>

      {trip.matches.length > 0 && (
        <section className="flex w-full max-w-sm flex-col gap-3 text-start">
          <div>
            <h2 className="text-lg font-semibold">
              {t("matched_requests_title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("matched_requests_hint")}
            </p>
          </div>
          {trip.matches.map((request) => (
            <RequestCard key={request._id} request={request} />
          ))}
        </section>
      )}

      <PushToggle className="w-full max-w-sm" />

      <Link
        href={`/trips/${trip.id}`}
        className={cn(buttonVariants({ size: "lg" }), "w-full max-w-sm")}
      >
        {t("view_trip")}
      </Link>
    </div>
  );
}
