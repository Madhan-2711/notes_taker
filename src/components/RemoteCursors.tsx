"use client";

/**
 * RemoteCursors — shows where remote collaborators are typing.
 *
 * Instead of fragile pixel-based positioning over a textarea (which renders
 * text differently from any overlay element), this uses a simple line-based
 * approach: colored markers on the left edge showing which line each remote
 * user is on.
 */

import { useMemo } from "react";
import { type PresenceUser } from "../hooks/usePresence";

interface RemoteCursorsProps {
  /** Remote users with their cursor positions */
  users: PresenceUser[];
  /** Current text content for computing line numbers */
  content: string;
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

/** Get total line count */
function getLineCount(content: string): number {
  if (!content) return 1;
  let count = 1;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\n") count++;
  }
  return count;
}

export function RemoteCursors({ users, content }: RemoteCursorsProps) {
  const usersWithCursors = users.filter((u) => u.cursorPosition != null);
  const totalLines = getLineCount(content);

  // Compute which line each user is on
  const userLines = useMemo(() => {
    return usersWithCursors.map((user) => ({
      user,
      line: getLineFromOffset(content, user.cursorPosition ?? 0),
    }));
  }, [usersWithCursors, content]);

  if (userLines.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 mb-3">
      {userLines.map(({ user, line }) => (
        <div
          key={user.uid}
          className="flex items-center gap-2 text-xs font-semibold animate-pulse"
          style={{ color: user.cursorColor }}
        >
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: user.cursorColor }}
          />
          <span>
            {user.displayName.split(" ")[0]} is typing on line {line + 1}
            {totalLines > 1 && <span className="text-foreground/30 font-normal"> / {totalLines}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
