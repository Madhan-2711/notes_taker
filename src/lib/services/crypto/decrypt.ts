/**
 * Decryption service using AES-256-GCM.
 */

import { base64ToArrayBuffer } from "./serialization";

/** Decrypt AES-GCM ciphertext. Takes base64-encoded ciphertext and IV. */
export async function decryptData(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const data = base64ToArrayBuffer(ciphertext);
  const ivBuffer = base64ToArrayBuffer(iv);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
    key,
    data
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
