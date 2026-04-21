"use client";

import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { db, hasValidConfig } from "../../lib/firebaseConfig";
import { collection, addDoc } from "firebase/firestore";
import { noteSchema } from "../../lib/validations";
import { motion } from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";

export default function WritePage() {
  const { user, loading } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
        authorId: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await addDoc(collection(db, "notes"), newNote);
      setTitle("");
      setContent("");
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

        <div className="flex items-center justify-between mt-2 pt-4 border-t border-border/30">
          <div className="flex-1">
            {error && (
              <span className="text-sm text-red-500 font-medium">{error}</span>
            )}
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
