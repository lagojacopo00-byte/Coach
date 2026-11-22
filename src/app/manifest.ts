import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Coach Maratona",
    short_name: "Coach",
    description: "Piano di 16 settimane per la Maratona di Roma 2027",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "it",
    background_color: "#ffffff",
    theme_color: "#f97316",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
