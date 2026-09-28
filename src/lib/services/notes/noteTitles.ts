import { decryptData } from "../crypto/decrypt";
import { decryptKeyFromUser } from "../crypto/sharing";
import { isCollabNote, isSecureNote, type Note } from "../../validations";

const titleCache = new Map<string, Promise<string | null>>();

function encryptedTitleParts(note: Note): { ciphertext: string; iv: string } | null {
  if (isSecureNote(note)) {
    try {
      const ivs = JSON.parse(note.iv) as { title?: string };
      return ivs.title ? { ciphertext: note.encryptedTitle, iv: ivs.title } : null;
    } catch {
      return null;
    }
  }
  if (isCollabNote(note) && note.encryptedTitle && note.titleIv) {
    return { ciphertext: note.encryptedTitle, iv: note.titleIv };
  }
  return null;
}

/** Decrypts an encrypted note's title locally; resolves null when the user can't decrypt it. */
export function decryptNoteTitle(note: Note, userId: string, privateKey: CryptoKey): Promise<string | null> {
  const parts = encryptedTitleParts(note);
  const wrappedKey = isSecureNote(note) || isCollabNote(note) ? note.encryptedKeys?.[userId] : undefined;
  if (!parts || !wrappedKey) return Promise.resolve(null);

  const cacheKey = `${userId}:${note.id}:${parts.iv}`;
  let pending = titleCache.get(cacheKey);
  if (!pending) {
    pending = decryptKeyFromUser(wrappedKey, privateKey)
      .then((noteKey) => decryptData(parts.ciphertext, parts.iv, noteKey))
      .catch(() => {
        titleCache.delete(cacheKey);
        return null;
      });
    titleCache.set(cacheKey, pending);
  }
  return pending;
}
