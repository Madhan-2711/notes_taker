"use client";

import { useEffect, useState } from "react";
import { attachmentAccess, downloadAttachment } from "../lib/services/attachments";

/** Decrypts an image attachment into a short-lived object URL. */
export function useAttachmentImageUrl(noteId: string, userId: string, privateKey: CryptoKey | null, id: string, alt: string) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    void (async () => {
      try {
        const { key } = await attachmentAccess(noteId, userId, privateKey);
        const blob = await downloadAttachment({ path: `notes/${noteId}/attachments/${id}`, name: alt, size: 0, uploader: "" }, key);
        if (!active) return;
        objectUrl = URL.createObjectURL(new Blob([blob], { type: "image/webp" }));
        setUrl(objectUrl);
      } catch {
        if (active) setError(true);
      }
    })();
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [noteId, userId, privateKey, id, alt]);
  return { url, error };
}
