# Encrypted attachments and exports

Open a saved private note to attach images/documents; shared notes have an attachment panel above the editor. All members can download. Owners and editors can upload; owners can remove any attachment and editors can remove their own. Uploads are limited to 10 MB. Refresh retrieves newly uploaded files from collaborators; listings paginate at 20 files.

To add an image to a private note: open **My Notes**, select the secure note, choose **Edit**, then **Add image or file**. On mobile the same action appears as an image icon at the top of the editor. Use **Preview** beside an image to see it inside the note. In a shared note, open the editor and expand **Files & export**. Images belong to the note as attachments; the plain text area does not embed them at the cursor position. File uploads complete independently of text edits, so closing the editor without saving text does not undo an uploaded file.

File bytes and filenames are encrypted in the browser using the note's AES-GCM key with independent random IVs and authenticated object paths. Storage sees opaque object IDs, ciphertext sizes, uploader IDs and timestamps. Downloads use authenticated SDK requests, not public download URLs. Existing collaborators retain access to previously downloaded copies after removal, as with the note itself. File types are restricted for usability, but encryption means the server cannot inspect or scan their contents; documents are downloaded, never executed inline.

## Production setup

1. Enable Cloud Storage for the existing Firebase project and provision a bucket. Review Firebase's current billing requirements before enabling paid services.
2. Set `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` to that bucket's exact name, then rebuild the client.
3. Deploy `storage.rules` with `firebase deploy --only storage --project YOUR_PROJECT_ID`. Allow the Firebase Storage rules service to read the default Firestore database when prompted. Rules check the existing note's live membership and role. No Firestore rule changes are required.
4. Configure bucket CORS for the exact production origin (plus localhost for development if needed). Example configuration:

```json
[{"origin":["https://YOUR_APP_DOMAIN"],"method":["GET"],"maxAgeSeconds":3600}]
```

Apply using `gcloud storage buckets update gs://YOUR_BUCKET --cors-file=cors.json`. Do not commit credentials. Follow https://firebase.google.com/docs/storage/web/download-files#cors_configuration.

5. Test owner uploads, viewer downloads, revoked membership and editor restrictions in a staging project before release. Run `npm run test:storage` locally (requires Java 21 and the Firebase emulators).

Deploying these rules does not migrate any existing Storage policy. Review other uses of the bucket before deployment; paths outside `/attachments/{noteId}/{fileId}` are denied.

## Export behavior

Markdown and text exports download directly. Print / PDF opens a Unicode-friendly preview with a Print / Save as PDF button; the operating system print dialog provides PDF saving. Exports contain note text only, not drawing layers or attached files. Private/shared exports and attachment downloads are decrypted copies outside vault protection. No note content is sent to a PDF service.

## Retention

Deleting a parent note immediately makes its files inaccessible through these rules, but does not delete Storage objects. Until a server-side orphan cleanup job is configured, delete attachments before deleting their parent note to avoid retaining billed ciphertext. A cleanup job must verify the parent is absent before deleting orphaned paths. No scheduled deletion or paid infrastructure is deployed by this change.
