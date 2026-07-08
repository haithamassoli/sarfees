import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { CirclePlus } from "lucide-react";
import { SearchForm } from "@/components/search-form";
import { TripCard } from "@/components/trip-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { t } from "@/lib/i18n";

// Fresh per request: seat counts and departures go stale fast (cacheComponents
// is off — the old caching model applies).
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const trips = await fetchQuery(api.trips.latest, {});

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("home_title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("app_tagline")}</p>
        </div>
        <Card>
          <CardContent>
            <SearchForm />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("latest_departures")}</h2>
        {trips.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center">
            <p className="text-muted-foreground">{t("no_upcoming_trips")}</p>
            <Link href="/trips/new" className={buttonVariants({})}>
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
    </div>
  );
}
