import type * as Y from "yjs";
import { BOARD_WIDTH, MAX_DRAWING_HEIGHT } from "./drawing";
import { parseNoteParts } from "./inlineImages";

/**
 * A picture placed freely on the collaborative board. Lives in a Y.Map keyed by
 * attachment id inside the note's Y.Doc, so it syncs through the same encrypted
 * update pipeline as text and strokes.
 */
export interface FloatingImage {
  id: string;
  alt: string;
  x: number;
  y: number;
  width: number;
  authorId: string;
  createdAt: number;
}

export const MIN_IMAGE_WIDTH = 60;
export const DEFAULT_IMAGE_WIDTH = 420;
const EDGE_GRAB = 40;
const LEGACY_PADDING = 40;
const LEGACY_LINE_HEIGHT = 18 * 1.9;

export function isValidFloatingImage(value: unknown): value is FloatingImage {
  if (!value || typeof value !== "object") return false;
  const image = value as Partial<FloatingImage>;
  return typeof image.id === "string" && /^[a-zA-Z0-9]{1,80}$/.test(image.id)
    && typeof image.alt === "string" && image.alt.length <= 120
    && typeof image.authorId === "string" && image.authorId.length > 0 && image.authorId.length <= 128
    && isFiniteIn(image.width, MIN_IMAGE_WIDTH, BOARD_WIDTH)
    && isFiniteIn(image.x, 0, BOARD_WIDTH - EDGE_GRAB)
    && isFiniteIn(image.y, 0, MAX_DRAWING_HEIGHT)
    && typeof image.createdAt === "number" && Number.isFinite(image.createdAt);
}

function isFiniteIn(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

/** Keeps an image reachable on the board whatever the drag or resize did. */
export function clampImage(image: FloatingImage): FloatingImage {
  const width = Math.round(Math.min(BOARD_WIDTH, Math.max(MIN_IMAGE_WIDTH, image.width)));
  return {
    ...image,
    width,
    x: Math.round(Math.min(BOARD_WIDTH - EDGE_GRAB, Math.max(0, image.x))),
    y: Math.round(Math.min(MAX_DRAWING_HEIGHT, Math.max(0, image.y))),
  };
}

/**
 * Moves image tokens left in the shared text by older versions onto the board,
 * roughly at the line they occupied. Safe to run on several clients at once:
 * images are keyed by attachment id and deleting the same text twice is a no-op.
 */
export function migrateLegacyImageTokens(
  text: Y.Text,
  images: Y.Map<FloatingImage>,
  authorId: string
): number {
  const content = text.toString();
  const found: { start: number; length: number; id: string; alt: string; line: number }[] = [];
  let offset = 0;
  for (const part of parseNoteParts(content)) {
    if (part.kind === "text") {
      offset += part.value.length;
      continue;
    }
    const token = `![${part.alt}](attachment:${part.id})`;
    const line = content.slice(0, offset).split("\n").length - 1;
    found.push({ start: offset, length: token.length, id: part.id, alt: part.alt, line });
    offset += token.length;
  }
  if (found.length === 0) return 0;

  const doc = text.doc;
  const apply = () => {
    for (const item of [...found].reverse()) {
      if (!images.has(item.id)) {
        images.set(item.id, clampImage({
          id: item.id,
          alt: item.alt,
          x: LEGACY_PADDING,
          y: LEGACY_PADDING + item.line * LEGACY_LINE_HEIGHT,
          width: DEFAULT_IMAGE_WIDTH,
          authorId,
          createdAt: Date.now(),
        }));
      }
      text.delete(item.start, item.length);
    }
  };
  if (doc) doc.transact(apply);
  else apply();
  return found.length;
}
