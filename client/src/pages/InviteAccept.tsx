// Onboarding registration page for invited users.
// Route: /invite/:token
// The invited user lands here from the invitation email link.
// They enter their name and set a password — no Manus account needed.
// On success, they are logged in and redirected to the portal.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { C, FONT, MONO } from "@/lib/data";
import { trpc } from "@/lib/trpc";

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

type Step = "welcome" | "register" | "success";

export function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, isLoading, error: fetchError } = trpc.invitations.getByToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token, retry: false }
  );

  // ── Register handler ───────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Please enter your full name."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: name.trim(), password }),
        credentials: "include",
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Registration failed. Please try again.");
        return;
      }
      setStep("success");
      setTimeout(() => setLocation("/"), 2500);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={outerStyle}>
        <div style={cardStyle}>
          <div style={logoBarStyle}>
            <div style={logoIconStyle} />
            <span style={logoTextStyle}>PLATFARM</span>
          </div>
          <div style={{ textAlign: "center", padding: "48px 0", color: C.muted, fontFamily: FONT, fontSize: 14 }}>
            Verifying your invitation…
          </div>
        </div>
      </div>
    );
  }

  // ─── Error / Invalid token ────────────────────────────────────────────────
  if (fetchError || !data) {
    const msg = (fetchError as { message?: string })?.message ?? "This invitation is invalid or has expired.";
    return (
      <div style={outerStyle}>
        <div style={cardStyle}>
          <div style={logoBarStyle}>
            <div style={logoIconStyle} />
            <span style={logoTextStyle}>PLATFARM</span>
          </div>
          <div style={{ textAlign: "center", padding: "32px 24px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: C.dark, marginBottom: 8 }}>
              Invitation Unavailable
            </div>
            <div style={{ fontFamily: FONT, fontSize: 14, color: C.gray, lineHeight: 1.6, maxWidth: 320, margin: "0 auto" }}>
              {msg}
            </div>
            <div style={{ marginTop: 24, fontFamily: FONT, fontSize: 13, color: C.muted }}>
              Please contact your administrator to request a new invitation.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const roleLabel = data.role === "admin" ? "Administrator" : "Team Member";

  // ─── Success ──────────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div style={outerStyle}>
        <div style={cardStyle}>
          <div style={logoBarStyle}>
            <div style={logoIconStyle} />
            <span style={logoTextStyle}>PLATFARM</span>
          </div>
          <div style={{ textAlign: "center", padding: "48px 32px" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <div style={{ fontFamily: FONT, fontSize: 20, fontWeight: 800, color: C.dark, marginBottom: 8 }}>
              Account Created!
            </div>
            <div style={{ fontFamily: FONT, fontSize: 14, color: C.gray, lineHeight: 1.6 }}>
              Welcome to Platfarm. Redirecting you to the portal…
            </div>
            <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
              <div style={{ width: 32, height: 4, borderRadius: 2, background: C.forest, animation: "pulse 1s infinite" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Welcome step ─────────────────────────────────────────────────────────
  if (step === "welcome") {
    return (
      <div style={outerStyle}>
        <div style={cardStyle}>
          {/* Logo bar */}
          <div style={logoBarStyle}>
            <div style={logoIconStyle} />
            <div>
              <span style={logoTextStyle}>PLATFARM</span>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", marginTop: 2 }}>
                AGRITECH &amp; AGRIBUSINESS PLATFORM
              </div>
            </div>
          </div>

          <div style={{ padding: "32px 32px 28px" }}>
            {/* Welcome heading */}
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🌿</div>
              <h1 style={{ fontFamily: FONT, fontSize: 22, fontWeight: 800, color: C.dark, margin: "0 0 8px" }}>
                You're invited to Platfarm
              </h1>
              <p style={{ fontFamily: FONT, fontSize: 14, color: C.gray, margin: 0, lineHeight: 1.6 }}>
                <strong style={{ color: C.dark }}>{data.invitedBy ?? "A Platfarm administrator"}</strong>{" "}
                has invited you to join the platform as a{" "}
                <strong style={{ color: C.forest }}>{roleLabel}</strong>.
              </p>
            </div>

            {/* Email */}
            <div style={{
              background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8,
              padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <div>
                <div style={{ fontFamily: FONT, fontSize: 11, color: C.muted, marginBottom: 2 }}>YOUR ACCOUNT EMAIL</div>
                <div style={{ fontFamily: MONO, fontSize: 13, color: C.dark }}>{data.email}</div>
              </div>
            </div>

            {/* Expiry notice */}
            <div style={{
              background: C.aBg, border: `1px solid ${C.aBdr}`, borderRadius: 6,
              padding: "10px 14px", marginBottom: 28, display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 14 }}>⏰</span>
              <span style={{ fontFamily: FONT, fontSize: 12, color: C.amber }}>
                Invitation expires on <strong>{fmtDate(data.expiresAt)}</strong>
              </span>
            </div>

            {/* CTA */}
            <button
              onClick={() => setStep("register")}
              style={btnStyle(C.forest, C.forestHov)}
            >
              Create My Account →
            </button>

            <p style={{ fontFamily: FONT, fontSize: 11, color: C.muted, textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
              You will set your own password. No Manus account required.
            </p>
          </div>

          <div style={footerStyle}>
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>
              Platfarm for Agritech and Agribusiness Ltd &mdash; Abu Dhabi Global Market
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Register step ────────────────────────────────────────────────────────
  return (
    <div style={outerStyle}>
      <div style={cardStyle}>
        {/* Logo bar */}
        <div style={logoBarStyle}>
          <div style={logoIconStyle} />
          <div>
            <span style={logoTextStyle}>PLATFARM</span>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", marginTop: 2 }}>
              CREATE YOUR ACCOUNT
            </div>
          </div>
        </div>

        <div style={{ padding: "28px 32px 24px" }}>
          {/* Email display */}
          <div style={{
            background: C.gBg, border: `1px solid ${C.gBdr}`, borderRadius: 8,
            padding: "10px 14px", marginBottom: 24, display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 14 }}>📧</span>
            <div>
              <div style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>REGISTERING AS</div>
              <div style={{ fontFamily: MONO, fontSize: 13, color: C.dark, fontWeight: 600 }}>{data.email}</div>
            </div>
          </div>

          <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Full name */}
            <div>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Mohamed Al Rashidi"
                required
                autoFocus
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = C.forest; e.currentTarget.style.boxShadow = `0 0 0 3px ${C.gBg2}`; }}
                onBlur={e => { e.currentTarget.style.borderColor = C.inputBdr; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={labelStyle}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  style={{ ...inputStyle, paddingRight: 44 }}
                  onFocus={e => { e.currentTarget.style.borderColor = C.forest; e.currentTarget.style.boxShadow = `0 0 0 3px ${C.gBg2}`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = C.inputBdr; e.currentTarget.style.boxShadow = "none"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 13, fontFamily: FONT }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {/* Password strength indicator */}
              {password.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", gap: 4 }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{
                      height: 3, flex: 1, borderRadius: 2,
                      background: password.length >= i * 3
                        ? (password.length >= 12 ? C.forest : password.length >= 8 ? C.amber : "#e0e0e0")
                        : "#e0e0e0",
                      transition: "background 0.2s",
                    }} />
                  ))}
                  <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, marginLeft: 4 }}>
                    {password.length < 8 ? "Too short" : password.length < 12 ? "Good" : "Strong"}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                required
                style={{
                  ...inputStyle,
                  borderColor: confirmPassword && confirmPassword !== password ? C.red : C.inputBdr,
                }}
                onFocus={e => { e.currentTarget.style.borderColor = C.forest; e.currentTarget.style.boxShadow = `0 0 0 3px ${C.gBg2}`; }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = confirmPassword && confirmPassword !== password ? C.red : C.inputBdr;
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              {confirmPassword && confirmPassword !== password && (
                <div style={{ fontFamily: FONT, fontSize: 12, color: C.red, marginTop: 4 }}>Passwords do not match</div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: C.rBg, border: `1px solid ${C.rBdr}`, borderRadius: 6,
                padding: "10px 14px", fontFamily: FONT, fontSize: 13, color: C.red,
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={btnStyle(isSubmitting ? C.muted : C.forest, isSubmitting ? C.muted : C.forestHov)}
            >
              {isSubmitting ? "Creating Account…" : "Create Account & Sign In →"}
            </button>
          </form>

          <button
            onClick={() => setStep("welcome")}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: FONT, fontSize: 12, color: C.muted, marginTop: 12, display: "block", width: "100%", textAlign: "center" }}
          >
            ← Back
          </button>
        </div>

        <div style={footerStyle}>
          <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>
            Platfarm for Agritech and Agribusiness Ltd &mdash; Abu Dhabi Global Market
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const outerStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: `linear-gradient(135deg, #1B3A2D 0%, #2D5A3D 50%, #3A7350 100%)`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  fontFamily: FONT,
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 460,
  background: "#fff",
  borderRadius: 16,
  overflow: "hidden",
  boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
};

const logoBarStyle: React.CSSProperties = {
  background: C.forest,
  padding: "20px 32px",
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const logoIconStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  background: C.terra,
  borderRadius: 8,
  flexShrink: 0,
};

const logoTextStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 20,
  fontWeight: 800,
  color: "#fff",
  letterSpacing: "-0.5px",
};

const footerStyle: React.CSSProperties = {
  borderTop: `1px solid ${C.border}`,
  padding: "14px 32px",
  textAlign: "center",
  background: C.pageBg,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: FONT,
  fontSize: 12,
  fontWeight: 600,
  color: C.dark,
  marginBottom: 6,
  letterSpacing: "0.02em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: `1.5px solid ${C.inputBdr}`,
  borderRadius: 8,
  fontFamily: FONT,
  fontSize: 14,
  color: C.dark,
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const btnStyle = (bg: string, hover: string): React.CSSProperties => ({
  width: "100%",
  padding: "13px 0",
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  background: bg,
  color: "#fff",
  fontFamily: FONT,
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "0.01em",
  transition: "background 0.15s",
});
