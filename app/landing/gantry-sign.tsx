"use client";

import { useEffect, useState } from "react";
import { GOV_AR, type Gov } from "@/convex/lib/shared";
import { Arrow } from "./arrow";
import styles from "./landing.module.css";

// The signature flips through real servees corridors (fare in JOD).
const ROUTES: { from: Gov; to: Gov; fare: string }[] = [
  { from: "amman", to: "irbid", fare: "2.00" },
  { from: "amman", to: "zarqa", fare: "1.00" },
  { from: "amman", to: "aqaba", fare: "8.50" },
  { from: "irbid", to: "mafraq", fare: "1.50" },
  { from: "amman", to: "karak", fare: "4.00" },
  { from: "amman", to: "madaba", fare: "1.25" },
];

export function GantrySign() {
  const [i, setI] = useState(0);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let swap: ReturnType<typeof setTimeout>;
    const cycle = setInterval(() => {
      setFlipping(true);
      swap = setTimeout(() => {
        setI((v) => (v + 1) % ROUTES.length);
        setFlipping(false);
      }, 270);
    }, 3200);
    return () => {
      clearInterval(cycle);
      clearTimeout(swap);
    };
  }, []);

  const r = ROUTES[i];

  return (
    <div className={styles.gantry}>
      <div
        className={`${styles.gantrySign} ${flipping ? styles.flipping : ""}`}
        aria-live="polite"
        aria-label="لوحة خط سيرفيس"
      >
        <span className={`${styles.bolt} ${styles.tl}`} />
        <span className={`${styles.bolt} ${styles.tr}`} />
        <span className={`${styles.bolt} ${styles.bl}`} />
        <span className={`${styles.bolt} ${styles.br}`} />
        <div className={styles.signFace}>
          <div className={styles.route}>
            <span className={`${styles.gov} ${styles.flip}`}>{GOV_AR[r.from]}</span>
            <span className={styles.road}>
              <span className={styles.roadArrow}>
                <Arrow />
              </span>
            </span>
            <span className={`${styles.gov} ${styles.flip}`}>{GOV_AR[r.to]}</span>
          </div>
          <div className={styles.signSub}>صحراوي · مقاعد متاحة اليوم</div>
        </div>
        <div className={styles.plate}>
          <span className={`${styles.num} ${styles.flip}`}>{r.fare}</span>
          <span className={styles.unit}>د.أ / مقعد</span>
        </div>
      </div>
    </div>
  );
}
