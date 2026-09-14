"use client";

/**
 * Transparent drawing layer that overlays the collaborative text editor.
 *
 * - Renders every stroke from the shared `Y.Map<Stroke>` (so remote strokes
 *   appear the moment their encrypted update is applied to the doc).
 * - Captures Pointer Events only when a pen or eraser tool is active, so the
 *   text layer underneath stays fully interactive when the text tool is on.
 * - Commits a completed stroke to the map once, on pointer-up — not per move —
 *   to keep the number of synced updates small.
 */

import { useEffect, useRef, useCallback } from "react";
import type * as Y from "yjs";
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  ERASER_RADIUS,
  MAX_TOTAL_STROKE_POINTS,
  appendStrokePoint,
  drawStroke,
  hitTestStroke,
  isPenTool,
  isValidStroke,
  type DrawTool,
  type Stroke,
} from "../lib/drawing";

interface DrawingCanvasProps {
  strokes: Y.Map<Stroke> | null;
  canEdit: boolean;
  tool: DrawTool;
  color: string;
  size: number;
  authorId: string;
  scrollTop: number;
  onLimitReached: () => void;
}

export function DrawingCanvas({
  strokes,
  canEdit,
  tool,
  color,
  size,
  authorId,
  scrollTop,
  onLimitReached,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPointsRef = useRef<number[] | null>(null);
  const drawingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const scrollTopRef = useRef(scrollTop);

  // Live copies of the drawing config so the pointer handlers (attached once)
  // always read the current tool/color/size.
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const sizeRef = useRef(size);
  useEffect(() => {
    toolRef.current = tool;
    colorRef.current = color;
    sizeRef.current = size;
  }, [tool, color, size]);

  const sortedStrokes = useCallback((): Stroke[] => {
    if (!strokes) return [];
    const arr: Stroke[] = [];
    strokes.forEach((value) => {
      if (isValidStroke(value)) arr.push(value);
    });
    arr.sort((a, b) => a.createdAt - b.createdAt);
    return arr;
  }, [strokes]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    ctx.translate(0, -scrollTopRef.current);

    for (const stroke of sortedStrokes()) drawStroke(ctx, stroke);

    const pts = currentPointsRef.current;
    if (pts && isPenTool(toolRef.current) && pts.length >= 2) {
      drawStroke(ctx, {
        id: "__live__",
        tool: toolRef.current,
        color: colorRef.current,
        size: sizeRef.current,
        points: pts,
        authorId,
        createdAt: Date.now(),
      });
    }
  }, [sortedStrokes, authorId]);

  const scheduleRender = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      render();
    });
  }, [render]);

  useEffect(() => {
    scrollTopRef.current = scrollTop;
    scheduleRender();
  }, [scrollTop, scheduleRender]);

  // Size the backing store for crisp rendering and re-render on remote changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(BOARD_WIDTH * dpr);
    canvas.height = Math.round(BOARD_HEIGHT * dpr);
    render();

    if (!strokes) return;
    const onChange = () => scheduleRender();
    strokes.observe(onChange);
    return () => {
      strokes.unobserve(onChange);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [strokes, render, scheduleRender]);

  const toBoard = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * BOARD_WIDTH,
      y:
        ((e.clientY - rect.top) / rect.height) * BOARD_HEIGHT +
        scrollTopRef.current,
    };
  }, []);

  const eraseAt = useCallback(
    (x: number, y: number) => {
      if (!strokes) return;
      const id = hitTestStroke(sortedStrokes(), x, y, ERASER_RADIUS);
      if (id) strokes.delete(id);
    },
    [strokes, sortedStrokes]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!canEdit || !strokes || toolRef.current === "text") return;
      e.preventDefault();
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      drawingRef.current = true;
      const { x, y } = toBoard(e);

      if (toolRef.current === "eraser") {
        eraseAt(x, y);
        return;
      }
      currentPointsRef.current = [];
      appendStrokePoint(currentPointsRef.current, x, y);
      scheduleRender();
    },
    [canEdit, strokes, toBoard, eraseAt, scheduleRender]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drawingRef.current) return;
      const { x, y } = toBoard(e);
      if (toolRef.current === "eraser") {
        eraseAt(x, y);
        return;
      }
      const pts = currentPointsRef.current;
      if (pts) {
        if (appendStrokePoint(pts, x, y)) scheduleRender();
      }
    },
    [toBoard, eraseAt, scheduleRender]
  );

  const commit = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const pts = currentPointsRef.current;
    currentPointsRef.current = null;

    if (strokes && pts && isPenTool(toolRef.current) && pts.length >= 2) {
      const stroke: Stroke = {
        id: crypto.randomUUID(),
        tool: toolRef.current,
        color: colorRef.current,
        size: sizeRef.current,
        points: pts,
        authorId,
        createdAt: Date.now(),
      };
      const currentPointCount = sortedStrokes().reduce(
        (total, existingStroke) => total + existingStroke.points.length / 2,
        0
      );
      if (currentPointCount + pts.length / 2 > MAX_TOTAL_STROKE_POINTS) {
        onLimitReached();
      } else {
        strokes.set(stroke.id, stroke);
      }
    }
    scheduleRender();
  }, [strokes, authorId, scheduleRender, sortedStrokes, onLimitReached]);

  const active = canEdit && tool !== "text";

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={commit}
      onPointerCancel={commit}
      className="absolute inset-0 h-full w-full touch-none"
      style={{
        pointerEvents: active ? "auto" : "none",
        cursor:
          tool === "eraser"
            ? "cell"
            : isPenTool(tool)
              ? "crosshair"
              : "default",
      }}
    />
  );
}
