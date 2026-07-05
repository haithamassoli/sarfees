"use client";

import Link from "next/link";
import {
  Authenticated,
  AuthLoading,
  useMutation,
  useQuery,
} from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  BellOff,
  CarTaxiFront,
  CheckCheck,
  CircleCheck,
  CircleX,
  Flag,
  Hourglass,
  Star,
  UserRoundPlus,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { GOV_AR } from "@/convex/lib/shared";
import { t, type MessageKey } from "@/lib/i18n";
import { fmtDayTime } from "@/lib/time";
import { cn } from "@/lib/utils";

type Notification = FunctionReturnType<typeof api.notifications.list>[number];

const TITLE: Record<Notification["type"], MessageKey> = {
  potential_passenger: "notif_potential_passenger",
  potential_driver: "notif_potential_driver",
  booking_pending: "notif_booking_pending",
  booking_confirmed: "notif_booking_confirmed",
  booking_rejected: "notif_booking_rejected",
  trip_completed: "notif_trip_completed",
  rating_received: "notif_rating_received",
};

const ICON: Record<Notification["type"], LucideIcon> = {
  potential_passenger: UserRoundPlus,
  potential_driver: CarTaxiFront,
  booking_pending: Hourglass,
  booking_confirmed: CircleCheck,
  booking_rejected: CircleX,
  trip_completed: Flag,
  rating_received: Star,
};

export default function NotificationsPage() {
  return (
    <>
      <AuthLoading>
        <NotificationsSkeleton />
      </AuthLoading>
      <Authenticated>
        <NotificationsContent />
      </Authenticated>
    </>
  );
}

function NotificationsContent() {
  const notifications = useQuery(api.notifications.list);
  const markAllRead = useMutation(api.notifications.markAllRead);
  if (notifications === undefined) return <NotificationsSkeleton />;

  const hasUnread = notifications.some((n) => n.readAt === undefined);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t("notifications_title")}</h1>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void markAllRead({})}
          >
            <CheckCheck size={16} aria-hidden />
            {t("mark_all_read")}
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-12 text-center">
          <BellOff size={24} aria-hidden className="text-muted-foreground" />
          <p className="font-medium">{t("no_notifications")}</p>
          <p className="text-sm text-muted-foreground">
            {t("no_notifications_hint")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((notification) => (
            <NotificationRow
              key={notification._id}
              notification={notification}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationRow({ notification }: { notification: Notification }) {
  const markRead = useMutation(api.notifications.markRead);
  const unread = notification.readAt === undefined;
  const Icon = ICON[notification.type];

  return (
    <Link
      href={notification.href}
      onClick={() => {
        // Fire-and-forget; navigation proceeds while the row flips to read.
        if (unread) void markRead({ id: notification._id });
      }}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        unread ? "bg-secondary" : "bg-card hover:bg-muted/50",
      )}
    >
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
        <Icon size={18} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={cn("text-sm", unread && "font-semibold")}>
          {t(TITLE[notification.type])}
        </span>
        {notification.route !== undefined && (
          <span className="text-xs text-muted-foreground">
            {GOV_AR[notification.route.from]} ← {GOV_AR[notification.route.to]}
            {notification.when !== undefined && (
              <> · {fmtDayTime(notification.when)}</>
            )}
          </span>
        )}
      </span>
      {unread && (
        <span
          aria-label={t("unread_notifications")}
          className="ms-auto mt-2 size-2 shrink-0 rounded-full bg-destructive"
        />
      )}
    </Link>
  );
}

function NotificationsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  );
}
