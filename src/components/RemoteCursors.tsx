"use client";

/**
 * RemoteCursors — renders colored cursor indicators for remote collaborators.
 *
 * Works as an overlay on top of a <textarea>. Uses a hidden mirror <pre> to
 * compute the pixel position of each remote user's cursor from their character
 * offset, then renders a colored line + name label at that position.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { type PresenceUser } from "../hooks/usePresence";

interface RemoteCursorsProps {
  /** Remote users with their cursor positions */
  users: PresenceUser[];
  /** Current text content for measuring character positions */
  content: string;
  /** Ref to the textarea element to match its scroll state */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

interface CursorPixelPos {
  top: number;
  left: number;
}

export function RemoteCursors({ users, content, textareaRef }: RemoteCursorsProps) {
  const mirrorRef = useRef<HTMLPreElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Map<string, CursorPixelPos>>(new Map());

  // Compute pixel positions of each remote cursor
  const computePositions = useCallback(() => {
    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!textarea || !mirror) return;

    const styles = window.getComputedStyle(textarea);

    // Match the mirror to the textarea styling
    mirror.style.font = styles.font;
    mirror.style.letterSpacing = styles.letterSpacing;
    mirror.style.wordSpacing = styles.wordSpacing;
    mirror.style.lineHeight = styles.lineHeight;
    mirror.style.padding = styles.padding;
    mirror.style.width = `${textarea.clientWidth}px`;
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordWrap = "break-word";
    mirror.style.overflowWrap = "break-word";

    const newPositions = new Map<string, CursorPixelPos>();

    for (const user of users) {
      if (user.cursorPosition == null || user.cursorPosition < 0) continue;

      const pos = Math.min(user.cursorPosition, content.length);

      // Set mirror text up to cursor position with a marker span
      const before = content.slice(0, pos);
      const marker = document.createElement("span");
      marker.textContent = "\u200b"; // zero-width space

      mirror.textContent = "";
      mirror.appendChild(document.createTextNode(before));
      mirror.appendChild(marker);
      mirror.appendChild(document.createTextNode(content.slice(pos)));

      const markerRect = marker.getBoundingClientRect();
      const mirrorRect = mirror.getBoundingClientRect();

      const top = markerRect.top - mirrorRect.top - textarea.scrollTop;
      const left = markerRect.left - mirrorRect.left;

      newPositions.set(user.uid, { top, left });
    }

    setPositions(newPositions);
  }, [users, content, textareaRef]);

  // Recompute on content, user, or scroll changes
  useEffect(() => {
    computePositions();

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener("scroll", computePositions);
      return () => textarea.removeEventListener("scroll", computePositions);
    }
  }, [computePositions, textareaRef]);

  // Also recompute on resize
  useEffect(() => {
    const observer = new ResizeObserver(computePositions);
    if (textareaRef.current) observer.observe(textareaRef.current);
    return () => observer.disconnect();
  }, [computePositions, textareaRef]);

  const usersWithCursors = users.filter((u) => u.cursorPosition != null);
  if (usersWithCursors.length === 0) return null;

  return (
    <>
      {/* Hidden mirror pre to compute cursor pixel positions */}
      <pre
        ref={mirrorRef}
        aria-hidden
        className="absolute pointer-events-none opacity-0 top-0 left-0 overflow-hidden"
        style={{ zIndex: -1 }}
      />

      {/* Cursor indicators */}
      <div
        ref={containerRef}
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 10 }}
      >
        {usersWithCursors.map((user) => {
          const pos = positions.get(user.uid);
          if (!pos) return null;

          return (
            <div
              key={user.uid}
              className="absolute transition-all duration-150 ease-out"
              style={{ top: pos.top, left: pos.left }}
            >
              {/* Cursor line */}
              <div
                className="w-0.5 rounded-full"
                style={{
                  backgroundColor: user.cursorColor,
                  height: "1.5em",
                  animation: "pulse 1.2s ease-in-out infinite",
                }}
              />
              {/* Name label */}
              <div
                className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap shadow-sm"
                style={{ backgroundColor: user.cursorColor }}
              >
                {user.displayName.split(" ")[0]}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
