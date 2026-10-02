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
  deleteField,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

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

describe("inline attachment authorization", () => {
  const attachment = {
    ciphertext: "encrypted-bytes",
    iv: "nonce",
    name: "encrypted-name",
    nameIv: "name-nonce",
    uploader: "alice",
    size: 10,
    createdAt: 1,
  };

  test("normal-note owners can add files, but encrypted and normal formats cannot cross modes", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "notes", "normal-1"), {
        mode: "normal", title: "Plain", content: "Text", authorId: "alice",
        groupIds: [], createdAt: 1, updatedAt: 1,
      });
    });
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();
    const plain = { encrypted: false, data: "YWJj", name: "photo.webp", uploader: "alice", size: 3, createdAt: 1 };
    await assertSucceeds(setDoc(doc(alice, "notes", "normal-1", "attachments", "photo"), plain));
    await assertSucceeds(getDoc(doc(alice, "notes", "normal-1", "attachments", "photo")));
    await assertFails(getDoc(doc(bob, "notes", "normal-1", "attachments", "photo")));
    await assertFails(setDoc(doc(alice, "notes", "normal-1", "attachments", "encrypted"), attachment));
    await assertFails(setDoc(doc(alice, "notes", "note-1", "attachments", "plain"), plain));
  });

  test("owners can save; viewers can read but not upload; outsiders cannot read", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "notes", "note-1"), {
        collaboratorIds: ["bob"],
        collaboratorRoles: { bob: "viewer" },
        encryptedKeys: { alice: "a", bob: "b" },
      });
    });
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();
    const mallory = testEnv.authenticatedContext("mallory").firestore();
    await assertSucceeds(setDoc(doc(alice, "notes", "note-1", "attachments", "file-1"), attachment));
    await assertSucceeds(getDoc(doc(bob, "notes", "note-1", "attachments", "file-1")));
    await assertFails(setDoc(doc(bob, "notes", "note-1", "attachments", "file-2"), { ...attachment, uploader: "bob" }));
    await assertFails(getDoc(doc(mallory, "notes", "note-1", "attachments", "file-1")));
    await assertFails(updateDoc(doc(alice, "notes", "note-1", "attachments", "file-1"), { ciphertext: "replacement" }));
  });

  test("editors can remove their own files but not the owner's", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "notes", "note-1"), {
        collaboratorIds: ["bob"],
        collaboratorRoles: { bob: "editor" },
        encryptedKeys: { alice: "a", bob: "b" },
      });
    });
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();
    await assertSucceeds(setDoc(doc(alice, "notes", "note-1", "attachments", "owner-file"), attachment));
    await assertSucceeds(setDoc(doc(bob, "notes", "note-1", "attachments", "editor-file"), { ...attachment, uploader: "bob" }));
    await assertFails(deleteDoc(doc(bob, "notes", "note-1", "attachments", "owner-file")));
    await assertSucceeds(deleteDoc(doc(bob, "notes", "note-1", "attachments", "editor-file")));
    await assertSucceeds(deleteDoc(doc(alice, "notes", "note-1", "attachments", "owner-file")));
  });

  test("timestamp ties remain pageable with document ID as a second sort key", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const batch = writeBatch(context.firestore());
      for (let index = 0; index < 21; index += 1) {
        batch.set(doc(context.firestore(), "notes", "note-1", "attachments", `file-${index.toString().padStart(2, "0")}`), attachment);
      }
      await batch.commit();
    });
    const alice = testEnv.authenticatedContext("alice").firestore();
    const attachments = collection(alice, "notes", "note-1", "attachments");
    const sorting = [orderBy("createdAt", "desc"), orderBy(documentId(), "desc")];
    const first = await assertSucceeds(getDocs(query(attachments, ...sorting, limit(20))));
    const last = first.docs[first.docs.length - 1];
    const second = await assertSucceeds(getDocs(query(attachments, ...sorting, startAfter(last.data().createdAt, last.id), limit(20))));
    expect(first.size).toBe(20);
    expect(second.size).toBe(1);
  });
});

describe("trash, history, discussion, and pins", () => {
  test("only the owner can trash and restore a note", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();
    await assertSucceeds(updateDoc(doc(alice, "notes", "note-1"), { deletedAt: 100, updatedAt: 100 }));
    await assertFails(updateDoc(doc(bob, "notes", "note-1"), { deletedAt: 101, updatedAt: 101 }));
    await assertSucceeds(updateDoc(doc(alice, "notes", "note-1"), { deletedAt: deleteField(), updatedAt: 102 }));
  });

  test("note owners can save encrypted revisions; outsiders cannot read them", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "notes", "note-1"), { encryptedTitle: "title", titleIv: "nonce" });
    });
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();
    const revision = { mode: "collab", editorId: "alice", createdAt: 2, title: "Shared", encryptedTitle: "title", titleIv: "nonce", latestSnapshot: "ciphertext", snapshotIv: "iv" };
    await assertSucceeds(setDoc(doc(alice, "notes", "note-1", "revisions", "v1"), revision));
    await assertFails(getDoc(doc(bob, "notes", "note-1", "revisions", "v1")));
    await assertFails(setDoc(doc(bob, "notes", "note-1", "revisions", "v2"), { ...revision, editorId: "bob" }));
  });

  test("members can comment, but only the author or owner may remove a comment", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "notes", "note-1"), {
        collaboratorIds: ["bob"], collaboratorRoles: { bob: "viewer" }, encryptedKeys: { alice: "a", bob: "b" },
      });
    });
    const bob = testEnv.authenticatedContext("bob").firestore();
    const mallory = testEnv.authenticatedContext("mallory").firestore();
    const payload = { authorId: "bob", authorName: "Bob", ciphertext: "encrypted", iv: "nonce", createdAt: 2 };
    await assertSucceeds(setDoc(doc(bob, "notes", "note-1", "comments", "c1"), payload));
    await assertFails(setDoc(doc(mallory, "notes", "note-1", "comments", "c2"), { ...payload, authorId: "mallory" }));
    await assertFails(deleteDoc(doc(mallory, "notes", "note-1", "comments", "c1")));
    await assertSucceeds(deleteDoc(doc(bob, "notes", "note-1", "comments", "c1")));
  });

  test("note pins are private to each account", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();
    const preference = doc(alice, "users", "alice", "preferences", "notes");
    await assertSucceeds(setDoc(preference, { pinnedIds: ["note-1"] }));
    await assertFails(getDoc(doc(bob, "users", "alice", "preferences", "notes")));
    await assertFails(setDoc(doc(bob, "users", "alice", "preferences", "notes"), { pinnedIds: ["note-1"] }));
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

describe("rich content and personal note settings", () => {
  const normalNote = { mode: "normal", title: "T", content: "Hi", authorId: "alice", groupIds: [], createdAt: 1, updatedAt: 1 };

  test("normal notes accept formatted content but not encrypted rich fields", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(setDoc(doc(alice, "notes", "n1"), { ...normalNote, richContent: '{"ops":[{"insert":"Hi\n"}]}' }));
    await assertFails(setDoc(doc(alice, "notes", "n2"), { ...normalNote, encryptedRichContent: "x" }));
    await assertFails(setDoc(doc(alice, "notes", "n3"), { ...normalNote, richContent: "x".repeat(100001) }));
    await assertSucceeds(updateDoc(doc(alice, "notes", "n1"), { richContent: deleteField(), updatedAt: 2 }));
  });

  test("encrypted notes accept only the encrypted formatted field", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    const secure = { mode: "secure", encryptedTitle: "t", encryptedContent: "c", iv: "{}", encryptedKeys: { alice: "k" }, authorId: "alice", groupIds: [], createdAt: 1, updatedAt: 1 };
    await assertSucceeds(setDoc(doc(alice, "notes", "s1"), { ...secure, encryptedRichContent: "ciphertext" }));
    await assertFails(setDoc(doc(alice, "notes", "s2"), { ...secure, richContent: "plaintext formatting" }));
  });

  test("collaborative notes cannot carry rich-content fields", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "notes", "note-1"), { encryptedTitle: "title", titleIv: "nonce" });
    });
    const alice = testEnv.authenticatedContext("alice").firestore();
    await assertFails(updateDoc(doc(alice, "notes", "note-1"), { richContent: "x", updatedAt: 3 }));
  });

  test("tags, archive and reminders are private and well-formed", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();
    const meta = { tags: ["work"], archived: false, reminderAt: 1_900_000_000_000, updatedAt: 1 };
    await assertSucceeds(setDoc(doc(alice, "users", "alice", "noteMeta", "note-1"), meta));
    await assertSucceeds(setDoc(doc(alice, "users", "alice", "noteMeta", "note-2"), { ...meta, reminderAt: null }));
    await assertFails(getDoc(doc(bob, "users", "alice", "noteMeta", "note-1")));
    await assertFails(setDoc(doc(bob, "users", "alice", "noteMeta", "note-1"), meta));
    await assertFails(setDoc(doc(alice, "users", "alice", "noteMeta", "note-3"), { ...meta, secret: "x" }));
    await assertFails(setDoc(doc(alice, "users", "alice", "noteMeta", "note-4"), { ...meta, tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }));
    await assertSucceeds(setDoc(doc(alice, "users", "alice", "noteMeta", "note-5"), { ...meta, repeat: "weekly" }));
    await assertFails(setDoc(doc(alice, "users", "alice", "noteMeta", "note-6"), { ...meta, repeat: "hourly" }));
  });

  test("push notification devices are private to their owner", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();
    const device = { token: "fcm-token", platform: "Android", createdAt: 1, updatedAt: 1 };
    await assertSucceeds(setDoc(doc(alice, "users", "alice", "pushTokens", "device-1"), device));
    await assertFails(getDoc(doc(bob, "users", "alice", "pushTokens", "device-1")));
    await assertFails(setDoc(doc(bob, "users", "alice", "pushTokens", "device-2"), device));
    await assertFails(setDoc(doc(alice, "users", "alice", "pushTokens", "device-3"), { ...device, extra: true }));
    await assertFails(setDoc(doc(alice, "users", "alice", "pushTokens", "device-4"), { ...device, token: "" }));
  });
});

describe("usernames", () => {
  async function claim(db: ReturnType<ReturnType<RulesTestEnvironment["authenticatedContext"]>["firestore"]>, uid: string, name: string, previous?: string) {
    const batch = writeBatch(db);
    batch.set(doc(db, "usernames", name), { uid });
    batch.update(doc(db, "public_profiles", uid), { username: name });
    if (previous) batch.delete(doc(db, "usernames", previous));
    return batch.commit();
  }

  test("a user can claim a free username and others can look it up", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();
    await assertSucceeds(claim(alice, "alice", "alice_w"));
    await assertSucceeds(getDoc(doc(bob, "usernames", "alice_w")));
    await assertFails(getDocs(collection(bob, "usernames")));
  });

  test("a taken username cannot be stolen or overwritten", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();
    await assertSucceeds(claim(alice, "alice", "shared"));
    await assertFails(claim(bob, "bob", "shared"));
    await assertFails(deleteDoc(doc(bob, "usernames", "shared")));
    await assertFails(updateDoc(doc(bob, "public_profiles", "bob"), { username: "shared" }));
  });

  test("changing a username must release the old one", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(claim(alice, "alice", "first"));
    await assertFails(claim(alice, "alice", "second"));
    await assertSucceeds(claim(alice, "alice", "second", "first"));
    let stillClaimed = true;
    await testEnv.withSecurityRulesDisabled(async (context) => {
      stillClaimed = (await getDoc(doc(context.firestore(), "usernames", "first"))).exists();
    });
    expect(stillClaimed).toBe(false);
  });

  test("invalid usernames and claims for other accounts are rejected", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    await assertFails(claim(alice, "alice", "Bad Name"));
    const batch = writeBatch(alice);
    batch.set(doc(alice, "usernames", "for_bob"), { uid: "bob" });
    batch.update(doc(alice, "public_profiles", "alice"), { username: "for_bob" });
    await assertFails(batch.commit());
  });
});
