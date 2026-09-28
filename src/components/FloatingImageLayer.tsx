"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type * as Y from "yjs";
import { X } from "lucide-react";
import { BOARD_WIDTH } from "../lib/drawing";
import { clampImage, isValidFloatingImage, type FloatingImage } from "../lib/floatingImages";
import { useAttachmentImageUrl } from "../hooks/useAttachmentImageUrl";

interface FloatingImageLayerProps {
  images: Y.Map<FloatingImage> | null;
  noteId: string;
  userId: string;
  privateKey: CryptoKey | null;
  movable: boolean;
  scrollTop: number;
}

type Drag = { id: string; mode: "move" | "resize"; startX: number; startY: number; original: FloatingImage };

function Picture({ image, noteId, userId, privateKey }: { image: FloatingImage; noteId: string; userId: string; privateKey: CryptoKey | null }) {
  const { url, error } = useAttachmentImageUrl(noteId, userId, privateKey, image.id, image.alt);
  if (!url) {
    return <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
      {error ? "Image unavailable" : "Loading image…"}
    </div>;
  }
  return <Image src={url} alt={image.alt || "Note image"} width={image.width} height={Math.round(image.width * 0.75)} unoptimized draggable={false} className="block h-auto w-full select-none rounded-xl" />;
}

export function FloatingImageLayer({ images, noteId, userId, privateKey, movable, scrollTop }: FloatingImageLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [items, setItems] = useState<FloatingImage[]>([]);
  const [draft, setDraft] = useState<FloatingImage | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!images) return;
    const sync = () => {
      const next: FloatingImage[] = [];
      images.forEach((value) => { if (isValidFloatingImage(value)) next.push(value); });
      next.sort((a, b) => a.createdAt - b.createdAt);
      setItems(next);
    };
    sync();
    images.observe(sync);
    return () => images.unobserve(sync);
  }, [images]);

  const boardScale = () => (layerRef.current?.getBoundingClientRect().width ?? BOARD_WIDTH) / BOARD_WIDTH;

  const startDrag = (event: React.PointerEvent, image: FloatingImage, mode: Drag["mode"]) => {
    if (!movable) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    setSelectedId(image.id);
    dragRef.current = { id: image.id, mode, startX: event.clientX, startY: event.clientY, original: image };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const scale = boardScale();
    const dx = (event.clientX - drag.startX) / scale;
    const dy = (event.clientY - drag.startY) / scale;
    setDraft(clampImage(drag.mode === "move"
      ? { ...drag.original, x: drag.original.x + dx, y: drag.original.y + dy }
      : { ...drag.original, width: drag.original.width + dx }));
  };

  const finishDrag = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && draft && draft.id === drag.id && images?.has(drag.id)) images.set(drag.id, draft);
    setDraft(null);
  };

  const remove = useCallback((id: string) => {
    images?.delete(id);
    setSelectedId(null);
  }, [images]);

  const onKeyDown = (event: React.KeyboardEvent, image: FloatingImage) => {
    if (!movable || !images) return;
    const step = event.shiftKey ? 40 : 10;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      remove(image.id);
    } else if (moves[event.key]) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      images.set(image.id, clampImage({ ...image, x: image.x + dx, y: image.y + dy }));
    }
  };

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      <div style={{ transform: `translateY(${-scrollTop}px)` }}>
        {items.map((stored) => {
          const image = draft?.id === stored.id ? draft : stored;
          const selected = movable && selectedId === image.id;
          return (
            <div
              key={image.id}
              role={movable ? "button" : undefined}
              tabIndex={movable ? 0 : -1}
              aria-label={movable ? `${image.alt || "Picture"}: drag to move, arrow keys to nudge, Delete to remove` : undefined}
              onPointerDown={(event) => startDrag(event, stored, "move")}
              onPointerMove={onPointerMove}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
              onFocus={() => movable && setSelectedId(image.id)}
              onKeyDown={(event) => onKeyDown(event, stored)}
              className={`absolute touch-none rounded-xl ${movable ? "pointer-events-auto cursor-move" : ""} ${selected ? "outline-3 outline-offset-2 outline-indigo-500" : ""}`}
              style={{ left: image.x, top: image.y, width: image.width }}
            >
              <Picture image={image} noteId={noteId} userId={userId} privateKey={privateKey} />
              {selected && (
                <>
                  <button
                    type="button"
                    aria-label={`Remove ${image.alt || "picture"} from the page`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => remove(image.id)}
                    className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                  >
                    <X size={18} />
                  </button>
                  <span
                    aria-hidden
                    onPointerDown={(event) => startDrag(event, stored, "resize")}
                    onPointerMove={onPointerMove}
                    onPointerUp={finishDrag}
                    onPointerCancel={finishDrag}
                    className="absolute -bottom-3 -right-3 h-7 w-7 cursor-nwse-resize rounded-full border-4 border-white bg-indigo-500 shadow-md"
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
