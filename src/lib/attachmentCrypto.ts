import { arrayBufferToBase64, base64ToArrayBuffer } from "./services/crypto/serialization";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.md,.csv,.docx,.xlsx,.pptx";
const extensions = new Set(ATTACHMENT_ACCEPT.split(","));

export function validateAttachment(name: string, size: number) {
  if (!size || size > MAX_ATTACHMENT_BYTES) throw new Error("Choose a non-empty file up to 10 MB.");
  const extension = name.slice(name.lastIndexOf(".")).toLowerCase();
  if (!extensions.has(extension)) throw new Error("Choose an image, PDF, text file, or Office document.");
}

export async function sealAttachment(data: ArrayBuffer, key: CryptoKey, context: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(context) }, key, data);
  return { ciphertext, iv: arrayBufferToBase64(iv.buffer) };
}

export async function openAttachment(data: ArrayBuffer, iv: string, key: CryptoKey, context: string) {
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToArrayBuffer(iv), additionalData: new TextEncoder().encode(context) }, key, data);
}
