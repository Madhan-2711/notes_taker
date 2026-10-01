"use client";

import { useEffect, useState } from "react";
import { loadAttachmentImage } from "../lib/services/attachments";

/** Decrypts an image attachment into a short-lived object URL. */
export function useAttachmentImageUrl(noteId: string, userId: string, privateKey: CryptoKey | null, id: string, alt: string) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    void (async () => {
      try {
        const blob = await loadAttachmentImage(noteId, userId, privateKey, id, alt);
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (active) setError(true);
      }
    })();
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [noteId, userId, privateKey, id, alt]);
  return { url, error };
}
