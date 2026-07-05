"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Web Push wants the VAPID public key as a Uint8Array, not base64url. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type Mode =
  | "loading" // support probe not done yet (also avoids SSR mismatch)
  | "hidden" // push unsupported and no install path worth explaining
  | "ios" // iOS Safari tab: no Push API until installed — show A2HS steps
  | "ready";

/**
 * "نبّهني عند وجود مطابقة" opt-in (docs/PRD.md — permission only on explicit
 * action, never on page load). Rendered on post-success screens and /activity;
 * expects a signed-in viewer (api.push.subscribe requires auth).
 */
export function PushToggle({ className }: { className?: string }) {
  const subscribeOnServer = useMutation(api.push.subscribe);
  const unsubscribeOnServer = useMutation(api.push.unsubscribe);
  const [mode, setMode] = useState<Mode>("loading");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  // Browser capability probe — invisible to SSR, so it can't be a state
  // initializer (the values would hydrate mismatched); mount effect it is.
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
      setMode(isIOS && !standalone ? "ios" : "hidden");
      return;
    }
    let cancelled = false;
    // Reflect the browser's actual subscription state, not a stored flag.
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (cancelled) return;
        setEnabled(subscription !== null);
        setMode("ready");
      })
      .catch(() => {
        if (!cancelled) setMode("hidden");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (mode === "loading" || mode === "hidden") return null;

  if (mode === "ios") {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border bg-card p-3 text-start",
          className,
        )}
      >
        <BellRing size={18} aria-hidden className="mt-0.5 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">{t("push_ios_hint")}</p>
      </div>
    );
  }

  const enable = async (): Promise<boolean> => {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      toast.error(t("push_denied"));
      return false;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
        ),
      }));
    const json = subscription.toJSON();
    if (
      json.endpoint === undefined ||
      json.keys?.p256dh === undefined ||
      json.keys?.auth === undefined
    ) {
      throw new Error("push subscription missing endpoint or keys");
    }
    await subscribeOnServer({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    });
    return true;
  };

  const disable = async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription === null) return;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await unsubscribeOnServer({ endpoint });
  };

  const onCheckedChange = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (next) {
        const granted = await enable();
        setEnabled(granted);
        if (granted) toast.success(t("push_enabled_toast"));
      } else {
        await disable();
        setEnabled(false);
        toast.success(t("push_disabled_toast"));
      }
    } catch {
      setEnabled(false);
      toast.error(t("error_generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border bg-card p-3",
        className,
      )}
    >
      <Label htmlFor="push-toggle" className="flex items-center gap-2">
        <BellRing size={18} aria-hidden className="text-primary" />
        {t("push_toggle_label")}
      </Label>
      <Switch
        id="push-toggle"
        checked={enabled}
        disabled={busy}
        onCheckedChange={(next) => void onCheckedChange(next)}
      />
    </div>
  );
}
