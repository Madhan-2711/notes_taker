"use client";

import { useParams } from "next/navigation";
import { useAuth } from "../../../hooks/useAuth";
import { useUserKeys } from "../../../hooks/useUserKeys";
import { CollabNoteEditor } from "../../../components/CollabNoteEditor";
import { CollaboratorManager } from "../../../components/CollaboratorManager";
import { VaultUnlockModal } from "../../../components/VaultUnlockModal";
import { sendCollabInvite } from "../../../lib/services/social/collaborationService";
import { decryptKeyFromUser } from "../../../lib/services/crypto/sharing";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebaseConfig";
import { useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CollabNotePage() {
  const { id: noteId } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const {
    privateKey,
    isReady: keysReady,
    hasKeys,
    needsVaultPassword,
    unlockVault,
    error: keyError,
  } = useUserKeys();

  const [showCollabManager, setShowCollabManager] = useState(false);

  const handleInvite = useCallback(
    async (friendUid: string, friendName: string, permission: "viewer" | "editor") => {
      if (!user || !privateKey || !noteId) return;

      // Get the note's AES key so we can re-wrap it for the friend
      const noteRef = doc(db, "notes", noteId);
      const noteSnap = await getDoc(noteRef);
      if (!noteSnap.exists()) throw new Error("Note not found");

      const noteData = noteSnap.data();
      const wrappedKey = noteData.encryptedKeys?.[user.uid];
      if (!wrappedKey) throw new Error("You don't have access to this note's key");

      const noteKey = await decryptKeyFromUser(wrappedKey, privateKey);

      await sendCollabInvite(
        noteId,
        user.uid,
        user.displayName || "Anonymous",
        user.email || "",
        friendUid,
        friendName,
        permission,
        noteKey
      );
    },
    [user, privateKey, noteId]
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto gap-4">
        <p className="text-foreground/60 text-lg">Please sign in to access this note.</p>
      </div>
    );
  }

  if (!keysReady) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasKeys) {
    return (
      <>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto gap-4">
          <p className="text-foreground/60 text-lg">Encryption keys are required to access collaborative notes.</p>
          <Link href="/notes" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
            <ArrowLeft size={14} /> Back to notes
          </Link>
        </div>
        <VaultUnlockModal
          isOpen={needsVaultPassword}
          onUnlock={unlockVault}
          error={keyError}
        />
      </>
    );
  }

  return (
    <>
      <CollabNoteEditor
        noteId={noteId}
        userId={user.uid}
        privateKey={privateKey}
        onShare={() => setShowCollabManager(true)}
        displayName={user.displayName || "Anonymous"}
        photoURL={user.photoURL}
      />

      <CollaboratorManager
        noteId={noteId}
        userId={user.uid}
        isOpen={showCollabManager}
        onClose={() => setShowCollabManager(false)}
        onInvite={handleInvite}
      />
    </>
  );
}
