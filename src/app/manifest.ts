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
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Write a note", url: "/write" },
      { name: "My notes", url: "/notes" },
      { name: "Calendar", url: "/calendar" },
    ],
    // Lets the installed app appear in the system share sheet (Android and desktop Chrome/Edge).
    // The service worker receives the shared items; see public/sw.js.
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [{ name: "files", accept: ["image/*", "application/pdf", "text/plain", "text/markdown", ".txt", ".md"] }],
      },
    },
  };
}
