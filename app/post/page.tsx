import Link from "next/link";
import { CarTaxiFront, Hand } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { t } from "@/lib/i18n";

/** Post chooser: driver posts a trip, passenger posts a ride request. */
export default function PostPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("post_title")}</h1>
      <div className="flex flex-col gap-3">
        <PostChoice
          href="/trips/new"
          icon={<CarTaxiFront size={28} aria-hidden />}
          title={t("post_trip")}
          hint={t("post_trip_hint")}
        />
        <PostChoice
          href="/requests/new"
          icon={<Hand size={28} aria-hidden />}
          title={t("post_request")}
          hint={t("post_request_hint")}
        />
      </div>
    </div>
  );
}

function PostChoice({
  href,
  icon,
  title,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="transition-shadow hover:ring-primary/40">
        <CardContent className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
            {icon}
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="font-heading text-lg font-semibold">{title}</span>
            <span className="text-sm text-muted-foreground">{hint}</span>
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
