"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useForm } from "@tanstack/react-form";
import { BellRing, CircleCheck } from "lucide-react";
import { FieldError } from "@/components/field-error";
import { GovSelect } from "@/components/gov-select";
import { PushToggle } from "@/components/push-toggle";
import { RouteSign } from "@/components/route-sign";
import { TripCard } from "@/components/trip-card";
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
import { dateSchema, timeSchema } from "@/lib/validators";
import { cn } from "@/lib/utils";

type CreateResult = FunctionReturnType<typeof api.requests.createRequest>;

type PostedRequest = {
  id: CreateResult["requestId"];
  from: Gov;
  to: Gov;
  desiredAt: number;
  seats: number;
  matches: CreateResult["matches"];
};

export default function NewRequestPage() {
  // Distinct success state: matched trips render inline (M5 adds the push toggle).
  const [posted, setPosted] = useState<PostedRequest | null>(null);
  if (posted !== null) return <PostSuccess request={posted} />;
  return <NewRequestForm onPosted={setPosted} />;
}

function NewRequestForm({
  onPosted,
}: {
  onPosted: (request: PostedRequest) => void;
}) {
  const createRequest = useMutation(api.requests.createRequest);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      from: "amman" as Gov,
      to: "irbid" as Gov,
      date: "",
      time: "",
      seats: "1",
      originArea: "",
      destArea: "",
      note: "",
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      if (value.from === value.to) {
        setSubmitError(t("error_same_gov"));
        return;
      }
      const desiredAt = ammanWallClockToMs(value.date, value.time);
      if (!Number.isFinite(desiredAt) || desiredAt <= Date.now()) {
        setSubmitError(t("error_depart_in_past"));
        return;
      }
      try {
        const { requestId, matches } = await createRequest({
          originGov: value.from,
          destGov: value.to,
          desiredAt,
          seats: Number(value.seats),
          originArea: value.originArea.trim() || undefined,
          destArea: value.destArea.trim() || undefined,
          note: value.note.trim() || undefined,
        });
        onPosted({
          id: requestId,
          from: value.from,
          to: value.to,
          desiredAt,
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
      <h1 className="text-2xl font-bold">{t("post_request")}</h1>
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

            <form.Field name="seats">
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={field.name}>{t("seats_requested")}</Label>
                  <NativeSelect
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
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

            {submitError !== null && (
              <p role="alert" className="text-sm text-destructive">
                {submitError}
              </p>
            )}

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" size="lg" disabled={isSubmitting}>
                  {t("post_request")}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function PostSuccess({ request }: { request: PostedRequest }) {
  // Posting is the engagement moment the install banner waits for.
  useEffect(() => markEngaged(), []);

  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <CircleCheck size={48} aria-hidden className="text-primary" />
      <div>
        <h1 className="text-2xl font-bold">{t("request_posted")}</h1>
        <p className="mt-1 text-muted-foreground">{t("request_posted_hint")}</p>
      </div>

      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-3">
          <RouteSign from={request.from} to={request.to} size="md" />
          <p className="text-sm text-muted-foreground">
            {fmtDayTime(request.desiredAt)}
          </p>
          <Badge className="bg-plate text-plate-foreground">
            {seatsLabel(request.seats)}
          </Badge>
        </CardContent>
      </Card>

      {request.matches.length > 0 ? (
        <section className="flex w-full max-w-sm flex-col gap-3 text-start">
          <div>
            <h2 className="text-lg font-semibold">
              {t("matched_trips_title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("matched_trips_hint")}
            </p>
          </div>
          {request.matches.map((trip) => (
            <TripCard key={trip._id} trip={trip} />
          ))}
        </section>
      ) : (
        <div className="flex w-full max-w-sm flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-6">
          <BellRing size={20} aria-hidden className="text-muted-foreground" />
          <p className="font-medium">{t("no_matched_trips")}</p>
          <p className="text-sm text-muted-foreground">
            {t("no_matched_trips_hint")}
          </p>
        </div>
      )}

      <PushToggle className="w-full max-w-sm" />

      <Link
        href={`/requests/${request.id}`}
        className={cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          "w-full max-w-sm",
        )}
      >
        {t("view_request")}
      </Link>
    </div>
  );
}
