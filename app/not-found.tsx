import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Arabic 404 — dead or expired trip/request links (the main landing surface
 * of shared WhatsApp links) land here inside the RTL shell.
 */
export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <SearchX size={48} aria-hidden className="text-muted-foreground" />
      <div>
        <h1 className="text-2xl font-bold">{t("not_found_title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("not_found_hint")}</p>
      </div>
      <Link href="/" className={cn(buttonVariants({ size: "lg" }))}>
        {t("search_trips")}
      </Link>
    </div>
  );
}
