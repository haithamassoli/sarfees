"use client";

import { useEffect } from "react";

/** Registers public/sw.js once per page load. Renders nothing. */
export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => console.error("sw register failed", error));
  }, []);
  return null;
}
