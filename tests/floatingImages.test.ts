import { describe, expect, test } from "vitest";
import * as Y from "yjs";
import { clampImage, isValidFloatingImage, migrateLegacyImageTokens, type FloatingImage } from "../src/lib/floatingImages";

const image: FloatingImage = { id: "abc123", alt: "photo.webp", x: 40, y: 80, width: 420, authorId: "u1", createdAt: 1 };

describe("floating images", () => {
  test("accepts a well-formed image and rejects hostile ids or positions", () => {
    expect(isValidFloatingImage(image)).toBe(true);
    expect(isValidFloatingImage({ ...image, id: "../x" })).toBe(false);
    expect(isValidFloatingImage({ ...image, x: Number.NaN })).toBe(false);
    expect(isValidFloatingImage({ ...image, width: 5 })).toBe(false);
  });

  test("clamps drags and resizes back onto the board", () => {
    const clamped = clampImage({ ...image, x: -50, y: -10, width: 99999 });
    expect(isValidFloatingImage(clamped)).toBe(true);
    expect(clamped.x).toBe(0);
    expect(clamped.y).toBe(0);
  });

  test("moves legacy image tokens out of the text onto the board", () => {
    const doc = new Y.Doc();
    const text = doc.getText("content");
    const images = doc.getMap<FloatingImage>("images");
    text.insert(0, "Intro\n![cat.webp](attachment:img1)\nOutro");

    expect(migrateLegacyImageTokens(text, images, "u1")).toBe(1);
    expect(text.toString()).toBe("Intro\n\nOutro");
    const placed = images.get("img1");
    expect(placed && isValidFloatingImage(placed)).toBe(true);
    expect(placed?.alt).toBe("cat.webp");
    expect(placed!.y).toBeGreaterThan(40);
  });

  test("concurrent migrations on two clients converge without duplicates", () => {
    const a = new Y.Doc();
    a.getText("content").insert(0, "A ![x](attachment:img1) B ![y](attachment:img2)");
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

    migrateLegacyImageTokens(a.getText("content"), a.getMap("images"), "u1");
    migrateLegacyImageTokens(b.getText("content"), b.getMap("images"), "u2");
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

    expect(a.getText("content").toString()).toBe("A  B ");
    expect(b.getText("content").toString()).toBe("A  B ");
    expect([...a.getMap("images").keys()].sort()).toEqual(["img1", "img2"]);
  });
});
