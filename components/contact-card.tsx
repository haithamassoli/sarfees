import { MessageCircle, Phone } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { waLink } from "@/convex/lib/shared";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Counterpart contact block, shown ONLY for confirmed/completed bookings —
 * the server never sends `phone` otherwise. WhatsApp is the real channel,
 * so it gets the primary (green) button. Server-safe.
 */
export function ContactCard({
  name,
  phone,
  detail,
}: {
  name: string;
  phone: string;
  detail?: string;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg bg-secondary p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium">{name}</span>
          {detail !== undefined && (
            <span className="text-xs text-muted-foreground">{detail}</span>
          )}
        </div>
        <a
          dir="ltr"
          href={`tel:${phone}`}
          className="flex min-h-10 items-center font-mono text-sm"
        >
          {phone}
        </a>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a href={`tel:${phone}`} className={cn(buttonVariants({ variant: "outline" }))}>
          <Phone size={16} aria-hidden />
          {t("call")}
        </a>
        <a
          href={waLink(phone)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({}))}
        >
          <MessageCircle size={16} aria-hidden />
          {t("whatsapp")}
        </a>
      </div>
    </div>
  );
}
