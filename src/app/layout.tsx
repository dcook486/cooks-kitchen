import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces, Inter, Libre_Baskerville } from "next/font/google";
import { AuthenticatedFeedbackFooter } from "@/components/authenticated-feedback-footer";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";
import "./live.css";
import "./planner.css";
import "./meal-card-fix.css";
import "./month-view.css";
import "./day-view.css";
import "./quick-add.css";
import "./recipe-detail.css";
import "./sharing.css";
import "./profile.css";
import "./household-refresh.css";
import "./household-identity.css";
import "./household-lifecycle.css";
import "./landing.css";
import "./landing-brand.css";
import "./app-brand.css";
import "./onboarding-refresh.css";
import "./account-lifecycle.css";
import "./avatar-fix.css";
import "./mobile-qa.css";
import "./feedback.css";
import "./usability.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif" });
const brandSans = Inter({ subsets: ["latin"], variable: "--font-brand-sans" });
const brandSerif = Libre_Baskerville({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-brand-serif" });

export const metadata: Metadata = {
  metadataBase: new URL("https://cooks-kitchen.vercel.app"),
  title: "Cook's Kitchen",
  description:
    "A shared meal planner for couples and families. Save household recipes, plan dinners by the week, and keep everyone on the same page.",
  icons: {
    icon: "/cooks-kitchen-circle-v2.webp",
    shortcut: "/cooks-kitchen-circle-v2.webp",
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  applicationName: "Cook's Kitchen",
  appleWebApp: {
    capable: true,
    title: "Cook's Kitchen",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "Cook's Kitchen",
    description:
      "A shared meal planner for couples and families. Save household recipes, plan dinners by the week, and keep everyone on the same page.",
    url: "https://cooks-kitchen.vercel.app",
    siteName: "Cook's Kitchen",
    type: "website",
    images: [
      {
        url: "/cooks-kitchen-circle-v2.webp",
        width: 160,
        height: 160,
        alt: "Cook's Kitchen",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Cook's Kitchen",
    description:
      "A shared meal planner for couples and families. Save household recipes, plan dinners by the week, and keep everyone on the same page.",
    images: ["/cooks-kitchen-circle-v2.webp"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f8f7f4",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable} ${brandSans.variable} ${brandSerif.variable}`}>
        {children}
        <AuthenticatedFeedbackFooter />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
