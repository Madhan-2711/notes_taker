import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Notes Taker",
    short_name: "Notes",
    description: "Private notes, encrypted writing and real-time collaboration.",
    id: "/",
    start_url: "/notes",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#6366f1",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Write a note", url: "/write" },
      { name: "My notes", url: "/notes" },
    ],
  };
}
