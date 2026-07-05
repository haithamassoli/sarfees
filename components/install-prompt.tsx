"use client";

import { useEffect, useState } from "react";
import { CarTaxiFront, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { ENGAGED_EVENT, isEngaged } from "@/lib/engagement";

// Chromium-only event; not in lib.dom.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "serfees-install-dismissed";

/**
 * Install banner (docs/PRD.md — Install UX): offered only after the visitor
 * has posted or booked (the "serfees-engaged" flag), never on first paint.
 * Chromium: custom prompt from the stashed beforeinstallprompt. iOS Safari
 * outside standalone: add-to-home-screen steps instead. Dismiss sticks.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [dismissed, setDismissed] = useState(true); // until localStorage is read
  const [ios, setIos] = useState(false);

  // localStorage/UA are invisible to SSR: state initializers would hydrate
  // mismatched, so the one-shot probe must live in a mount effect.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
      setDismissed(localStorage.getItem(DISMISSED_KEY) !== null);
    } catch {
      // keep the banner off if storage is unreadable — dismiss couldn't stick
    }
    setEngaged(isEngaged());
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) && !standalone);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault(); // we choose the moment, not the browser
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onEngaged = () => setEngaged(true);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener(ENGAGED_EVENT, onEngaged);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener(ENGAGED_EVENT, onEngaged);
    };
  }, []);

  if (dismissed || !engaged) return null;
  if (deferred === null && !ios) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // session-only dismiss is still a dismiss
    }
    setDismissed(true);
  };

  const install = async () => {
    if (deferred === null) return;
    await deferred.prompt();
    await deferred.userChoice; // spent either way — the event is single-use
    setDeferred(null);
  };

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 px-4 md:bottom-4">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-xl border bg-card p-3 shadow-lg">
        <CarTaxiFront size={22} aria-hidden className="shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t("install_banner_title")}</p>
          {deferred === null && ios && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("install_ios_steps")}
            </p>
          )}
        </div>
        {deferred !== null && (
          <Button size="sm" onClick={() => void install()}>
            {t("install_action")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("dismiss")}
          onClick={dismiss}
        >
          <X aria-hidden />
        </Button>
      </div>
    </div>
  );
}
