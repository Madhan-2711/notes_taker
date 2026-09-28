import { arrayBufferToBase64, base64ToArrayBuffer } from "./services/crypto/serialization";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.md,.csv,.docx,.xlsx,.pptx";
const extensions = new Set(ATTACHMENT_ACCEPT.split(","));

export const IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i;

// Firestore caps a document at ~1 MiB. Attachments are stored inline as a
// base64 string, so we hold the ciphertext base64 well under that to leave room
// for the other fields. base64 inflates bytes by ~4/3.
export const MAX_INLINE_B64 = 900_000; // characters of base64 ciphertext
export const MAX_INLINE_PLAINTEXT = Math.floor((MAX_INLINE_B64 * 3) / 4) - 16; // ~658 KB of real bytes

export function validateAttachment(name: string, size: number) {
  if (!size || size > MAX_ATTACHMENT_BYTES) throw new Error("Choose a non-empty file up to 10 MB.");
  const extension = name.slice(name.lastIndexOf(".")).toLowerCase();
  if (!extensions.has(extension)) throw new Error("Choose an image, PDF, text file, or Office document.");
}

export function optimizedImageName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "image";
  return `${base.slice(0, 250).replace(/[\uD800-\uDBFF]$/, "")}.webp`;
}

function toWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image."))),
      "image/webp",
      quality
    )
  );
}

/**
 * Downscale and re-encode an image to WebP so its encrypted form fits inside a
 * single Firestore document. Returns the optimized bytes plus a display name
 * whose extension matches the new format. Animated GIFs lose animation (only
 * the first frame is kept) — acceptable for inline note images.
 */
export async function normalizeImage(file: File): Promise<{ blob: Blob; name: string }> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is not supported in this browser.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let quality = 0.85;
  let blob = await toWebp(canvas, quality);
  // Step quality down until the base64 form is comfortably under the limit.
  while (blob.size * 1.34 > MAX_INLINE_B64 && quality > 0.4) {
    quality -= 0.15;
    blob = await toWebp(canvas, quality);
  }
  if (blob.size * 1.34 > MAX_INLINE_B64) {
    throw new Error("This image is too large to store inline. Try a smaller image.");
  }

  return { blob, name: optimizedImageName(file.name) };
}

export async function sealAttachment(data: ArrayBuffer, key: CryptoKey, context: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(context) }, key, data);
  return { ciphertext, iv: arrayBufferToBase64(iv.buffer) };
}

export async function openAttachment(data: ArrayBuffer, iv: string, key: CryptoKey, context: string) {
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToArrayBuffer(iv), additionalData: new TextEncoder().encode(context) }, key, data);
}
