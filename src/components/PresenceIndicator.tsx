"use client";

import { motion, AnimatePresence } from "framer-motion";

interface PresenceUser {
  uid: string;
  displayName: string;
  photoURL: string | null;
  lastSeen: number;
}

interface PresenceIndicatorProps {
  users: PresenceUser[];
}

const AVATAR_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#0ea5e9",
  "#a855f7", "#ec4899", "#14b8a6", "#f97316", "#8b5cf6",
];

function getColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function PresenceIndicator({ users }: PresenceIndicatorProps) {
  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-2">
        <AnimatePresence>
          {users.slice(0, 5).map((user) => (
            <motion.div
              key={user.uid}
              initial={{ opacity: 0, scale: 0.5, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white shrink-0 relative overflow-hidden"
              style={{ backgroundColor: getColor(user.uid) }}
              title={user.displayName}
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                user.displayName?.charAt(0)?.toUpperCase() || "?"
              )}

              {/* Live indicator dot */}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {users.length > 5 && (
        <span className="text-xs text-foreground/40 font-medium ml-1">
          +{users.length - 5}
        </span>
      )}

      <span className="text-xs text-foreground/45 font-medium ml-2">
        {users.length === 1 ? "1 collaborator" : `${users.length} collaborators`} online
      </span>
    </div>
  );
}
