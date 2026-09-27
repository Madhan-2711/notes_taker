import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getMetadata, list, deleteObject, updateMetadata } from "firebase/storage";
import { beforeAll, afterAll, test } from "vitest";

let env: RulesTestEnvironment;
const path = "attachments/note-1/11111111-1111-1111-1111-111111111111";
const metadata = { contentType: "application/octet-stream", customMetadata: { uploader: "owner", iv: "abcdefghijklmnop", labelIv: "abcdefghijklmnop", label: "ciphertext" } };
const target = (uid: string, filePath = path) => ref(env.authenticatedContext(uid).storage(), filePath);

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-attachments", firestore: { rules: readFileSync("firestore.rules", "utf8") }, storage: { rules: readFileSync("storage.rules", "utf8") } });
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "notes/note-1"), { authorId: "owner", mode: "collab", collaboratorIds: ["editor", "viewer"], collaboratorRoles: { editor: "editor", viewer: "viewer" } });
  });
}, 30000);
afterAll(async () => { await env?.cleanup(); });

test("owner uploads; members list/read; outsiders and anonymous are denied", async () => {
  await assertSucceeds(uploadBytes(target("owner"), new Uint8Array(32), metadata));
  await assertSucceeds(getMetadata(target("viewer")));
  await assertSucceeds(list(ref(env.authenticatedContext("viewer").storage(), "attachments/note-1")));
  await assertFails(getMetadata(target("stranger")));
  await assertFails(getMetadata(ref(env.unauthenticatedContext().storage(), path)));
});
test("viewers cannot write, metadata is immutable and upload ownership cannot be forged", async () => {
  const otherPath = path.replace(/1/g, "2").replace("note-2", "note-1");
  await assertFails(uploadBytes(target("viewer", otherPath), new Uint8Array(32), { ...metadata, customMetadata: { ...metadata.customMetadata, uploader: "viewer" } }));
  await assertFails(uploadBytes(target("editor", otherPath), new Uint8Array(32), metadata));
  await assertFails(deleteObject(target("viewer")));
  await assertFails(deleteObject(target("editor")));
  await assertFails(updateMetadata(target("owner"), { contentType: "text/html" }));
  await assertSucceeds(uploadBytes(target("editor", otherPath), new Uint8Array(32), { ...metadata, customMetadata: { ...metadata.customMetadata, uploader: "editor" } }));
  await assertSucceeds(deleteObject(target("editor", otherPath)));
});
test("revocation blocks reads and owner can delete", async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), "notes/note-1"), { collaboratorIds: [], collaboratorRoles: {} });
  });
  await assertFails(getMetadata(target("viewer")));
  await assertSucceeds(deleteObject(target("owner")));
});

test("rejects oversized files, wrong content types and unencrypted notes", async () => {
  await assertFails(uploadBytes(target("owner"), new Uint8Array(10485777), metadata));
  await assertFails(uploadBytes(target("owner"), new Uint8Array(32), { ...metadata, contentType: "text/html" }));
  await assertFails(uploadBytes(target("owner"), new Uint8Array(32), { ...metadata, customMetadata: { ...metadata.customMetadata, iv: "invalid" } }));
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "notes/plain"), { authorId: "owner", mode: "normal" });
  });
  await assertFails(uploadBytes(target("owner", path.replace("note-1", "plain")), new Uint8Array(32), metadata));
});
