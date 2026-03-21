// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENT SELECTOR — Pick Quotation / Invoice / Payment Receipt
// Renders inside QuotationsHome shell (no own nav/header)
// ══════════════════════════════════════════════════════════════════════════════

import { C, FONT } from "@/lib/data";

interface Props {
  onSelect: (type: "quotation" | "invoice" | "receipt") => void;
  onViewSaved: () => void;
}

const cards: { type: "quotation" | "invoice" | "receipt"; label: string; desc: string; cta: string; icon: string }[] = [
  {
    type: "quotation",
    label: "Quotation",
    desc: "Create a professional quotation with itemized products, pricing, and terms.",
    cta: "Create Quotation",
    icon: "📄",
  },
  {
    type: "invoice",
    label: "Invoice",
    desc: "Generate a professional invoice for completed orders with payment details.",
    cta: "Create Invoice",
    icon: "📋",
  },
  {
    type: "receipt",
    label: "Payment Receipt",
    desc: "Generate a professional payment receipt as proof of payment received.",
    cta: "Create Receipt",
    icon: "🧾",
  },
];

export default function DocumentSelector({ onSelect, onViewSaved }: Props) {
  return (
    <div>
      {/* Title area */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.dark, letterSpacing: -0.3, marginBottom: 4 }}>
          Create a Document
        </h2>
        <p style={{ fontSize: 11, color: C.muted }}>
          Select the type of document you want to generate
        </p>
      </div>

      {/* Cards */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14,
        maxWidth: 720, margin: "0 auto",
      }}>
        {cards.map(card => (
          <div
            key={card.type}
            onClick={() => onSelect(card.type)}
            style={{
              background: C.card, borderRadius: 10, padding: "20px 18px",
              border: `1px solid ${C.border}`, cursor: "pointer",
              display: "flex", flexDirection: "column", gap: 10,
              transition: "all .2s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = C.gBdr2;
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.06)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: C.gBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16,
            }}>
              {card.icon}
            </div>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 4 }}>{card.label}</h3>
              <p style={{ fontSize: 10, color: C.gray, lineHeight: 1.5 }}>{card.desc}</p>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 10, fontWeight: 600, color: C.terra, marginTop: "auto",
            }}>
              <span>{card.cta}</span>
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        ))}
      </div>

      {/* View saved link */}
      <div style={{ textAlign: "center", marginTop: 24 }}>
        <button
          onClick={onViewSaved}
          style={{
            background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6,
            padding: "6px 16px", fontSize: 10, fontWeight: 600, color: C.gray,
            cursor: "pointer", fontFamily: FONT, transition: "all .15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.gBdr2; e.currentTarget.style.color = C.forest; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.gray; }}
        >
          View Saved Documents →
        </button>
      </div>
    </div>
  );
}
