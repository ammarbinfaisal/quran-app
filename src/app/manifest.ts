import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "quran",
    short_name: "quran",
    description: "quran app",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f1e4",
    theme_color: "#8b6914",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
}

