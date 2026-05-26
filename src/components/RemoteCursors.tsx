"use client";

/**
 * RemoteCursors — visual cursor indicators for remote collaborators.
 *
 * Renders colored bars on the left edge of the textarea at the line where
 * each remote user is typing. Uses the textarea's line-height to position
 * bars accurately without needing per-character pixel measurement.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { type PresenceUser } from "../hooks/usePresence";

interface RemoteCursorsProps {
  users: PresenceUser[];
  content: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

/** Convert character offset to line number (0-indexed) */
function getLineFromOffset(content: string, offset: number): number {
  const clampedOffset = Math.min(offset, content.length);
  let line = 0;
  for (let i = 0; i < clampedOffset; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

export function RemoteCursors({ users, content, textareaRef }: RemoteCursorsProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [lineHeight, setLineHeight] = useState(28); // default
  const [paddingTop, setPaddingTop] = useState(0);

  const usersWithCursors = users.filter((u) => u.cursorPosition != null);

  // Measure line height from textarea computed styles
  const measureStyles = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const styles = window.getComputedStyle(textarea);
    const lh = parseFloat(styles.lineHeight);
    if (!isNaN(lh) && lh > 0) setLineHeight(lh);

    const pt = parseFloat(styles.paddingTop);
    if (!isNaN(pt)) setPaddingTop(pt);
  }, [textareaRef]);

  // Track scroll position and measure on mount
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    measureStyles();

    const handleScroll = () => setScrollTop(textarea.scrollTop);
    textarea.addEventListener("scroll", handleScroll);

    const observer = new ResizeObserver(measureStyles);
    observer.observe(textarea);

    return () => {
      textarea.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, [textareaRef, measureStyles]);

  // Compute line positions for each user
  const userLines = useMemo(() => {
    return usersWithCursors.map((user) => ({
      user,
      line: getLineFromOffset(content, user.cursorPosition ?? 0),
    }));
  }, [usersWithCursors, content]);

  if (userLines.length === 0) return null;

  return (
    <div className="absolute left-0 top-0 bottom-0 w-full pointer-events-none overflow-hidden" style={{ zIndex: 5 }}>
      {userLines.map(({ user, line }) => {
        const top = paddingTop + line * lineHeight - scrollTop;

        // Don't render if scrolled out of view
        if (top < -lineHeight || top > 2000) return null;

        return (
          <div
            key={user.uid}
            className="absolute left-0 flex items-center transition-all duration-200 ease-out"
            style={{ top }}
          >
            {/* Colored bar on left edge */}
            <div
              className="w-[3px] rounded-full"
              style={{
                height: lineHeight,
                backgroundColor: user.cursorColor,
                opacity: 0.8,
              }}
            />
            {/* Name tag */}
            <div
              className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-white whitespace-nowrap shadow-sm"
              style={{
                backgroundColor: user.cursorColor,
                opacity: 0.9,
              }}
            >
              {user.displayName.split(" ")[0]}
            </div>
          </div>
        );
      })}
    </div>
  );
}
