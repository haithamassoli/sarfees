import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: t("offline_title") };

/**
 * Offline fallback, pre-cached by public/sw.js at install. Static, no data —
 * a plain <a> (not next/link) so retry re-navigates even when the JS chunks
 * referenced by the cached HTML never load.
 */
export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <WifiOff size={48} aria-hidden className="text-muted-foreground" />
      <div>
        <h1 className="text-2xl font-bold">{t("offline_title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("offline_hint")}</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- retry
          must work without JS: the cached HTML's chunks may be unreachable */}
      <a href="/" className={cn(buttonVariants({ size: "lg" }))}>
        {t("offline_retry")}
      </a>
    </div>
  );
}
