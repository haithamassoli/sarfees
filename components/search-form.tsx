"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { FormError } from "@/components/field-error";
import { GovSelect } from "@/components/gov-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Gov } from "@/convex/lib/shared";
import { t } from "@/lib/i18n";
import { ammanToday } from "@/lib/time";

/** Home search: route pair + optional day → /route/[from]/[to]?date=… */
export function SearchForm() {
  const router = useRouter();
  const [from, setFrom] = useState<Gov>("amman");
  const [to, setTo] = useState<Gov>("irbid");
  const [date, setDate] = useState("");
  const samePair = from === to;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (samePair) return;
        router.push(
          `/route/${from}/${to}${date ? `?date=${date}` : ""}`,
        );
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="search-from">{t("from")}</Label>
          <GovSelect
            id="search-from"
            name="from"
            value={from}
            onChange={(e) => setFrom(e.target.value as Gov)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="search-to">{t("to")}</Label>
          <GovSelect
            id="search-to"
            name="to"
            value={to}
            onChange={(e) => setTo(e.target.value as Gov)}
            aria-invalid={samePair || undefined}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="search-date">{t("date")}</Label>
        <Input
          id="search-date"
          name="date"
          type="date"
          min={ammanToday()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {samePair && <FormError message={t("error_same_gov")} />}

      <Button type="submit" size="lg" disabled={samePair}>
        <Search size={16} aria-hidden />
        {t("search_trips")}
      </Button>
    </form>
  );
}
