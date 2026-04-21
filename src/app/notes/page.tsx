"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { db, hasValidConfig } from "../../lib/firebaseConfig";
import { collection, query, where, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { type Note } from "../../lib/validations";
import { NoteCard } from "../../components/NoteCard";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Calendar, X } from "lucide-react";
import Link from "next/link";

export default function NotesPage() {
  const { user, loading } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    if (!user || !hasValidConfig) {
      setNotes([]);
      return;
    }

    const q = query(
      collection(db, "notes"),
      where("authorId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Note[];
      fetchedNotes.sort((a, b) => b.createdAt - a.createdAt);
      setNotes(fetchedNotes);
    }, (error) => {
      console.error("Firestore error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const handleDeleteNote = async (id: string) => {
    if (!user || !hasValidConfig) return;
    try {
      await deleteDoc(doc(db, "notes", id));
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  // Group and filter notes by date
  const filteredNotes = useMemo(() => {
    if (!dateFilter) return notes;
    return notes.filter((note) => {
      const noteDate = new Date(note.createdAt).toISOString().split("T")[0];
      return noteDate === dateFilter;
    });
  }, [notes, dateFilter]);

  // Group notes by date for display
  const groupedNotes = useMemo(() => {
    const groups: Record<string, Note[]> = {};
    filteredNotes.forEach((note) => {
      const dateKey = new Date(note.createdAt).toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(note);
    });
    return groups;
  }, [filteredNotes]);

  // Get unique dates for the filter
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    notes.forEach((note) => {
      dates.add(new Date(note.createdAt).toISOString().split("T")[0]);
    });
    return Array.from(dates).sort().reverse();
  }, [notes]);

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
        <p className="text-foreground/60 text-lg">Please sign in to view your notes.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full p-6 mt-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
      >
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-foreground/50 hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            Home
          </Link>
          <div className="h-4 w-px bg-border"></div>
          <h1 className="text-2xl font-bold tracking-tight">My Notes</h1>
          <span className="text-sm text-foreground/40 font-medium">
            {filteredNotes.length} {filteredNotes.length === 1 ? "note" : "notes"}
          </span>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-foreground/40" />
          <div className="relative">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent border border-border/60 rounded-[var(--radius-xl)] px-4 py-2 text-sm font-medium focus:outline-none focus:border-primary transition-colors cursor-pointer"
            />
          </div>
          {dateFilter && (
            <button
              onClick={() => setDateFilter("")}
              className="flex items-center gap-1 text-xs font-medium text-foreground/50 hover:text-foreground bg-border/40 hover:bg-border/60 px-3 py-2 rounded-full transition-colors"
            >
              <X size={12} />
              Clear
            </button>
          )}
        </div>
      </motion.div>

      {/* Notes grouped by date */}
      {Object.keys(groupedNotes).length > 0 ? (
        <div className="space-y-10">
          {Object.entries(groupedNotes).map(([dateLabel, dateNotes]) => (
            <motion.section
              key={dateLabel}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="text-xs font-medium tracking-widest uppercase text-foreground/35 mb-5 flex items-center gap-3">
                <span>{dateLabel}</span>
                <span className="flex-1 h-px bg-border/50"></span>
                <span className="text-foreground/25">{dateNotes.length}</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                  {dateNotes.map((note) => (
                    <NoteCard key={note.id} note={note} onDelete={handleDeleteNote} />
                  ))}
                </AnimatePresence>
              </div>
            </motion.section>
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-24 text-center text-foreground/40 font-medium flex flex-col items-center gap-4"
        >
          <div className="w-16 h-16 border-2 border-dashed border-border rounded-full flex items-center justify-center">
            🍃
          </div>
          {dateFilter ? (
            <p>No notes found for this date.</p>
          ) : (
            <p>Your space is empty. Start writing to see your notes here.</p>
          )}
        </motion.div>
      )}
    </div>
  );
}
