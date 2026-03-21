import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlatfarmLogo } from "@/components/PlatfarmLogo";

export function ResetPassword() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const [, navigate] = useLocation();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = password === confirm;
  const isValid = password.length >= 8 && passwordsMatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setSuccess(true);
        // Redirect to home after 2 seconds (session cookie was set by server)
        setTimeout(() => navigate("/"), 2000);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[#F5F3EE] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-[#E8E5E0] p-8 max-w-md w-full text-center">
          <p className="text-red-600 font-medium">Invalid reset link.</p>
          <a href="/forgot-password" className="text-sm text-[#2D5A3D] hover:underline mt-4 block">
            Request a new one
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F3EE] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <PlatfarmLogo treeColor="#1B3A2D" textColor="#D4845F" height={32} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#E8E5E0] p-8">
          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-[#F0F7F2] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-[#2D5A3D]">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-[#1B3A2D] mb-2">Password updated!</h2>
              <p className="text-sm text-gray-500">
                Your password has been reset. You're now signed in — redirecting you to the portal…
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[#1B3A2D] mb-1">Set a new password</h2>
                <p className="text-sm text-gray-500">
                  Choose a strong password with at least 8 characters.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm font-medium text-[#1B3A2D]">
                    New password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    autoFocus
                    className="border-[#C8DFD0] focus-visible:ring-[#2D5A3D]"
                  />
                  {password.length > 0 && password.length < 8 && (
                    <p className="text-xs text-amber-600">Password must be at least 8 characters</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm" className="text-sm font-medium text-[#1B3A2D]">
                    Confirm new password
                  </Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    required
                    className="border-[#C8DFD0] focus-visible:ring-[#2D5A3D]"
                  />
                  {confirm.length > 0 && !passwordsMatch && (
                    <p className="text-xs text-red-600">Passwords do not match</p>
                  )}
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {error}
                    {error.includes("expired") || error.includes("Invalid") ? (
                      <span>
                        {" "}
                        <a href="/forgot-password" className="underline font-medium">
                          Request a new link
                        </a>
                      </span>
                    ) : null}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || !isValid}
                  className="w-full bg-[#D4845F] hover:bg-[#C0714A] text-white font-semibold"
                >
                  {loading ? "Updating…" : "Set New Password"}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Platfarm for Agritech and Agribusiness Ltd
        </p>
      </div>
    </div>
  );
}
