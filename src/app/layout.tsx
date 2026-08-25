import type { Metadata } from "next";
import { DM_Sans, Fraunces, Inter, Libre_Baskerville } from "next/font/google";
import "./globals.css";
import "./live.css";
import "./planner.css";
import "./meal-card-fix.css";
import "./month-view.css";
import "./quick-add.css";
import "./recipe-detail.css";
import "./sharing.css";
import "./profile.css";
import "./household-refresh.css";
import "./household-identity.css";
import "./landing.css";
import "./landing-brand.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif" });
const brandSans = Inter({ subsets: ["latin"], variable: "--font-brand-sans" });
const brandSerif = Libre_Baskerville({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-brand-serif" });

export const metadata: Metadata = {
  title: "Cook's Kitchen",
  description: "A shared meal planner for households to save recipes and decide what's for dinner together.",
  icons: {
    icon: "/cooks-kitchen-circle-v2.webp",
    shortcut: "/cooks-kitchen-circle-v2.webp",
    apple: "/cooks-kitchen-circle-v2.webp",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable} ${brandSans.variable} ${brandSerif.variable}`}>{children}</body>
    </html>
  );
}
