import type * as React from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { GOVERNORATES, GOV_AR } from "@/convex/lib/shared";

/** Governorate picker: the 12 governorates with Arabic labels. Server-safe. */
export function GovSelect(props: React.ComponentProps<"select">) {
  return (
    <NativeSelect {...props}>
      {GOVERNORATES.map((gov) => (
        <option key={gov} value={gov}>
          {GOV_AR[gov]}
        </option>
      ))}
    </NativeSelect>
  );
}
