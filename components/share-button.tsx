"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/**
 * Native share sheet (→ straight into the WhatsApp groups) where the Web
 * Share API exists; clipboard + toast elsewhere. Shares the current page URL.
 */
export function ShareButton({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  async function share() {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // User dismissed the sheet — done. Anything else: clipboard fallback.
        if ((error as DOMException).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("link_copied"));
    } catch {
      toast.error(t("error_generic"));
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t("share")}
      title={t("share")}
      className={className}
      onClick={share}
    >
      <Share2 aria-hidden />
    </Button>
  );
}
