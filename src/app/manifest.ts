import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NavalSmart",
    short_name: "NavalSmart",
    description: "De l'appel d'offres à l'estimation, avec l'IA. L'estimateur reste décideur.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f7fb",
    theme_color: "#071426",
    lang: "fr",
    icons: [
      { src: "/brand/mark.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/mark.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
