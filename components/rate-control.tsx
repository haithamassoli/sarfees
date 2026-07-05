"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5] as const;

/** Read-only star row: how the rater's own rating renders after submitting. */
export function StarsRow({ stars, size = 16 }: { stars: number; size?: number }) {
  return (
    <span
      role="img"
      aria-label={`${stars} ${t("of_5_stars")}`}
      className="inline-flex items-center gap-0.5"
    >
      {STARS.map((i) => (
        <Star
          key={i}
          size={size}
          aria-hidden
          className={
            i <= stars ? "fill-plate text-plate" : "text-muted-foreground/40"
          }
        />
      ))}
    </span>
  );
}

/**
 * "قيّم" on a completed booking card: dialog with a 1–5 star picker (buttons in
 * DOM order 1→5 — the row flows RTL so star 1 sits at the start, and fill
 * logic is numeric, never directional) + optional comment. Once rated,
 * renders the given stars read-only instead.
 */
export function RateControl({
  bookingId,
  rateeName,
  myStars,
}: {
  bookingId: Id<"bookings">;
  rateeName: string;
  myStars: number | undefined;
}) {
  const rate = useMutation(api.ratings.rate);
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const [preview, setPreview] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (myStars !== undefined) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{t("your_rating")}:</span>
        <StarsRow stars={myStars} />
      </div>
    );
  }

  const shown = preview > 0 ? preview : stars;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setStars(0);
          setPreview(0);
          setComment("");
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Star size={16} aria-hidden />
        {t("rate")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("rate_dialog_title")} {rateeName}
          </DialogTitle>
          <DialogDescription>{t("rate_dialog_hint")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div
            role="radiogroup"
            aria-label={t("rating")}
            className="flex items-center justify-center gap-1.5"
            onMouseLeave={() => setPreview(0)}
          >
            {STARS.map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={stars === i}
                aria-label={`${i} ${t("of_5_stars")}`}
                onClick={() => setStars(i)}
                onMouseEnter={() => setPreview(i)}
                onFocus={() => setPreview(i)}
                onBlur={() => setPreview(0)}
                className="rounded-lg p-1.5 outline-none transition-transform hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Star
                  size={32}
                  aria-hidden
                  className={cn(
                    "transition-colors",
                    i <= shown
                      ? "fill-plate text-plate"
                      : "text-muted-foreground/40",
                  )}
                />
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`rate-comment-${bookingId}`}>
              {t("rate_comment_label")}
            </Label>
            <Textarea
              id={`rate-comment-${bookingId}`}
              maxLength={300}
              placeholder={t("rate_comment_placeholder")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          {error !== null && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            disabled={busy || stars === 0}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const trimmed = comment.trim();
                await rate({
                  bookingId,
                  stars,
                  ...(trimmed.length === 0 ? {} : { comment: trimmed }),
                });
                toast.success(t("rated_toast"));
                setOpen(false);
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("rate_submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
