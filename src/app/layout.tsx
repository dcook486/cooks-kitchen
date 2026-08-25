import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
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

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Cook's Kitchen",
  description: "A shared weekly meal planner for the Cook family.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable}`}>{children}</body>
    </html>
  );
}
