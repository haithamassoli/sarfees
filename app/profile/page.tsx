"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Authenticated, AuthLoading, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useForm } from "@tanstack/react-form";
import type { FunctionReturnType } from "convex/server";
import { CircleCheck, LogOut } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { FieldError, FormError } from "@/components/field-error";
import { StarsRow } from "@/components/rate-control";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { fmtDay } from "@/lib/time";
import { nameSchema } from "@/lib/validators";

type Viewer = NonNullable<FunctionReturnType<typeof api.users.viewer>>;

export default function ProfilePage() {
  return (
    <>
      <AuthLoading>
        <ProfileSkeleton />
      </AuthLoading>
      <Authenticated>
        <ProfileContent />
      </Authenticated>
    </>
  );
}

function ProfileContent() {
  const viewer = useQuery(api.users.viewer);
  if (viewer === undefined) return <ProfileSkeleton />;
  if (viewer === null) return null; // transient: proxy guards this route

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("profile_title")}</h1>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-muted-foreground">{t("phone")}</span>
            <span dir="ltr" className="w-fit font-mono text-base font-medium">
              {viewer.phone}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("phone_hint")}
            </span>
          </div>
          <Separator />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-muted-foreground">{t("rating")}</span>
            <RatingStars avg={viewer.ratingAvg} count={viewer.ratingCount} />
          </div>
        </CardContent>
      </Card>

      <ReceivedRatings userId={viewer._id} />

      <ProfileForm key={viewer._id} viewer={viewer} />

      <LogoutButton />
    </div>
  );
}

/** Rating summary: big average + star row + count. */
function RatingStars({ avg, count }: { avg: number; count: number }) {
  if (count === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("no_ratings_yet")}</p>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <span className="font-heading text-3xl font-bold">{avg.toFixed(1)}</span>
      <div className="flex flex-col gap-0.5">
        <StarsRow stars={Math.round(avg)} />
        <span className="text-sm text-muted-foreground">
          ({count} {t("ratings_unit")})
        </span>
      </div>
    </div>
  );
}

/** Last ratings I received (stars + optional comment + rater first name). */
function ReceivedRatings({ userId }: { userId: Viewer["_id"] }) {
  const ratings = useQuery(api.ratings.forUser, { userId });
  if (ratings === undefined || ratings.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("latest_ratings")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {ratings.map((rating, index) => (
          <div key={rating._id} className="flex flex-col gap-1.5">
            {index > 0 && <Separator />}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StarsRow stars={rating.stars} size={14} />
                <span className="text-sm font-medium">{rating.raterName}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {fmtDay(rating._creationTime)}
              </span>
            </div>
            {rating.comment !== undefined && (
              <p className="text-sm text-muted-foreground">{rating.comment}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ProfileForm({ viewer }: { viewer: Viewer }) {
  const updateProfile = useMutation(api.users.updateProfile);
  const [saved, setSaved] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: viewer.name,
      make: viewer.vehicle?.make ?? "",
      color: viewer.vehicle?.color ?? "",
      plate: viewer.vehicle?.plate ?? "",
    },
    onSubmit: async ({ value }) => {
      setSaved(false);
      setSubmitError(null);
      const make = value.make.trim();
      const color = value.color.trim();
      const plate = value.plate.trim();
      const filled = [make, color, plate].filter((f) => f.length > 0).length;
      if (filled !== 0 && filled !== 3) {
        setSubmitError(t("error_invalid_vehicle"));
        return;
      }
      try {
        await updateProfile({
          name: value.name.trim(),
          vehicle: filled === 3 ? { make, color, plate } : undefined,
        });
        setSaved(true);
      } catch (error) {
        setSubmitError(errorMessage(error));
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("vehicle_title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="name" validators={{ onSubmit: nameSchema }}>
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={field.name}>{t("name")}</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  autoComplete="name"
                  maxLength={60}
                  placeholder={t("name_placeholder")}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={field.state.meta.errors.length > 0 || undefined}
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-3">
            <form.Field name="make">
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={field.name}>{t("vehicle_make")}</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    maxLength={30}
                    placeholder={t("vehicle_make_placeholder")}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="color">
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={field.name}>{t("vehicle_color")}</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    maxLength={30}
                    placeholder={t("vehicle_color_placeholder")}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name="plate">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={field.name}>{t("vehicle_plate")}</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  dir="ltr"
                  maxLength={30}
                  placeholder={t("vehicle_plate_placeholder")}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </div>
            )}
          </form.Field>

          <p className="text-xs text-muted-foreground">{t("vehicle_hint")}</p>

          <FormError message={submitError} />

          <div className="flex items-center gap-3">
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting}>
                  {t("save")}
                </Button>
              )}
            </form.Subscribe>
            {saved && (
              <span className="flex items-center gap-1 text-sm text-primary">
                <CircleCheck size={16} aria-hidden />
                {t("saved")}
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function LogoutButton() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      variant="outline"
      size="lg"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await signOut();
          router.push("/");
        } finally {
          setBusy(false);
        }
      }}
    >
      <LogOut size={16} aria-hidden />
      {t("logout")}
    </Button>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
      <Skeleton className="h-9 w-full rounded-lg" />
    </div>
  );
}
