import { describe, expect, test } from "vitest";
import { sealAttachment, openAttachment, validateAttachment, MAX_ATTACHMENT_BYTES } from "../src/lib/attachmentCrypto";
import { exportText, safeFilename } from "../src/lib/noteExport";

describe("encrypted attachments", () => {
  test("round trips arbitrary bytes and uses independent IVs", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const bytes = new Uint8Array([0, 255, 1, 127]).buffer;
    const a = await sealAttachment(bytes, key, "note/file");
    const b = await sealAttachment(bytes, key, "note/file");
    expect(a.iv).not.toBe(b.iv);
    expect(await openAttachment(a.ciphertext, a.iv, key, "note/file")).toEqual(bytes);
    await expect(openAttachment(a.ciphertext, a.iv, key, "other/file")).rejects.toThrow();
    const corrupted = new Uint8Array(a.ciphertext.slice(0));
    corrupted[0] ^= 1;
    await expect(openAttachment(corrupted.buffer, a.iv, key, "note/file")).rejects.toThrow();
  });
  test("rejects oversized, empty and executable attachments", () => {
    expect(() => validateAttachment("image.PNG", 123)).not.toThrow();
    expect(() => validateAttachment("notes.pdf", MAX_ATTACHMENT_BYTES)).not.toThrow();
    expect(() => validateAttachment("notes.pdf", MAX_ATTACHMENT_BYTES + 1)).toThrow();
    expect(() => validateAttachment("notes.txt", 0)).toThrow();
    expect(() => validateAttachment("image.svg", 20)).toThrow();
    expect(() => validateAttachment("program.exe", 20)).toThrow();
  });
});

describe("note exports", () => {
  test("preserves Unicode and multiline text", () => {
    expect(exportText("தமிழ்", "hello\n世界", true)).toBe("# தமிழ்\n\nhello\n世界\n");
    expect(exportText("Title", "body", false)).toBe("Title\n\nbody\n");
  });
  test("sanitizes filenames and heading newlines", () => {
    expect(safeFilename("../notes:one")).not.toContain("/");
    expect(safeFilename("...")).toBe("note");
    expect(exportText("Title\nheading", "body", true)).toBe("# Title heading\n\nbody\n");
  });
});
