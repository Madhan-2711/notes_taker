// Sends reminder notifications while the app is closed.
// Every minute: find reminders that are due, push them to the user's registered
// devices (Firebase Cloud Messaging), then clear one-off reminders or move repeating
// ones to their next time. Deploy with: firebase deploy --only functions
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { planReminder, reminderMessage } from "./reminders.js";

initializeApp();
const db = getFirestore();

const BATCH = 200;
const STALE_TOKEN_ERRORS = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

export const sendDueReminders = onSchedule({ schedule: "every 1 minutes", timeoutSeconds: 120, memory: "256MiB" }, async () => {
  const now = Date.now();
  // Needs the collection-group index on noteMeta.reminderAt from firestore.indexes.json.
  const due = await db.collectionGroup("noteMeta").where("reminderAt", "<=", now).limit(BATCH).get();
  let sent = 0;

  for (const metaDoc of due.docs) {
    const userRef = metaDoc.ref.parent.parent;
    if (!userRef) continue;
    const noteId = metaDoc.id;

    // Claim the reminder first so a slow send can't make the next run notify twice.
    const plan = await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(metaDoc.ref);
      const result = fresh.exists ? planReminder(fresh.data(), now) : null;
      if (!result) return null;
      transaction.update(metaDoc.ref, { reminderAt: result.nextReminderAt, updatedAt: now });
      return result;
    });
    if (!plan) continue;

    const note = await db.collection("notes").doc(noteId).get();
    if (!note.exists || note.get("deletedAt")) continue;

    const tokenDocs = await userRef.collection("pushTokens").get();
    const tokens = tokenDocs.docs.map((item) => item.get("token")).filter((token) => typeof token === "string");
    if (tokens.length === 0) continue;

    const message = reminderMessage(note.data(), noteId);
    const response = await getMessaging().sendEachForMulticast({
      tokens,
      // Data-only, so the app's service worker shows it exactly like in-app reminders
      // (same tag, so a reminder the open app already showed isn't shown twice).
      data: message,
      webpush: { headers: { Urgency: "high", TTL: "3600" } },
    });
    sent += response.successCount;

    // Forget devices that uninstalled the app or turned notifications off.
    await Promise.all(response.responses.map((result, index) => {
      const code = result.error?.code;
      return code && STALE_TOKEN_ERRORS.has(code) ? tokenDocs.docs[index].ref.delete() : null;
    }));
  }

  if (due.size) logger.info(`Processed ${due.size} due reminders, sent ${sent} notifications.`);
});
