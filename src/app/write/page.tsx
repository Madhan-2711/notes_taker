"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { db, hasValidConfig } from "../../lib/firebaseConfig";
import { collection, addDoc, query, where, onSnapshot } from "firebase/firestore";
import { noteSchema, type Group } from "../../lib/validations";
import { addNotesToGroup } from "../../lib/groupsService";
import { motion } from "framer-motion";
import { ArrowLeft, Check, FolderOpen } from "lucide-react";
import Link from "next/link";

export default function WritePage() {
  const { user, loading } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Live-subscribe to user's groups for the multi-select
  useEffect(() => {
    if (!user || !hasValidConfig) return;
    const q = query(
      collection(db, "groups"),
      where("authorId", "==", user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Group[];
      data.sort((a, b) => a.title.localeCompare(b.title));
      setGroups(data);
    });
    return () => unsub();
  }, [user]);

  const handleToggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!user || !hasValidConfig) return;

    try {
      const validData = noteSchema.parse({ title, content });

      const newNote = {
        title: validData.title,
        content: validData.content,
        groupIds: selectedGroupIds,
        authorId: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const ref = await addDoc(collection(db, "notes"), newNote);

      // Link the note to each selected group
      if (selectedGroupIds.length > 0) {
        await Promise.all(
          selectedGroupIds.map((gid) => addNotesToGroup(gid, [ref.id]))
        );
      }

      setTitle("");
      setContent("");
      setSelectedGroupIds([]);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.errors?.[0]?.message || err.message || "Failed to create note");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto gap-4">
        <p className="text-foreground/60 text-lg">Please sign in to write notes.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full p-6 mt-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-8"
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-medium text-foreground/50 hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          Home
        </Link>
        <div className="h-4 w-px bg-border"></div>
        <h1 className="text-2xl font-bold tracking-tight">Write a Note</h1>
      </motion.div>

      {/* Write Form */}
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleCreateNote}
        className="glass neubrutal rounded-[var(--radius-xl)] p-8 flex flex-col gap-5"
      >
        <div>
          <label className="text-xs font-medium tracking-widest uppercase text-foreground/40 mb-2 block">
            Title
          </label>
          <input
            type="text"
            placeholder="Give your note a title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent text-xl font-bold placeholder:text-foreground/25 focus:outline-none border-b border-border/50 pb-3 focus:border-primary transition-colors"
            maxLength={100}
          />
        </div>

        <div>
          <label className="text-xs font-medium tracking-widest uppercase text-foreground/40 mb-2 block">
            Content
          </label>
          <textarea
            placeholder="Start writing your thoughts..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full bg-transparent min-h-[220px] resize-none focus:outline-none placeholder:text-foreground/25 leading-relaxed"
          />
        </div>

        {/* Group assignment */}
        {groups.length > 0 && (
          <div>
            <label className="text-xs font-medium tracking-widest uppercase text-foreground/40 mb-3 flex items-center gap-1.5">
              <FolderOpen size={11} />
              Add to Groups <span className="normal-case text-foreground/25">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => {
                const isSelected = selectedGroupIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleToggleGroup(g.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all duration-150 ${
                      isSelected
                        ? "text-white border-transparent shadow-sm"
                        : "bg-transparent border-border/50 text-foreground/50 hover:border-primary/40"
                    }`}
                    style={isSelected ? { backgroundColor: g.color, borderColor: g.color } : {}}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: isSelected ? "white" : g.color }}
                    />
                    {g.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-2 pt-4 border-t border-border/30">
          <div className="flex-1">
            {error && <span className="text-sm text-red-500 font-medium">{error}</span>}
            {success && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-sm text-accent font-medium flex items-center gap-2"
              >
                <Check size={16} /> Note saved successfully!
              </motion.span>
            )}
          </div>
          <button
            type="submit"
            disabled={!title.trim() || !content.trim()}
            className="bg-primary text-primary-foreground neubrutal px-8 py-2.5 rounded-[var(--radius-xl)] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            Post Note
          </button>
        </div>
      </motion.form>
    </div>
  );
}
