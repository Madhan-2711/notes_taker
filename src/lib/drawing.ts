/**
 * Drawing model for the collaborative whiteboard layer.
 *
 * Strokes live in a `Y.Map<Stroke>` inside the SAME Y.Doc as the note text, so
 * every change syncs through the existing encrypted `note_updates` pipeline.
 *
 * Coordinates are stored in a fixed logical board space (BOARD_WIDTH x
 * BOARD_HEIGHT). The whole board is uniformly scaled to fit each viewer's
 * screen, so the text wraps identically and ink lands in the same place for
 * everyone regardless of device — no per-client pan/zoom sync required.
 */

/** Fixed logical board dimensions, shared by every collaborator. */
export const BOARD_WIDTH = 1280;
export const BOARD_HEIGHT = 1810; // ~A-series ratio; tall enough for a page of notes
export const MAX_DRAWING_HEIGHT = 20_000;
export const MAX_STROKE_POINTS = 1_024;
export const MAX_TOTAL_STROKE_POINTS = 12_000;
export const MIN_POINT_DISTANCE = 1.5;

export type DrawTool = "text" | "pen" | "marker" | "highlighter" | "eraser";

/** A pen-type tool actually lays down ink. */
export type PenTool = "pen" | "marker" | "highlighter";

export interface Stroke {
  id: string;
  tool: PenTool;
  color: string;
  /** Line width in board units. */
  size: number;
  /** Flattened points: [x0, y0, x1, y1, ...] in board coordinates. */
  points: number[];
  authorId: string;
  createdAt: number;
}

/** Radius (board units) within which the eraser removes a stroke. */
export const ERASER_RADIUS = 10;

export const DEFAULT_COLORS = [
  "#1e293b", // slate
  "#ef4444", // red
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // violet
] as const;

/**
 * Per-pen render parameters. `size` and `color` are chosen per stroke; opacity
 * and blend mode are intrinsic to the pen type (a highlighter is translucent
 * and multiplies so it reads naturally over the text underneath).
 */
export const PEN_PRESETS: Record<
  PenTool,
  { defaultSize: number; opacity: number; blend: GlobalCompositeOperation }
> = {
  pen: { defaultSize: 3, opacity: 1, blend: "source-over" },
  marker: { defaultSize: 9, opacity: 1, blend: "source-over" },
  highlighter: { defaultSize: 24, opacity: 0.32, blend: "multiply" },
};

/** True when `tool` lays down ink (not the text/select or eraser tools). */
export function isPenTool(tool: DrawTool): tool is PenTool {
  return tool === "pen" || tool === "marker" || tool === "highlighter";
}

/** Validate decrypted collaborator data before it reaches the canvas API. */
export function isValidStroke(value: unknown): value is Stroke {
  if (!value || typeof value !== "object") return false;
  const stroke = value as Partial<Stroke>;
  if (
    typeof stroke.id !== "string" ||
    stroke.id.length === 0 ||
    stroke.id.length > 100 ||
    !isPenTool(stroke.tool as DrawTool) ||
    typeof stroke.color !== "string" ||
    !/^#[0-9a-f]{6}$/i.test(stroke.color) ||
    typeof stroke.size !== "number" ||
    !Number.isFinite(stroke.size) ||
    stroke.size < 1 ||
    stroke.size > 40 ||
    typeof stroke.authorId !== "string" ||
    stroke.authorId.length === 0 ||
    stroke.authorId.length > 128 ||
    typeof stroke.createdAt !== "number" ||
    !Number.isFinite(stroke.createdAt) ||
    !Array.isArray(stroke.points) ||
    stroke.points.length < 2 ||
    stroke.points.length % 2 !== 0 ||
    stroke.points.length > MAX_STROKE_POINTS * 2
  ) {
    return false;
  }

  for (let index = 0; index < stroke.points.length; index += 2) {
    const x = stroke.points[index];
    const y = stroke.points[index + 1];
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      x < 0 ||
      x > BOARD_WIDTH ||
      y < 0 ||
      y > MAX_DRAWING_HEIGHT
    ) {
      return false;
    }
  }

  return true;
}

/** Add a sampled point while keeping a single stroke bounded. */
export function appendStrokePoint(
  points: number[],
  x: number,
  y: number
): boolean {
  if (
    points.length >= MAX_STROKE_POINTS * 2 ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    x > BOARD_WIDTH ||
    y < 0 ||
    y > MAX_DRAWING_HEIGHT
  ) {
    return false;
  }

  if (points.length >= 2) {
    const previousX = points[points.length - 2];
    const previousY = points[points.length - 1];
    if (Math.hypot(x - previousX, y - previousY) < MIN_POINT_DISTANCE) {
      return false;
    }
  }

  points.push(x, y);
  return true;
}

/**
 * Render one stroke onto a 2D context that is already transformed into board
 * space (i.e. 1 unit === 1 board unit).
 */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  if (!isValidStroke(stroke)) return;
  const pts = stroke.points;
  const preset = PEN_PRESETS[stroke.tool];
  ctx.save();
  ctx.globalCompositeOperation = preset.blend;
  ctx.globalAlpha = preset.opacity;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // A single sampled point -> a dot.
  if (pts.length === 2) {
    ctx.beginPath();
    ctx.arc(pts[0], pts[1], stroke.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Smooth the polyline with quadratic curves through midpoints.
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length - 2; i += 2) {
    const midX = (pts[i] + pts[i + 2]) / 2;
    const midY = (pts[i + 1] + pts[i + 3]) / 2;
    ctx.quadraticCurveTo(pts[i], pts[i + 1], midX, midY);
  }
  ctx.lineTo(pts[pts.length - 2], pts[pts.length - 1]);
  ctx.stroke();
  ctx.restore();
}

/** Shortest distance from (px,py) to segment (x1,y1)-(x2,y2), in board units. */
export function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Return the id of the topmost stroke within `radius` of (x,y), or null.
 * `strokes` is expected in draw order (oldest first); the last match wins so
 * the eraser removes whatever is visually on top.
 */
export function hitTestStroke(
  strokes: Stroke[],
  x: number,
  y: number,
  radius: number
): string | null {
  for (let s = strokes.length - 1; s >= 0; s--) {
    const stroke = strokes[s];
    if (!isValidStroke(stroke)) continue;
    const pts = stroke.points;
    const tol = radius + stroke.size / 2;

    if (pts.length === 2) {
      if (Math.hypot(x - pts[0], y - pts[1]) <= tol) return stroke.id;
      continue;
    }
    for (let i = 0; i < pts.length - 2; i += 2) {
      if (distanceToSegment(x, y, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]) <= tol) {
        return stroke.id;
      }
    }
  }
  return null;
}
