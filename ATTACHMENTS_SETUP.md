# Note attachments and exports

The **Write a Note** page lets you select up to eight images/documents before saving a normal, secure, or shared note. When creating a shared note, select friends and their view/edit permission; invitations are sent after the note is saved. The saved-note editor also lets you add more files. All shared-note members can download; owners and editors can upload; owners can remove any attachment and editors can remove their own. Refresh retrieves newly uploaded files from collaborators; listings paginate at 20 files.

To add an image to an existing normal or secure note: open **My Notes**, select the note, choose **Edit**, then **Add image or file**. On mobile the same action appears as an image icon at the top of the editor. Use **Preview** beside an image to see it inside the note. In a shared note, open the editor and expand **Files & export**. Images belong to the note as attachments; the plain text area does not embed them at the cursor position. File uploads complete independently of text edits, so closing the editor without saving text does not undo an uploaded file.

## Storage model: inline in Firestore (no Firebase Storage)

Attachments are stored **inline in Cloud Firestore**, not in Firebase Storage, so the feature works on the free Spark plan with no billing account. Each attachment is one document under `notes/{noteId}/attachments/{attachmentId}`. For **normal notes**, file bytes and filenames are stored in plaintext-compatible form (base64-encoded bytes, not encryption), like the normal note text. For **secure and shared notes**, the document holds base64 ciphertext, its IV, and an encrypted filename. All modes also store uploader UID, byte size, and timestamp.

Because Firestore caps a document at ~1 MiB, **images are downscaled and re-encoded to WebP in the browser** (max 1600px, quality stepped down as needed) before encryption, which keeps them comfortably under the limit — so the stored name ends in `.webp`. Non-image files (PDF, text, Office documents) are stored as-is only if they are under ~650 KB; larger non-image files are rejected with a clear message, since there is no separate object store.

For secure/shared notes, file bytes and filenames are encrypted in the browser using the note's AES-GCM key with independent random IVs, and each ciphertext is bound to its exact Firestore document path via the GCM additional-authenticated-data. The database sees only opaque ciphertext, sizes, uploader IDs and timestamps — never plaintext bytes or filenames. Normal-note attachments do **not** get this protection. Downloads are handed to the user as `application/octet-stream`, never rendered inline as HTML. Existing collaborators retain access to previously downloaded copies after removal, as with the note itself.

## Production setup

1. No Cloud Storage bucket, billing upgrade, or CORS configuration is required.
2. Deploy the updated Firestore rules: `firebase deploy --only firestore:rules --project YOUR_PROJECT_ID`. This is **required before normal-note uploads work in production**. The `notes/{noteId}/attachments/{attachmentId}` block reuses the note's existing membership/role checks and keeps normal-note and encrypted-note file schemas separate: members read, editors create, documents are immutable, and the note owner or the uploader can delete.
3. Test owner uploads, viewer downloads (read-only), revoked membership, and editor restrictions in a staging project before release.

The previous Firebase Storage implementation (`storage.rules`, the storage emulator config, and the `test:storage` script) is retained in the repo for reference but is no longer used by the client.

## Export behavior

Markdown and text exports download directly. Print / PDF opens a Unicode-friendly preview with a Print / Save as PDF button; the operating system print dialog provides PDF saving. Exports contain note text only, not drawing layers or attached files. Private/shared exports and attachment downloads are decrypted copies outside vault protection. No note content is sent to a PDF service.

## Retention

Firestore does **not** delete a subcollection when its parent document is deleted, so attachment documents must be removed explicitly. The note-delete services call `deleteAllAttachments(noteId)` before deleting the parent (once the note document is gone, the rules can no longer authorize reading or deleting its attachments). Concurrent uploads during deletion still need a server-side cleanup strategy if that scenario must be guaranteed.
