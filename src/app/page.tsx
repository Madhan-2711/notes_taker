"use client";

import { useAuth } from "../hooks/useAuth";
import { motion } from "framer-motion";
import { PenLine, BookOpen, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto gap-6">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">Thoughts, <span className="text-primary italic">Elevated.</span></h1>
        <p className="text-foreground/70 text-lg sm:text-xl">
          Welcome to Notes Taker. A highly secure, minimalist workspace designed for seamless note-taking without the clutter.
        </p>
        <p className="text-sm font-medium bg-secondary border px-4 py-2 rounded-[var(--radius-xl)] shadow-sm">
          Please sign in to access your dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-4xl mx-auto w-full">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-16"
      >
        <p className="text-sm font-medium tracking-widest uppercase text-foreground/40 mb-3">
          Welcome back
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          {user.displayName || "Writer"}
        </h1>
        <p className="text-foreground/50 mt-3 text-lg">
          What would you like to do today?
        </p>
      </motion.div>

      {/* Two Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full max-w-2xl">
        {/* Write Notes Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <Link href="/write" className="block group">
            <div className="glass neubrutal rounded-[var(--radius-xl)] p-8 flex flex-col items-center text-center gap-5 min-h-[260px] justify-center transition-all duration-300 group-hover:bg-primary/5">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
                <PenLine size={28} className="text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight mb-2">Write Notes</h2>
                <p className="text-foreground/50 text-sm leading-relaxed">
                  Capture your thoughts, ideas, and inspiration in a distraction-free space.
                </p>
              </div>
              <div className="flex items-center gap-2 text-primary font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Start Writing <ArrowRight size={16} />
              </div>
            </div>
          </Link>
        </motion.div>

        {/* View Notes Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Link href="/notes" className="block group">
            <div className="glass neubrutal rounded-[var(--radius-xl)] p-8 flex flex-col items-center text-center gap-5 min-h-[260px] justify-center transition-all duration-300 group-hover:bg-primary/5">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors duration-300">
                <BookOpen size={28} className="text-accent" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight mb-2">My Notes</h2>
                <p className="text-foreground/50 text-sm leading-relaxed">
                  Browse, search, and manage all your saved notes. Filter by date anytime.
                </p>
              </div>
              <div className="flex items-center gap-2 text-accent font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                View Notes <ArrowRight size={16} />
              </div>
            </div>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
