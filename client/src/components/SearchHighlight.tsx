// ══════════════════════════════════════════════════════════════════════════════
// SearchHighlight — Highlights matching search terms in text
// ══════════════════════════════════════════════════════════════════════════════

import React from "react";

interface HighlightProps {
  text: string | number | null | undefined;
  query: string;
  /** Background color for the highlight. Defaults to a warm amber. */
  bgColor?: string;
  /** Text color for the highlight. Defaults to dark. */
  textColor?: string;
}

/**
 * Renders text with the matching search query highlighted.
 * If query is empty or doesn't match, renders the text as-is.
 */
export function Highlight({ text, query, bgColor = "#FEF3C7", textColor = "#92400E" }: HighlightProps) {
  if (text == null || text === "") return null;
  const str = String(text);
  const q = query.trim().toLowerCase();

  if (!q || !str.toLowerCase().includes(q)) {
    return <>{str}</>;
  }

  const parts: React.ReactNode[] = [];
  let remaining = str;
  let key = 0;

  while (remaining.length > 0) {
    const idx = remaining.toLowerCase().indexOf(q);
    if (idx < 0) {
      parts.push(<React.Fragment key={key}>{remaining}</React.Fragment>);
      break;
    }
    if (idx > 0) {
      parts.push(<React.Fragment key={key}>{remaining.slice(0, idx)}</React.Fragment>);
      key++;
    }
    parts.push(
      <mark
        key={key}
        style={{
          background: bgColor,
          color: textColor,
          padding: "0 2px",
          borderRadius: 2,
          fontWeight: 600,
        }}
      >
        {remaining.slice(idx, idx + q.length)}
      </mark>
    );
    key++;
    remaining = remaining.slice(idx + q.length);
  }

  return <>{parts}</>;
}

/**
 * Helper: wraps a value with Highlight if there's a search query active.
 * Use this as a drop-in replacement for raw text in table cells.
 */
export function hl(value: string | number | null | undefined, query: string) {
  if (!query.trim() || value == null) return value ?? "";
  return <Highlight text={value} query={query} />;
}
