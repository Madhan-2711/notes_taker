"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Renders long lists in chunks: starts with `pageSize` items and adds another chunk whenever
 * the returned sentinel scrolls near the viewport. Resets when `resetKey` changes.
 */
export function useProgressiveCount(total: number, pageSize: number, resetKey: string) {
  const [state, setState] = useState({ key: resetKey, count: pageSize });
  const count = state.key === resetKey ? state.count : pageSize;
  const observer = useRef<IntersectionObserver | null>(null);

  const showMore = useCallback(() => {
    setState((previous) => ({ key: resetKey, count: (previous.key === resetKey ? previous.count : pageSize) + pageSize }));
  }, [resetKey, pageSize]);

  const sentinelRef = useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    if (!node || typeof IntersectionObserver === "undefined") return;
    observer.current = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) showMore();
    }, { rootMargin: "600px 0px" });
    observer.current.observe(node);
  }, [showMore]);

  useEffect(() => () => observer.current?.disconnect(), []);

  return { visible: Math.min(count, total), hasMore: count < total, showMore, sentinelRef };
}
