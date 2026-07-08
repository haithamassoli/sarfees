import type { Metadata } from "next";
import Link from "next/link";
import { GOV_AR, type Gov } from "@/convex/lib/shared";
import { Arrow } from "./arrow";
import { GantrySign } from "./gantry-sign";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: { absolute: "سيرفيس — مشاوير بين محافظات الأردن" },
  description:
    "سوق الرحلات بين محافظات الأردن. السائق ينشر مشواره، الراكب يحجز مقعد أو ينشر طلبه، ونجمعكم على نفس الخط خلال ٩٠ دقيقة — نقداً وبسعر السائق.",
};

// A dozen real corridors covering all 12 governorates. Each is a real page.
const CORRIDORS: [Gov, Gov][] = [
  ["amman", "irbid"],
  ["amman", "zarqa"],
  ["amman", "aqaba"],
  ["amman", "karak"],
  ["irbid", "mafraq"],
  ["amman", "madaba"],
  ["amman", "jerash"],
  ["irbid", "ajloun"],
  ["amman", "maan"],
  ["balqa", "amman"],
  ["amman", "tafilah"],
  ["zarqa", "mafraq"],
];

function Logo({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2d7b48" />
          <stop offset="1" stopColor="#0d4f28" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${id})`} />
      <path
        d="M160 372 C 320 372, 192 140, 352 140"
        fill="none"
        stroke="#0a3d20"
        strokeWidth="84"
        strokeLinecap="round"
      />
      <path
        d="M160 372 C 320 372, 192 140, 352 140"
        fill="none"
        stroke="#f8f5ef"
        strokeWidth="13"
        strokeLinecap="round"
        strokeDasharray="1 50"
      />
      <circle cx="160" cy="372" r="33" fill="#f8f5ef" />
      <circle cx="160" cy="372" r="14" fill="#0d4f28" />
      <circle cx="352" cy="140" r="33" fill="#f3c76c" />
      <circle cx="352" cy="140" r="14" fill="#0d4f28" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <div className={`${styles.wrap} ${styles.navIn}`}>
          <Link className={styles.brand} href="/" aria-label="سيرفيس — الصفحة الرئيسية">
            <Logo id="serfeesLogoNav" /> سيرفيس
          </Link>
          <nav className={styles.navLinks} aria-label="روابط">
            <a className={styles.navLink} href="#how">
              كيف يعمل
            </a>
            <a className={styles.navLink} href="#routes">
              الخطوط
            </a>
            <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/">
              ابحث عن رحلة
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className={styles.hero}>
          <div className={`${styles.wrap} ${styles.heroGrid}`}>
            <div>
              <p className={styles.eyebrow}>مشاوير بين محافظات الأردن</p>
              <h1>
                لاقِ سيرفيسك لأي محافظة.
                <span className={styles.l2}>من عمان لإربد، ومن الزرقاء للعقبة.</span>
              </h1>
              <p className={styles.sub}>
                السائق ينشر مشواره بمقاعده وسعره ووقته، والراكب يحجز مقعد أو ينشر
                طلبه — ونجمعكم على نفس الخط خلال ٩٠ دقيقة. نقداً، وبالسعر اللي
                يحدده السائق.
              </p>
              <div className={styles.actions}>
                <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/">
                  ابحث عن رحلة{" "}
                  <span className={styles.btnArrow} aria-hidden>
                    ←
                  </span>
                </Link>
                <Link className={`${styles.btn} ${styles.btnGhost}`} href="/trips/new">
                  انشر رحلتك
                </Link>
              </div>
              <div className={styles.statline}>
                <span>
                  <b>١٢</b> محافظة
                </span>
                <span className={styles.statDot}>•</span>
                <span>
                  <b>١٣٢</b> خط
                </span>
                <span className={styles.statDot}>•</span>
                <span>
                  نافذة مطابقة <b>٩٠</b> دقيقة
                </span>
              </div>
            </div>
            <GantrySign />
          </div>
        </section>

        <hr className={styles.lane} />

        {/* PROBLEM */}
        <section className={styles.section}>
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>المشكلة</p>
              <h2>السيرفيس موجود. الفوضى بس بالتنسيق.</h2>
            </div>
            <div className={styles.twoCol}>
              <div className={`${styles.panel} ${styles.before}`}>
                <span className={styles.tag}>اليوم</span>
                <h3>منشور بيضيع بين المجموعات</h3>
                <p>
                  مشوارك مبعثر بين عشرات مجموعات الواتساب والفيسبوك — رقم بينكتب
                  غلط، وموعد بينسى، واللي بيلاقي سيرفيس بيلاقيه بالصدفة.
                </p>
              </div>
              <div className={`${styles.panel} ${styles.after}`}>
                <span className={styles.tag}>مع سيرفيس</span>
                <h3>كل مشوار، صفحة وحدة</h3>
                <p>
                  الخط، الوقت، السعر، والمقاعد — بصفحة وحدة إلها رابط. بترجعله وقت
                  ما بدك، وبتنشره بنفس المجموعات اللي فيها الطلب.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className={`${styles.section} ${styles.alt}`} id="how">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>كيف يعمل</p>
              <h2>أربع خطوات، وإنت بالطريق.</h2>
            </div>
            <div className={styles.steps}>
              <div className={styles.step}>
                <div className={styles.marker}>١</div>
                <h3>انشر أو ابحث</h3>
                <p>
                  سائق؟ انشر مشوارك بمقاعده وسعره ووقته. راكب؟ احجز مقعد على رحلة،
                  أو انشر طلبك وانتظر سائق.
                </p>
              </div>
              <div className={styles.step}>
                <div className={styles.marker}>٢</div>
                <h3>نجمعكم على الخط</h3>
                <p>
                  أول ما يظهر طرف على نفس الخط وخلال ٩٠ دقيقة من وقتك، يوصلك تنبيه
                  فوراً — بدون ما تفضل تبحث.
                </p>
              </div>
              <div className={styles.step}>
                <div className={styles.marker}>٣</div>
                <h3>تواصلوا واتفقوا</h3>
                <p>
                  بعد تأكيد الحجز يظهر الرقم: اتصال أو واتساب مباشرة. الدفع نقداً
                  بالسعر المتفق عليه.
                </p>
              </div>
              <div className={styles.step}>
                <div className={styles.marker}>٤</div>
                <h3>قيّموا بعد الوصول</h3>
                <p>
                  تقييم من الطرفين، من نجمة لخمس. السمعة تبني الثقة للمشوار الجاي.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* THE MATCH */}
        <section className={styles.section}>
          <div className={`${styles.wrap} ${styles.matchGrid}`}>
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>المطابقة</p>
              <h2>نفس الخط، وفارق ٩٠ دقيقة.</h2>
              <p>
                ما تنطر. أول ما ينشر سائق رحلة تطابق طلبك — أو ينشر راكب طلب يطابق
                رحلتك — يوصل تنبيه للطرف اللي كان موجود. محسوبة لحظياً، بلا بحث ولا
                انتظار.
              </p>
            </div>
            <div className={styles.matchViz} aria-hidden>
              <div className={styles.miniSign}>
                <span className={styles.who}>سائق</span> عمان <Arrow /> العقبة
              </div>
              <div className={styles.matchWindow}>
                <span className={styles.ping} /> خلال ٩٠ دقيقة → تنبيه فوري
              </div>
              <div className={styles.miniSign}>
                <span className={styles.who}>راكب</span> عمان <Arrow /> العقبة
              </div>
            </div>
          </div>
        </section>

        {/* ROUTES NETWORK */}
        <section className={`${styles.section} ${styles.alt}`} id="routes">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>الخطوط</p>
              <h2>١٣٢ خط. كل خط، صفحة.</h2>
              <p>
                كل خط بين المحافظات إله صفحة تظهر بجوجل وتنفتح بالواتساب. انشر
                الرابط بمجموعتك، واللي عم تنطر تلاقيك.
              </p>
            </div>
            <div className={styles.routesGrid}>
              {CORRIDORS.map(([from, to]) => (
                <Link
                  key={`${from}-${to}`}
                  className={styles.routeChip}
                  href={`/route/${from}/${to}`}
                >
                  {GOV_AR[from]} <Arrow /> {GOV_AR[to]}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* INSTALL / TRUST BAND */}
        <section className={styles.section}>
          <div className={styles.wrap}>
            <div className={styles.band}>
              <h2>بدون تنزيل من المتجر.</h2>
              <p>
                افتح الرابط، وأضف سيرفيس لشاشتك الرئيسية. يشتغل على أي هاتف، ويوصلك
                التنبيه حتى والتطبيق مسكّر.
              </p>
              <div className={styles.chips}>
                <span className={styles.chip}>
                  <span className={styles.amber} /> نقداً فقط
                </span>
                <span className={styles.chip}>
                  <span className={styles.amber} /> السائق يحدد السعر
                </span>
                <span className={styles.chip}>
                  <span className={styles.amber} /> تقييم من الطرفين
                </span>
                <span className={styles.chip}>
                  <span className={styles.amber} /> رقمك يظهر فقط بعد تأكيد الحجز
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* CLOSING */}
        <section className={`${styles.section} ${styles.closing}`}>
          <div className={styles.wrap}>
            <h2>وين رايح؟</h2>
            <p className={styles.sub}>محافظتك، موعدك، وسعر تعرفه من قبل ما تركب.</p>
            <div className={styles.actions}>
              <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/">
                ابحث عن رحلة{" "}
                <span className={styles.btnArrow} aria-hidden>
                  ←
                </span>
              </Link>
              <Link className={`${styles.btn} ${styles.btnGhost}`} href="/trips/new">
                انشر رحلتك
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.foot}>
        <div className={`${styles.wrap} ${styles.footIn}`}>
          <Link className={styles.brand} href="/">
            <Logo id="serfeesLogoFoot" /> سيرفيس
          </Link>
          <span>مشاوير بين محافظات الأردن — نقداً وبسعر السائق.</span>
          <span className={styles.mono}>serfees.jo</span>
        </div>
      </footer>
    </div>
  );
}
