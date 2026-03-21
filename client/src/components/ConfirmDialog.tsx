/**
 * ConfirmDialog — Platfarm-styled confirmation dialog
 * Shows a modal asking the user to confirm before proceeding with a critical action.
 * Supports a `loading` prop that disables both buttons and shows a spinner on the confirm button.
 */
import { useState, useCallback, useEffect } from "react";
import { C, FONT } from "@/lib/data";
import { Btn } from "@/components/ui-primitives";
import type { ReactNode } from "react";

interface Props {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  icon?: ReactNode;
  /** When true, both buttons are disabled and a spinner shows on the confirm button */
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmColor = C.forest,
  icon,
  loading: externalLoading,
}: Props) {
  // Internal loading state: activates on confirm click, stays until dialog closes
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = externalLoading ?? internalLoading;

  const handleConfirm = useCallback(() => {
    if (isLoading) return;
    setInternalLoading(true);
    onConfirm();
  }, [isLoading, onConfirm]);

  const handleCancel = useCallback(() => {
    if (isLoading) return;
    onCancel();
  }, [isLoading, onCancel]);

  // Reset internal loading when dialog closes — use useEffect instead of setState during render
  useEffect(() => {
    if (!open) {
      setInternalLoading(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
      }}
      // Clicking outside does not close — use Cancel / Confirm buttons
    >
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(44,62,80,.5)",
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Dialog */}
      <div
        style={{
          position: "relative",
          background: C.card,
          borderRadius: 12,
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 20px 60px rgba(0,0,0,.22)",
          overflow: "hidden",
          animation: "confirmDialogIn .2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent bar */}
        <div
          style={{
            height: 3,
            background: `linear-gradient(90deg, ${confirmColor}, ${C.sage})`,
          }}
        />

        {/* Content */}
        <div style={{ padding: "24px 24px 20px" }}>
          {/* Icon + Title */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            {icon || (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: C.gBg2,
                  border: `1px solid ${C.gBdr}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                ⓘ
              </div>
            )}
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: C.dark,
                lineHeight: 1.3,
              }}
            >
              {title}
            </div>
          </div>

          {/* Message */}
          <div
            style={{
              fontSize: 12,
              color: C.gray,
              lineHeight: 1.6,
              marginLeft: 46,
            }}
          >
            {message}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: `1px solid ${C.border}`,
            background: C.gBg,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <Btn onClick={handleCancel} color={C.gray} outline disabled={isLoading}>
            {cancelLabel}
          </Btn>
          <Btn onClick={handleConfirm} color={confirmColor} disabled={isLoading}>
            {isLoading ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  style={{ animation: "confirmSpinner .7s linear infinite", flexShrink: 0 }}
                >
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                  <path
                    d="M12.5 7a5.5 5.5 0 0 0-5.5-5.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Creating...
              </span>
            ) : (
              confirmLabel
            )}
          </Btn>
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes confirmDialogIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
        @keyframes confirmSpinner {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
