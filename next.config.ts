import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const ContentSecurityPolicy = [
  "default-src 'self'",

  // Keep unsafe-eval development-only, as required by the Next.js dev runtime.
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://accounts.google.com https://apis.google.com https://www.gstatic.com`,

  // Tailwind CSS uses inline styles
  "style-src 'self' 'unsafe-inline'",

  // Firebase Auth, Firestore, and Google Sign-In network targets
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebase.com https://accounts.google.com https://apis.google.com",

  // Google profile photos
  "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.googleusercontent.com",

  // No external fonts
  "font-src 'self'",

  // Firebase Auth uses a hidden helper frame hosted on the configured auth domain.
  "frame-src https://accounts.google.com https://*.firebaseapp.com https://*.web.app",

  "worker-src 'self' blob:",

  // Disallow plugins (Flash etc.)
  "object-src 'none'",

  // Prevent base tag hijacking
  "base-uri 'self'",

  // Prevent this application from being embedded by another origin.
  "frame-ancestors 'none'",

  // Only allow forms to submit to same origin
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Monitor violations first. Enforcing an unverified CSP previously
          // interrupted Firebase Google sign-in in production.
          {
            key: "Content-Security-Policy-Report-Only",
            value: ContentSecurityPolicy,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
