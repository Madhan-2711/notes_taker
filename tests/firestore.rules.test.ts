import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";

const PROJECT_ID = "notes-taker-rules-test";
let testEnv: RulesTestEnvironment;

const collabNote = {
  mode: "collab",
  title: "Shared",
  authorId: "alice",
  groupIds: [],
  collaboratorIds: [],
  collaboratorRoles: {},
  encryptedKeys: { alice: "wrapped-for-alice" },
  latestSnapshot: "ciphertext",
  snapshotIv: "iv",
  createdAt: 1,
  updatedAt: 1,
};

async function seedBaseData() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, "notes", "note-1"), collabNote),
      setDoc(doc(db, "public_profiles", "alice"), {
        displayName: "Alice",
        photoURL: null,
        publicKey: "alice-public-key",
        createdAt: 1,
      }),
      setDoc(doc(db, "public_profiles", "bob"), {
        displayName: "Bob",
        photoURL: null,
        publicKey: "bob-public-key",
        createdAt: 1,
      }),
      setDoc(doc(db, "users", "alice"), {
        email: "alice@example.com",
        wrappedPrivateKey: "private-vault",
        createdAt: 1,
      }),
    ]);
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve("firestore.rules"), "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedBaseData();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("note authorization", () => {
  test("the owner can create a schema-valid encrypted collaborative note", async () => {
    const alice = testEnv
      .authenticatedContext("alice", { email: "alice@example.com" })
      .firestore();
    await assertSucceeds(
      setDoc(doc(alice, "notes", "new-note"), {
        ...collabNote,
        encryptedTitle: "encrypted-title",
        titleIv: "title-iv",
      })
    );
  });

  test("a signed-in attacker cannot manufacture an invitation", async () => {
    const db = testEnv
      .authenticatedContext("mallory", { email: "mallory@example.com" })
      .firestore();

    await assertFails(
      setDoc(doc(db, "collab_invites", "note-1_mallory"), {
        noteId: "note-1",
        senderId: "mallory",
        senderName: "Mallory",
        senderEmail: "mallory@example.com",
        receiverId: "mallory",
        receiverName: "Mallory",
        encryptedNoteKey: "fake",
        permission: "editor",
        status: "pending",
        createdAt: 1,
      })
    );
    await assertFails(getDoc(doc(db, "notes", "note-1")));
  });

  test("the owner can invite and the receiver joins atomically", async () => {
    const alice = testEnv
      .authenticatedContext("alice", { email: "alice@example.com" })
      .firestore();
    const inviteRef = doc(alice, "collab_invites", "note-1_bob");

    await assertSucceeds(
      setDoc(inviteRef, {
        noteId: "note-1",
        senderId: "alice",
        senderName: "Alice",
        senderEmail: "alice@example.com",
        receiverId: "bob",
        receiverName: "Bob",
        encryptedNoteKey: "wrapped-for-bob",
        permission: "editor",
        status: "pending",
        createdAt: 2,
      })
    );

    const bob = testEnv
      .authenticatedContext("bob", { email: "bob@example.com" })
      .firestore();
    await assertFails(getDoc(doc(bob, "notes", "note-1")));

    const batch = writeBatch(bob);
    batch.update(doc(bob, "notes", "note-1"), {
      collaboratorIds: arrayUnion("bob"),
      "encryptedKeys.bob": "wrapped-for-bob",
      "collaboratorRoles.bob": "editor",
      updatedAt: 2,
    });
    batch.update(doc(bob, "collab_invites", "note-1_bob"), {
      status: "accepted",
    });
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(doc(bob, "notes", "note-1")));
  });

  test("a collaborator cannot change membership", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "notes", "note-1"), {
        collaboratorIds: ["bob"],
        collaboratorRoles: { bob: "editor" },
        encryptedKeys: { alice: "a", bob: "b" },
      });
    });
    const bob = testEnv.authenticatedContext("bob").firestore();
    await assertFails(
      updateDoc(doc(bob, "notes", "note-1"), {
        collaboratorIds: ["bob", "mallory"],
      })
    );
  });
});

describe("collaboration roles and updates", () => {
  test("an editor may publish an encrypted update", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "notes", "note-1"), {
        collaboratorIds: ["bob"],
        collaboratorRoles: { bob: "editor" },
        encryptedKeys: { alice: "a", bob: "b" },
      });
    });
    const bob = testEnv.authenticatedContext("bob").firestore();
    await assertSucceeds(
      setDoc(doc(bob, "note_updates", "update-1"), {
        noteId: "note-1",
        senderId: "bob",
        clientId: "browser-tab-1",
        encryptedUpdate: "ciphertext",
        iv: "iv",
        createdAt: serverTimestamp(),
      })
    );
  });

  test("a viewer cannot publish or overwrite a snapshot", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "notes", "note-1"), {
        collaboratorIds: ["bob"],
        collaboratorRoles: { bob: "viewer" },
        encryptedKeys: { alice: "a", bob: "b" },
      });
    });
    const bob = testEnv.authenticatedContext("bob").firestore();

    await assertFails(
      setDoc(doc(bob, "note_updates", "update-1"), {
        noteId: "note-1",
        senderId: "bob",
        clientId: "browser-tab-1",
        encryptedUpdate: "ciphertext",
        iv: "iv",
        createdAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(bob, "notes", "note-1"), {
        latestSnapshot: "replacement",
        snapshotIv: "replacement-iv",
        updatedAt: 2,
      })
    );
  });

  test("an outsider cannot publish updates or presence", async () => {
    const mallory = testEnv.authenticatedContext("mallory").firestore();
    await assertFails(
      setDoc(doc(mallory, "note_updates", "attack"), {
        noteId: "note-1",
        senderId: "mallory",
        clientId: "attack-client",
        encryptedUpdate: "garbage",
        iv: "iv",
        createdAt: serverTimestamp(),
      })
    );
    await assertFails(
      setDoc(doc(mallory, "notes", "note-1", "presence", "mallory"), {
        uid: "mallory",
        displayName: "Mallory",
        photoURL: null,
        lastSeen: Date.now(),
        cursorPosition: 0,
      })
    );
  });
});

describe("profile privacy", () => {
  test("vault records are private while exact public-profile reads work", async () => {
    const bob = testEnv.authenticatedContext("bob").firestore();
    await assertFails(getDoc(doc(bob, "users", "alice")));
    await assertSucceeds(getDoc(doc(bob, "public_profiles", "alice")));
    await assertFails(getDocs(collection(bob, "public_profiles")));
  });
});

describe("friendship integrity", () => {
  test("a user cannot manufacture a friendship", async () => {
    const mallory = testEnv.authenticatedContext("mallory").firestore();
    await assertFails(
      setDoc(doc(mallory, "friends", "alice_mallory"), {
        users: ["alice", "mallory"],
        requestId: "missing-request",
        createdAt: 1,
      })
    );
  });

  test("the receiver can atomically accept a pending request", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "friend_requests", "request-1"), {
        senderId: "alice",
        senderEmail: "alice@example.com",
        senderName: "Alice",
        senderPhoto: null,
        receiverId: "bob",
        receiverEmail: "bob@example.com",
        receiverName: "Bob",
        receiverPhoto: null,
        status: "pending",
        createdAt: 1,
      });
    });

    const bob = testEnv.authenticatedContext("bob").firestore();
    const batch = writeBatch(bob);
    batch.update(doc(bob, "friend_requests", "request-1"), { status: "accepted" });
    batch.set(doc(bob, "friends", "alice_bob"), {
      users: ["alice", "bob"],
      requestId: "request-1",
      createdAt: 2,
    });
    await assertSucceeds(batch.commit());
  });
});
