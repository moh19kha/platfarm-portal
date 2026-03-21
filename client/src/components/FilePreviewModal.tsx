// ══════════════════════════════════════════════════════════════════════════════
// FILE PREVIEW MODAL — Shows uploaded file (image or document) with download/replace
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useCallback } from "react";
import { C, FONT } from "@/lib/data";

interface FilePreviewModalProps {
  /** Base64-encoded file content (without data URI prefix) */
  base64Content: string;
  /** Label/title for the file */
  label: string;
  /** Whether the modal is loading */
  loading?: boolean;
  /** Close the modal */
  onClose: () => void;
  /** Trigger file replacement (opens file picker) */
  onReplace: () => void;
}

/**
 * Guess MIME type from base64 header bytes.
 * Falls back to application/octet-stream.
 */
function guessMimeType(base64: string): string {
  const prefix = base64.slice(0, 20);
  if (prefix.startsWith("/9j/")) return "image/jpeg";
  if (prefix.startsWith("iVBOR")) return "image/png";
  if (prefix.startsWith("R0lGOD")) return "image/gif";
  if (prefix.startsWith("UklGR")) return "image/webp";
  if (prefix.startsWith("JVBER")) return "application/pdf";
  return "application/octet-stream";
}

function getExtension(mime: string): string {
  if (mime.includes("jpeg")) return ".jpg";
  if (mime.includes("png")) return ".png";
  if (mime.includes("gif")) return ".gif";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("pdf")) return ".pdf";
  return "";
}

export function FilePreviewModal({ base64Content, label, loading, onClose, onReplace }: FilePreviewModalProps) {
  const mime = guessMimeType(base64Content);
  const isImage = mime.startsWith("image/");
  const dataUri = `data:${mime};base64,${base64Content}`;

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleDownload = () => {
    try {
      const ext = getExtension(mime);
      const safeName = label.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_");
      // Convert base64 to Blob for reliable download (data URI fails on large files)
      const byteChars = atob(base64Content);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeName}${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
      alert("Failed to download file");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "fadeIn .15s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.card, borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          maxWidth: "90vw", maxHeight: "90vh",
          display: "flex", flexDirection: "column",
          overflow: "hidden", minWidth: 320,
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px", borderBottom: `1px solid ${C.border}`,
          background: C.gBg,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.dark, fontFamily: FONT }}>
            {label}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 16, color: C.muted, padding: "2px 6px", borderRadius: 4,
              lineHeight: 1,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.dark)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: 16, flex: 1, overflow: "auto",
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: 200,
        }}>
          {loading ? (
            <div style={{ textAlign: "center", color: C.muted, fontSize: 11 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
              Loading file...
            </div>
          ) : isImage ? (
            <img
              src={dataUri}
              alt={label}
              style={{
                maxWidth: "100%", maxHeight: "70vh",
                borderRadius: 6, objectFit: "contain",
              }}
            />
          ) : mime === "application/pdf" ? (
            <iframe
              src={dataUri}
              title={label}
              style={{ width: "100%", height: "70vh", border: "none", borderRadius: 6 }}
            />
          ) : (
            <div style={{ textAlign: "center", color: C.muted, fontSize: 11 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              <div>File uploaded ({mime})</div>
              <div style={{ fontSize: 9, marginTop: 4 }}>Download to view this file type</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", gap: 8, padding: "10px 16px",
          borderTop: `1px solid ${C.border}`, justifyContent: "flex-end",
        }}>
          <button
            onClick={onReplace}
            style={{
              padding: "5px 14px", borderRadius: 5, fontSize: 10, fontWeight: 600,
              border: `1px solid ${C.border}`, background: C.card, color: C.gray,
              cursor: "pointer", fontFamily: FONT,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.gBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = C.card)}
          >
            Replace
          </button>
          <button
            onClick={handleDownload}
            style={{
              padding: "5px 14px", borderRadius: 5, fontSize: 10, fontWeight: 600,
              border: "none", background: C.forest, color: C.white,
              cursor: "pointer", fontFamily: FONT,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            ⬇ Download
          </button>
        </div>
      </div>
    </div>
  );
}
