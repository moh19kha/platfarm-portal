/**
 * CreationProgressModal — Full-screen overlay modal that shows shipment creation progress.
 * Supports three states: loading (spinner), success (green checkmark), and error (red X).
 * Used across Purchase, Sales, and Multi-Linked wizards.
 */
import { C, FONT } from "@/lib/data";

interface CreationProgressModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Current progress message, e.g. "Creating Purchase for Abu Dhabi..." */
  message: string;
  /** Optional title — defaults to "Creating Shipment" */
  title?: string;
  /** Optional subtitle shown below the title */
  subtitle?: string;
  /** Optional list of completed steps */
  completedSteps?: string[];
  /** Optional error message — if set, shows error state */
  error?: string;
  /** Called when user clicks "Close" on error state */
  onErrorClose?: () => void;
  /** Whether creation succeeded — if true, shows success state with green checkmark */
  success?: boolean;
  /** Optional success message — defaults to "Shipment created successfully!" */
  successMessage?: string;
  /** Called when user clicks "OK" on success state. If not provided, shows auto-redirect hint. */
  onSuccessClose?: () => void;
  /** Optional list of created shipment details to display on success */
  createdShipmentDetails?: { label: string; id: string }[];
}

const keyframes = `
@keyframes creationSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes creationPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes creationFadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes creationDotBounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-6px); }
}
@keyframes successPop {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.15); }
  70% { transform: scale(0.95); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes successCheckDraw {
  0% { stroke-dashoffset: 30; }
  100% { stroke-dashoffset: 0; }
}
@keyframes successRingPulse {
  0% { box-shadow: 0 0 0 0 rgba(45,90,61,0.35); }
  70% { box-shadow: 0 0 0 18px rgba(45,90,61,0); }
  100% { box-shadow: 0 0 0 0 rgba(45,90,61,0); }
}
@keyframes successFadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

export function CreationProgressModal({
  visible,
  message,
  title = "Creating Shipment",
  subtitle,
  completedSteps = [],
  error,
  onErrorClose,
  success = false,
  successMessage = "Shipment created successfully!",
  onSuccessClose,
  createdShipmentDetails,
}: CreationProgressModalProps) {
  if (!visible) return null;

  const isSuccess = success && !error;
  const isError = !!error;
  const isLoading = !isSuccess && !isError;

  return (
    <>
      <style>{keyframes}</style>
      {/* Full-screen overlay */}
      <div style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(4px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        animation: "creationFadeIn 0.2s ease-out",
      }}>
        {/* Modal card */}
        <div style={{
          background: C.white,
          borderRadius: 16,
          padding: "36px 40px",
          minWidth: 380,
          maxWidth: 460,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)",
          animation: "creationFadeIn 0.3s ease-out",
          textAlign: "center",
        }}>
          {/* ── SUCCESS STATE ── */}
          {isSuccess && (
            <>
              {/* Success icon with pop animation */}
              <div style={{
                width: 72, height: 72,
                margin: "0 auto 20px",
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${C.forest}, ${C.sage})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "successPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, successRingPulse 1.5s ease-out 0.3s",
              }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline
                    points="20 6 9 17 4 12"
                    style={{
                      strokeDasharray: 30,
                      strokeDashoffset: 0,
                      animation: "successCheckDraw 0.4s ease-out 0.3s backwards",
                    }}
                  />
                </svg>
              </div>

              {/* Success title */}
              <h3 style={{
                fontSize: 18,
                fontWeight: 700,
                color: C.forest,
                margin: "0 0 8px",
                animation: "successFadeUp 0.4s ease-out 0.4s backwards",
              }}>
                {title === "Creating Shipment" ? "Shipment Created" : title.replace("Creating", "Created")}
              </h3>

              {/* Success message */}
              <p style={{
                fontSize: 13,
                color: C.sage,
                margin: "0 0 16px",
                fontWeight: 500,
                animation: "successFadeUp 0.4s ease-out 0.5s backwards",
              }}>
                {successMessage}
              </p>

              {/* Completed steps summary */}
              {completedSteps.length > 0 && (
                <div style={{
                  background: C.gBg,
                  border: `1px solid ${C.gBdr}`,
                  borderRadius: 10,
                  padding: "14px 18px",
                  margin: "0 0 16px",
                  animation: "successFadeUp 0.4s ease-out 0.6s backwards",
                }}>
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}>
                    {completedSteps.map((step, i) => (
                      <div key={i} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11,
                        color: C.sage,
                        fontWeight: 500,
                      }}>
                        <span style={{
                          width: 16, height: 16,
                          borderRadius: "50%",
                          background: C.forest,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Created shipment details */}
              {createdShipmentDetails && createdShipmentDetails.length > 0 && (
                <div style={{
                  background: C.gBg,
                  border: `1px solid ${C.gBdr}`,
                  borderRadius: 10,
                  padding: "14px 18px",
                  margin: "0 0 16px",
                  animation: "successFadeUp 0.4s ease-out 0.6s backwards",
                }}>
                  <div style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: C.sage,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    marginBottom: 8,
                  }}>Created Shipments</div>
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}>
                    {createdShipmentDetails.map((item, i) => (
                      <div key={i} style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.dark,
                        padding: "4px 0",
                        borderBottom: i < createdShipmentDetails.length - 1 ? `1px solid ${C.gBdr}` : "none",
                      }}>
                        <span style={{ color: C.sage, fontWeight: 500, fontSize: 11 }}>{item.label}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.forest, fontSize: 12 }}>{item.id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* OK button or auto-close hint */}
              {onSuccessClose ? (
                <button
                  onClick={onSuccessClose}
                  style={{
                    marginTop: 4,
                    padding: "10px 40px",
                    background: C.forest,
                    color: C.white,
                    border: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: FONT,
                    animation: "successFadeUp 0.4s ease-out 0.7s backwards",
                  }}
                >
                  OK
                </button>
              ) : (
                <p style={{
                  fontSize: 10,
                  color: C.light,
                  margin: "0",
                  fontWeight: 500,
                  animation: "successFadeUp 0.4s ease-out 0.7s backwards",
                }}>
                  Redirecting to shipment details...
                </p>
              )}
            </>
          )}

          {/* ── LOADING STATE ── */}
          {isLoading && (
            <>
              <div style={{
                width: 64, height: 64,
                margin: "0 auto 20px",
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${C.forest}, ${C.sage})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}>
                {/* Rotating ring */}
                <div style={{
                  position: "absolute",
                  inset: -4,
                  borderRadius: "50%",
                  border: `3px solid ${C.gBdr}`,
                  borderTopColor: C.forest,
                  animation: "creationSpin 1s linear infinite",
                }} />
                {/* Inner icon */}
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>

              {/* Title */}
              <h3 style={{
                fontSize: 18,
                fontWeight: 700,
                color: C.dark,
                margin: "0 0 6px",
              }}>
                {title}
              </h3>

              {/* Subtitle */}
              {subtitle && (
                <p style={{
                  fontSize: 12,
                  color: C.muted,
                  margin: "0 0 16px",
                  fontWeight: 500,
                }}>
                  {subtitle}
                </p>
              )}

              {/* Progress box */}
              <div style={{
                background: C.gBg,
                border: `1px solid ${C.gBdr}`,
                borderRadius: 10,
                padding: "14px 18px",
                margin: "12px 0 0",
              }}>
                {/* Current step message */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.forest,
                }}>
                  <span>{message || "Preparing..."}</span>
                  {/* Animated dots */}
                  <span style={{ display: "inline-flex", gap: 2 }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{
                        width: 4, height: 4,
                        borderRadius: "50%",
                        background: C.forest,
                        display: "inline-block",
                        animation: `creationDotBounce 1.2s ease-in-out ${i * 0.15}s infinite`,
                      }} />
                    ))}
                  </span>
                </div>

                {/* Completed steps */}
                {completedSteps.length > 0 && (
                  <div style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: `1px solid ${C.gBdr}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}>
                    {completedSteps.map((step, i) => (
                      <div key={i} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11,
                        color: C.sage,
                        fontWeight: 500,
                      }}>
                        <span style={{
                          width: 16, height: 16,
                          borderRadius: "50%",
                          background: C.sage,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                        {step}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tip text */}
              <p style={{
                fontSize: 10,
                color: C.light,
                margin: "14px 0 0",
                fontWeight: 500,
              }}>
                Please wait while we communicate with Odoo. Do not close this window.
              </p>
            </>
          )}

          {/* ── ERROR STATE ── */}
          {isError && (
            <>
              <div style={{
                width: 64, height: 64,
                margin: "0 auto 20px",
                borderRadius: "50%",
                background: C.rBg,
                border: `2px solid ${C.rBdr}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>

              {/* Error title */}
              <h3 style={{
                fontSize: 18,
                fontWeight: 700,
                color: C.red,
                margin: "0 0 6px",
              }}>
                Creation Failed
              </h3>

              {/* Error message */}
              <div style={{
                background: C.rBg,
                border: `1px solid ${C.rBdr}`,
                borderRadius: 8,
                padding: "12px 16px",
                margin: "12px 0 20px",
                fontSize: 12,
                color: C.red,
                lineHeight: 1.5,
                textAlign: "left",
                maxHeight: 120,
                overflow: "auto",
                wordBreak: "break-word",
              }}>
                {error}
              </div>

              {/* Completed steps before error */}
              {completedSteps.length > 0 && (
                <div style={{
                  background: C.gBg,
                  border: `1px solid ${C.gBdr}`,
                  borderRadius: 10,
                  padding: "10px 14px",
                  margin: "0 0 16px",
                }}>
                  <div style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: C.sage,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    marginBottom: 6,
                  }}>Completed before error:</div>
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}>
                    {completedSteps.map((step, i) => (
                      <div key={i} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 10,
                        color: C.sage,
                        fontWeight: 500,
                      }}>
                        <span style={{
                          width: 14, height: 14,
                          borderRadius: "50%",
                          background: C.sage,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error close button */}
              {onErrorClose && (
                <button
                  onClick={onErrorClose}
                  style={{
                    marginTop: 4,
                    padding: "8px 28px",
                    background: C.forest,
                    color: C.white,
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: FONT,
                  }}
                >
                  Close
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
