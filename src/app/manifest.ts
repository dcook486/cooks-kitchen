import type { MetadataRoute } from "next";

// Brand colors from app-brand.css (--bg / --text).
const BRAND_BACKGROUND = "#f8f7f4";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Cook's Kitchen",
    short_name: "Cook's Kitchen",
    description:
      "A shared meal planner for couples and families. Save household recipes, plan dinners by the week, and keep everyone on the same page.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BRAND_BACKGROUND,
    theme_color: BRAND_BACKGROUND,
    categories: ["food", "lifestyle", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "This week's plan", short_name: "Plan", url: "/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Recipe bank", short_name: "Recipes", url: "/?section=recipes", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
