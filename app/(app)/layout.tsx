import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

// Every in-app route renders inside the app chrome (header + bottom tab bar).
// The marketing landing (app/landing) lives outside this group, so it renders
// on the bare root layout with its own full-bleed nav and footer.
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
