// Platfarm Portal — Login page for returning users with email/password accounts.
// Route: /login
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { C, FONT } from "@/lib/data";
import { PlatfarmLogo } from "@/components/PlatfarmLogo";

// Old inline PlatfarmLogo was removed (had incorrect SVG paths).
// Now using the shared PlatfarmLogo component from @/components/PlatfarmLogo.

// ─── Login Component ──────────────────────────────────────────────────────────
export function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already logged in, redirect to portal
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(user => { if (user?.id) setLocation("/"); })
      .catch(() => {});
  }, [setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) { setError("Please enter your email and password."); return; }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
        credentials: "include",
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Login failed. Please try again.");
        return;
      }
      // Set session flag so ModuleLauncher skips login phase on load
      sessionStorage.setItem('platfarm_signed_in', '1');
      // Reload to trigger auth context refresh
      window.location.href = "/";
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={outerStyle}>
      {/* Left panel — branding */}
      <div style={leftPanelStyle}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ marginBottom: 32 }}>
            <PlatfarmLogo treeColor="rgba(255,255,255,0.85)" textColor="#fff" height={38} />
          </div>
          <h2 style={{ fontFamily: FONT, fontSize: 28, fontWeight: 800, color: "#fff", lineHeight: 1.3, margin: "0 0 16px" }}>
            Your integrated<br />agribusiness platform
          </h2>
          <p style={{ fontFamily: FONT, fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, margin: 0 }}>
            Manage shipments, HR, financials, and operations across UAE and Egypt from a single portal.
          </p>
        </div>

        {/* Feature list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { icon: "🚢", label: "Purchase & Sales Shipments" },
            { icon: "👥", label: "HR & Workforce Management" },
            { icon: "💰", label: "Finance & Invoicing" },
            { icon: "📦", label: "Inventory & Warehouse" },
          ].map(f => (
            <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, background: "rgba(255,255,255,0.1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                {f.icon}
              </div>
              <span style={{ fontFamily: FONT, fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{f.label}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "auto", paddingTop: 40 }}>
          <div style={{ fontFamily: FONT, fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
            Platfarm for Agritech and Agribusiness Ltd<br />
            Abu Dhabi Global Market · UAE &amp; Egypt
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div style={rightPanelStyle}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          {/* Logo on right panel (visible on mobile / small screens) */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
            <PlatfarmLogo treeColor="#1B3A2D" textColor="#D4845F" height={30} />
          </div>

          <h1 style={{ fontFamily: FONT, fontSize: 24, fontWeight: 800, color: C.dark, margin: "0 0 6px" }}>
            Welcome back
          </h1>
          <p style={{ fontFamily: FONT, fontSize: 14, color: C.gray, margin: "0 0 32px" }}>
            Sign in to your Platfarm account
          </p>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Email */}
            <div>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@platfarm.com"
                required
                autoFocus
                autoComplete="email"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = C.forest; e.currentTarget.style.boxShadow = `0 0 0 3px ${C.gBg2}`; }}
                onBlur={e => { e.currentTarget.style.borderColor = C.inputBdr; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            {/* Password */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
                <a
                  href="/forgot-password"
                  style={{ fontSize: 12, color: C.forest, textDecoration: "none", fontFamily: FONT, fontWeight: 500 }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
                >
                  Forgot password?
                </a>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  autoComplete="current-password"
                  style={{ ...inputStyle, paddingRight: 52 }}
                  onFocus={e => { e.currentTarget.style.borderColor = C.forest; e.currentTarget.style.boxShadow = `0 0 0 3px ${C.gBg2}`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = C.inputBdr; e.currentTarget.style.boxShadow = "none"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.muted, fontFamily: FONT, fontSize: 12, padding: "4px 6px" }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: C.rBg, border: `1px solid ${C.rBdr}`, borderRadius: 8,
                padding: "10px 14px", fontFamily: FONT, fontSize: 13, color: C.red,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                background: isSubmitting ? C.muted : C.forest,
                color: "#fff", fontFamily: FONT, fontSize: 15, fontWeight: 700,
                letterSpacing: "0.01em", transition: "background 0.15s",
              }}
            >
              {isSubmitting ? "Signing In…" : "Sign In →"}
            </button>
          </form>

          <p style={{ fontFamily: FONT, fontSize: 12, color: C.muted, textAlign: "center", marginTop: 24, lineHeight: 1.6 }}>
            Don't have an account?{" "}
            <span style={{ color: C.forest }}>Contact your administrator to receive an invitation.</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const outerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  fontFamily: FONT,
};

const leftPanelStyle: React.CSSProperties = {
  width: 380,
  flexShrink: 0,
  background: `linear-gradient(160deg, ${C.forest} 0%, #1B3A2D 100%)`,
  padding: "48px 40px",
  display: "flex",
  flexDirection: "column",
};

const rightPanelStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "48px 32px",
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
  padding: "11px 14px",
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
