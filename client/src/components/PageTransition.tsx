// ══════════════════════════════════════════════════════════════════════════════
// PageTransition — Smooth fade + slide animation wrapper for page switches
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";

interface PageTransitionProps {
  /** A key that changes when the page changes (e.g., the page name) */
  pageKey: string;
  /** The page content to render */
  children: ReactNode;
  /** Animation duration in ms (default: 220) */
  duration?: number;
  /** Animation type (default: "fade-slide") */
  type?: "fade" | "fade-slide" | "fade-scale";
}

/**
 * Wraps page content and animates transitions when `pageKey` changes.
 * Uses a two-phase approach:
 *   1. Old content fades out (quick)
 *   2. New content fades in with a subtle slide/scale
 */
export function PageTransition({
  pageKey,
  children,
  duration = 220,
  type = "fade-slide",
}: PageTransitionProps) {
  const [displayedKey, setDisplayedKey] = useState(pageKey);
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const [phase, setPhase] = useState<"idle" | "exit" | "enter">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    // Skip animation on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplayedKey(pageKey);
      setDisplayedChildren(children);
      return;
    }

    // If the key hasn't changed, just update children (e.g., props changed within same page)
    if (pageKey === displayedKey) {
      setDisplayedChildren(children);
      return;
    }

    // Key changed — start exit animation
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setPhase("exit");

    const exitDuration = Math.round(duration * 0.4); // Exit is faster
    const enterDuration = Math.round(duration * 0.6);

    timeoutRef.current = setTimeout(() => {
      // Swap to new content and start enter animation
      setDisplayedKey(pageKey);
      setDisplayedChildren(children);
      setPhase("enter");

      timeoutRef.current = setTimeout(() => {
        setPhase("idle");
      }, enterDuration);
    }, exitDuration);
  }, [pageKey, children, displayedKey, duration]);

  // Compute animation styles based on phase and type
  const getStyle = useCallback((): React.CSSProperties => {
    const base: React.CSSProperties = {
      willChange: "opacity, transform",
      transition: `opacity ${phase === "exit" ? Math.round(duration * 0.4) : Math.round(duration * 0.6)}ms ease, transform ${phase === "exit" ? Math.round(duration * 0.4) : Math.round(duration * 0.6)}ms ease`,
    };

    if (phase === "idle") {
      return { ...base, opacity: 1, transform: "none" };
    }

    if (phase === "exit") {
      switch (type) {
        case "fade":
          return { ...base, opacity: 0 };
        case "fade-scale":
          return { ...base, opacity: 0, transform: "scale(0.98)" };
        case "fade-slide":
        default:
          return { ...base, opacity: 0, transform: "translateY(6px)" };
      }
    }

    // enter phase
    switch (type) {
      case "fade":
        return { ...base, opacity: 0 };
      case "fade-scale":
        return { ...base, opacity: 0, transform: "scale(1.01)" };
      case "fade-slide":
      default:
        return { ...base, opacity: 0, transform: "translateY(-6px)" };
    }
  }, [phase, type, duration]);

  // Force a reflow after setting "enter" phase so the browser picks up the transition
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (phase === "enter" && containerRef.current) {
      // Force reflow
      void containerRef.current.offsetHeight;
      // Then immediately set to idle styles (the transition will animate)
      requestAnimationFrame(() => {
        setPhase("idle");
      });
    }
  }, [phase]);

  return (
    <div
      ref={containerRef}
      style={{
        ...getStyle(),
        width: "100%",
        height: "100%",
      }}
    >
      {displayedChildren}
    </div>
  );
}
