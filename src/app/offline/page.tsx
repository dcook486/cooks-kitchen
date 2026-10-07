import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline · Cook's Kitchen",
  robots: { index: false, follow: false },
};

// Fully static and user-agnostic: the service worker caches this one page as the offline fallback.
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="offline-page">
      {/* Inline styles so this page still looks right if cached CSS from an older deploy is missing. */}
      <style>{`
        .offline-page { min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: 32px 20px; background: #f8f7f4; color: #2d4050; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
        .offline-card { width: min(440px, 100%); text-align: center; background: #fff; border: 1px solid #e3dfdd; border-radius: 24px; padding: 36px 28px; box-shadow: 0 25px 70px rgba(45, 64, 80, .1); }
        .offline-card img { width: 84px; height: 84px; margin: 0 auto 18px; display: block; }
        .offline-eyebrow { margin: 0 0 8px; font-size: .72rem; letter-spacing: .15em; font-weight: 800; color: #6f7b82; }
        .offline-card h1 { margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: 2rem; letter-spacing: -.03em; line-height: 1.15; }
        .offline-card p.offline-copy { margin: 12px 0 24px; color: #6f7b82; line-height: 1.55; }
        .offline-retry { display: inline-flex; justify-content: center; min-height: 46px; align-items: center; padding: 11px 20px; border-radius: 12px; background: #738372; color: #fff; font-weight: 750; text-decoration: none; }
      `}</style>
      <div className="offline-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={84} height={84} />
        <p className="offline-eyebrow">COOK&apos;S KITCHEN</p>
        <h1>You&apos;re offline</h1>
        <p className="offline-copy">Your saved plan will be back when you reconnect. Check your Wi-Fi or signal, then try again.</p>
        {/* A full page load on purpose: the service worker retries the network for navigations. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="offline-retry" href="/">Try again</a>
      </div>
    </main>
  );
}
