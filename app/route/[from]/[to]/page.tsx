import type { Metadata } from "next";
import Link from "next/link";
import Form from "next/form";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { ArrowRightLeft, CirclePlus, Hand } from "lucide-react";
import { RequestCard } from "@/components/request-card";
import { RouteSign } from "@/components/route-sign";
import { ShareButton } from "@/components/share-button";
import { TripCard } from "@/components/trip-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { GOV_AR, isGov } from "@/convex/lib/shared";
import { t } from "@/lib/i18n";
import { routeDescription, routeTitle } from "@/lib/seo";
import { ammanToday } from "@/lib/time";
import { cn } from "@/lib/utils";

// Fresh per request (supersedes the PRD's revalidate:60 — seat counts go
// stale fast and bots still get full HTML SSR).
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function generateMetadata({
  params,
}: PageProps<"/route/[from]/[to]">): Promise<Metadata> {
  const { from, to } = await params;
  if (!isGov(from) || !isGov(to) || from === to) {
    return { title: t("error_not_found") };
  }

  const title = routeTitle(from, to);
  const description = routeDescription(from, to);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/route/${from}/${to}`,
      siteName: t("app_name"),
      locale: "ar_JO",
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function RoutePage({
  params,
  searchParams,
}: PageProps<"/route/[from]/[to]">) {
  const { from, to } = await params;
  if (!isGov(from) || !isGov(to) || from === to) notFound();

  const rawDate = (await searchParams).date;
  const date =
    typeof rawDate === "string" && DATE_RE.test(rawDate) ? rawDate : undefined;

  const [trips, requests] = await Promise.all([
    fetchQuery(api.trips.byRoute, { from, to, date }),
    fetchQuery(api.requests.byRoute, { from, to, date }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <h1 className="sr-only">
          {`${t("app_name")} ${t("from")} ${GOV_AR[from]} ${t("to")} ${GOV_AR[to]}`}
        </h1>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <RouteSign from={from} to={to} size="md" />
          <div className="flex items-center gap-1">
            <ShareButton title={routeTitle(from, to)} />
            <Link
              href={`/route/${to}/${from}`}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              <ArrowRightLeft size={14} aria-hidden />
              {t("swap_direction")}
            </Link>
          </div>
        </div>

        <Form
          action={`/route/${from}/${to}`}
          className="flex flex-wrap items-center gap-2"
        >
          <Input
            type="date"
            name="date"
            aria-label={t("date")}
            defaultValue={date}
            min={ammanToday()}
            className="w-auto"
          />
          <Button type="submit" variant="secondary">
            {t("filter")}
          </Button>
          {date !== undefined && (
            <Link
              href={`/route/${from}/${to}`}
              className={cn(buttonVariants({ variant: "ghost" }))}
            >
              {t("all_dates")}
            </Link>
          )}
        </Form>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("upcoming_trips")}</h2>
        {trips.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-10 text-center">
            <p className="font-medium">{t("no_trips_yet")}</p>
            <p className="text-sm text-muted-foreground">
              {t("be_first_to_post")}
            </p>
            <Link
              href="/trips/new"
              className={cn(buttonVariants({}), "mt-2")}
            >
              <CirclePlus size={16} aria-hidden />
              {t("post_trip")}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {trips.map((trip) => (
              <TripCard key={trip._id} trip={trip} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("open_requests")}</h2>
        {requests.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-10 text-center">
            <p className="font-medium">{t("no_requests_yet")}</p>
            <Link
              href="/requests/new"
              className={cn(buttonVariants({ variant: "outline" }), "mt-2")}
            >
              <Hand size={16} aria-hidden />
              {t("post_request")}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((request) => (
              <RequestCard key={request._id} request={request} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
