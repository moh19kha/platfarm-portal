/**
 * NotificationBell — Notification bell icon with dropdown panel + per-user preferences
 * Shows unread count badge and recent status change notifications.
 * Clicking a notification navigates to the shipment detail page.
 * Gear icon opens preferences panel to configure which stages trigger alerts.
 * Each user has their own preferences; falls back to global defaults if not configured.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { C, FONT, MONO, UNIFIED_STAGES } from "@/lib/data";
import { trpc } from "@/lib/trpc";
import { getStageColor } from "@/lib/stateLabels";

interface NotificationBellProps {
  onNavPurchaseDetail?: (id: number) => void;
  onNavSalesDetail?: (id: number) => void;
}

type View = "notifications" | "preferences";

export function NotificationBell({ onNavPurchaseDetail, onNavSalesDetail }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("notifications");
  const ref = useRef<HTMLDivElement>(null);

  // Fetch unread count (lightweight, polls every 30s)
  const { data: unreadData } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const unreadCount = unreadData?.count ?? 0;

  // Fetch notifications when panel is open
  const { data: notifData, refetch: refetchNotifs } = trpc.notifications.list.useQuery(
    { limit: 30, unreadOnly: false },
    { enabled: open && view === "notifications" }
  );

  // Fetch preferences when preferences panel is open
  const { data: prefsData, refetch: refetchPrefs } = trpc.notifications.getPreferences.useQuery(
    undefined,
    { enabled: open && view === "preferences" }
  );

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => { refetchNotifs(); },
  });

  const updatePrefsMutation = trpc.notifications.updatePreferences.useMutation({
    onSuccess: () => { refetchPrefs(); },
  });

  const resetPrefsMutation = trpc.notifications.resetPreferences.useMutation({
    onSuccess: () => { refetchPrefs(); },
  });

  // Local preferences state for editing
  const [localStages, setLocalStages] = useState<string[]>([]);
  const [localNotifyOwner, setLocalNotifyOwner] = useState(true);
  const [localNotifyInApp, setLocalNotifyInApp] = useState(true);
  const [prefsDirty, setPrefsDirty] = useState(false);

  // Sync local state when prefs data loads
  useEffect(() => {
    if (prefsData) {
      setLocalStages(prefsData.enabledStages);
      setLocalNotifyOwner(prefsData.notifyOwner);
      setLocalNotifyInApp(prefsData.notifyInApp);
      setPrefsDirty(false);
    }
  }, [prefsData]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setView("notifications");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleMarkAllRead = useCallback(() => {
    markReadMutation.mutate({ all: true });
  }, [markReadMutation]);

  const handleClickNotification = useCallback((n: {
    id: number;
    odooOrderId: number;
    orderType: string;
    read: boolean;
  }) => {
    if (!n.read) {
      markReadMutation.mutate({ ids: [n.id] });
    }
    if (n.orderType === "purchase" && onNavPurchaseDetail) {
      onNavPurchaseDetail(n.odooOrderId);
    } else if (n.orderType === "sales" && onNavSalesDetail) {
      onNavSalesDetail(n.odooOrderId);
    }
    setOpen(false);
    setView("notifications");
  }, [markReadMutation, onNavPurchaseDetail, onNavSalesDetail]);

  const toggleStage = useCallback((stage: string) => {
    setLocalStages(prev => {
      const next = prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage];
      setPrefsDirty(true);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setLocalStages(UNIFIED_STAGES.map(s => s.id));
    setPrefsDirty(true);
  }, []);

  const handleDeselectAll = useCallback(() => {
    setLocalStages([]);
    setPrefsDirty(true);
  }, []);

  const handleSavePrefs = useCallback(() => {
    updatePrefsMutation.mutate({
      enabledStages: localStages,
      notifyOwner: localNotifyOwner,
      notifyInApp: localNotifyInApp,
    });
    setPrefsDirty(false);
  }, [updatePrefsMutation, localStages, localNotifyOwner, localNotifyInApp]);

  const handleResetPrefs = useCallback(() => {
    resetPrefsMutation.mutate(undefined);
    setPrefsDirty(false);
  }, [resetPrefsMutation]);

  const notifications = notifData?.notifications ?? [];
  const isPersonal = prefsData?.isPersonal ?? false;

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  const stageColor = getStageColor;

  const enabledCount = localStages.length;
  const totalStages = UNIFIED_STAGES.length;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: "relative",
          width: 32, height: 32, borderRadius: 6,
          background: open ? C.gBg2 : "transparent",
          border: `1px solid ${open ? C.gBdr : "transparent"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "all .15s",
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = C.gBg; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = "transparent"; }}
        title="Notifications"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={open ? C.forest : C.gray} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <div style={{
            position: "absolute", top: 2, right: 2,
            minWidth: 14, height: 14, borderRadius: 7,
            background: C.terra, color: C.white,
            fontSize: 8, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 3px",
            border: `2px solid ${C.card}`,
            lineHeight: 1,
          }}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </div>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          width: 380, maxHeight: 520,
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
          boxShadow: "0 12px 40px rgba(0,0,0,0.15)", zIndex: 300,
          display: "flex", flexDirection: "column",
          animation: "fadeSlideDown .15s ease-out",
          fontFamily: FONT,
        }}>
          {/* Header */}
          <div style={{
            padding: "10px 14px", borderBottom: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {view === "preferences" && (
                <button
                  onClick={() => setView("notifications")}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    padding: "2px 4px", borderRadius: 4, display: "flex",
                    alignItems: "center", color: C.gray,
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = C.dark}
                  onMouseLeave={e => e.currentTarget.style.color = C.gray}
                  title="Back to notifications"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <span style={{ fontSize: 12, fontWeight: 700, color: C.dark }}>
                {view === "notifications" ? "Notifications" : "My Notification Settings"}
              </span>
              {view === "notifications" && unreadCount > 0 && (
                <span style={{
                  fontSize: 9, fontWeight: 600, color: C.white,
                  background: C.terra, borderRadius: 8,
                  padding: "1px 6px",
                }}>{unreadCount} new</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {view === "notifications" && unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  style={{
                    fontSize: 10, fontWeight: 600, color: C.forest,
                    background: "transparent", border: "none", cursor: "pointer",
                    padding: "2px 6px", borderRadius: 4,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.gBg}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  Mark all read
                </button>
              )}
              {view === "notifications" && (
                <button
                  onClick={() => setView("preferences")}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    padding: "4px", borderRadius: 4, display: "flex",
                    alignItems: "center", color: C.gray,
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = C.dark}
                  onMouseLeave={e => e.currentTarget.style.color = C.gray}
                  title="Notification settings"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto", maxHeight: 460 }}>
            {view === "notifications" ? (
              /* ── Notifications List ─────────────────────────────── */
              notifications.length === 0 ? (
                <div style={{
                  padding: "40px 20px", textAlign: "center",
                  color: C.muted, fontSize: 11,
                }}>
                  <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ display: "inline" }}>
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </div>
                  <div style={{ fontWeight: 600 }}>No notifications yet</div>
                  <div style={{ fontSize: 10, marginTop: 4 }}>
                    Status changes will appear here when shipments are updated
                  </div>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleClickNotification(n)}
                    style={{
                      padding: "10px 14px",
                      borderBottom: `1px solid ${C.border}`,
                      cursor: "pointer",
                      background: n.read ? "transparent" : C.gBg,
                      transition: "background .1s",
                      display: "flex", gap: 10, alignItems: "flex-start",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = n.read ? C.gBg : C.gBg2}
                    onMouseLeave={e => e.currentTarget.style.background = n.read ? "transparent" : C.gBg}
                  >
                    <div style={{
                      width: 6, height: 6, borderRadius: 3, flexShrink: 0,
                      marginTop: 5,
                      background: n.read ? "transparent" : C.terra,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, color: C.dark,
                          fontFamily: MONO,
                        }}>{n.orderName}</span>
                        <span style={{
                          fontSize: 8, fontWeight: 600,
                          color: n.orderType === "purchase" ? C.forest : C.terra,
                          background: n.orderType === "purchase" ? C.gBg2 : C.tBg,
                          border: `1px solid ${n.orderType === "purchase" ? C.gBdr : C.tBdr}`,
                          borderRadius: 3, padding: "1px 5px",
                          textTransform: "uppercase",
                        }}>{n.orderType === "purchase" ? "PO" : "SO"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                        <span style={{
                          color: stageColor(n.previousStatus),
                          fontWeight: 500,
                        }}>{n.previousStatus || "—"}</span>
                        <span style={{ color: C.muted, fontSize: 9 }}>→</span>
                        <span style={{
                          color: stageColor(n.newStatus),
                          fontWeight: 600,
                        }}>{n.newStatus}</span>
                      </div>
                      <div style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>
                        {formatTime(n.createdAt)}
                      </div>
                    </div>
                  </div>
                ))
              )
            ) : (
              /* ── Preferences Panel ─────────────────────────────── */
              <div style={{ padding: "12px 14px" }}>
                {/* Per-user indicator */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 10px", borderRadius: 6, marginBottom: 14,
                  background: isPersonal ? "#EFF6FF" : C.gBg,
                  border: `1px solid ${isPersonal ? "#BFDBFE" : C.gBdr}`,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isPersonal ? "#2563EB" : C.sage} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: isPersonal ? "#1E40AF" : C.dark }}>
                      {isPersonal ? "Your Personal Settings" : "Using Global Defaults"}
                    </div>
                    <div style={{ fontSize: 9, color: isPersonal ? "#3B82F6" : C.muted }}>
                      {isPersonal
                        ? "These settings are specific to your account"
                        : "Save to create your own personalized settings"}
                    </div>
                  </div>
                  {isPersonal && (
                    <button
                      onClick={handleResetPrefs}
                      disabled={resetPrefsMutation.isPending}
                      style={{
                        fontSize: 9, fontWeight: 600, color: "#DC2626",
                        background: "transparent", border: `1px solid #FECACA`,
                        borderRadius: 4, padding: "3px 8px", cursor: "pointer",
                        opacity: resetPrefsMutation.isPending ? 0.5 : 1,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "#FEF2F2"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      title="Reset to global defaults"
                    >
                      {resetPrefsMutation.isPending ? "..." : "Reset"}
                    </button>
                  )}
                </div>

                {/* Notification Channels */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, color: C.sage,
                    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8,
                  }}>Notification Channels</div>

                  <label style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px", borderRadius: 6,
                    background: C.gBg, border: `1px solid ${C.gBdr}`,
                    cursor: "pointer", marginBottom: 6,
                  }}>
                    <input
                      type="checkbox"
                      checked={localNotifyInApp}
                      onChange={() => { setLocalNotifyInApp(!localNotifyInApp); setPrefsDirty(true); }}
                      style={{ accentColor: C.forest, width: 14, height: 14 }}
                    />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.dark }}>In-App Notifications</div>
                      <div style={{ fontSize: 9, color: C.muted }}>Show in the notification bell dropdown</div>
                    </div>
                  </label>

                  <label style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px", borderRadius: 6,
                    background: C.gBg, border: `1px solid ${C.gBdr}`,
                    cursor: "pointer",
                  }}>
                    <input
                      type="checkbox"
                      checked={localNotifyOwner}
                      onChange={() => { setLocalNotifyOwner(!localNotifyOwner); setPrefsDirty(true); }}
                      style={{ accentColor: C.forest, width: 14, height: 14 }}
                    />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.dark }}>Owner Notifications</div>
                      <div style={{ fontSize: 9, color: C.muted }}>Send email/push to project owner</div>
                    </div>
                  </label>
                </div>

                {/* Stage Toggles */}
                <div>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 8,
                  }}>
                    <div style={{
                      fontSize: 9, fontWeight: 700, color: C.sage,
                      textTransform: "uppercase", letterSpacing: 0.8,
                    }}>
                      Notify on Stage Transitions ({enabledCount}/{totalStages})
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={handleSelectAll}
                        style={{
                          fontSize: 9, fontWeight: 600, color: C.forest,
                          background: "transparent", border: "none", cursor: "pointer",
                          padding: "1px 4px", borderRadius: 3,
                        }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                      >All</button>
                      <button
                        onClick={handleDeselectAll}
                        style={{
                          fontSize: 9, fontWeight: 600, color: C.gray,
                          background: "transparent", border: "none", cursor: "pointer",
                          padding: "1px 4px", borderRadius: 3,
                        }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                      >None</button>
                    </div>
                  </div>

                  <div style={{ fontSize: 9, color: C.muted, marginBottom: 10 }}>
                    When a shipment transitions <strong>to</strong> a checked stage, you will be notified.
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {UNIFIED_STAGES.map((stage) => {
                      const enabled = localStages.includes(stage.id);
                      const color = stageColor(stage.id);
                      return (
                        <label
                          key={stage.id}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "6px 10px", borderRadius: 5,
                            background: enabled ? C.gBg : "transparent",
                            border: `1px solid ${enabled ? C.gBdr : C.border}`,
                            cursor: "pointer", transition: "all .1s",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={() => toggleStage(stage.id)}
                            style={{ accentColor: C.forest, width: 13, height: 13 }}
                          />
                          <div style={{
                            width: 8, height: 8, borderRadius: 4,
                            background: color, flexShrink: 0,
                          }} />
                          <span style={{
                            fontSize: 11, fontWeight: enabled ? 600 : 500,
                            color: enabled ? C.dark : C.gray,
                          }}>{stage.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Save Button */}
                <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={handleSavePrefs}
                    disabled={!prefsDirty || updatePrefsMutation.isPending}
                    style={{
                      padding: "6px 16px", borderRadius: 6,
                      background: prefsDirty ? C.forest : C.gBg,
                      color: prefsDirty ? C.white : C.muted,
                      border: "none", cursor: prefsDirty ? "pointer" : "default",
                      fontSize: 11, fontWeight: 600,
                      transition: "all .15s",
                      opacity: updatePrefsMutation.isPending ? 0.6 : 1,
                    }}
                  >
                    {updatePrefsMutation.isPending ? "Saving..." : "Save My Preferences"}
                  </button>
                </div>

                {/* Success message */}
                {updatePrefsMutation.isSuccess && !prefsDirty && (
                  <div style={{
                    marginTop: 8, fontSize: 10, color: C.forest,
                    textAlign: "right", fontWeight: 500,
                  }}>
                    Your preferences saved successfully
                  </div>
                )}

                {/* Reset success message */}
                {resetPrefsMutation.isSuccess && !prefsDirty && !updatePrefsMutation.isSuccess && (
                  <div style={{
                    marginTop: 8, fontSize: 10, color: "#2563EB",
                    textAlign: "right", fontWeight: 500,
                  }}>
                    Reset to global defaults
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
