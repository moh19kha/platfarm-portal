import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Settings, User, Globe, Bell, DollarSign, Loader2, Save, Pencil, Lock, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: settings, isLoading, refetch } = trpc.property.settings.get.useQuery();
  const updateSettings = trpc.property.settings.update.useMutation({
    onSuccess: () => {
      toast.success("Settings saved successfully");
      refetch();
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileEditing, setProfileEditing] = useState(false);
  const utils = trpc.useUtils();
  const updateProfile = trpc.property.propAuth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully");
      setProfileEditing(false);
      utils.auth.me.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to update profile"),
  });

  const isAdmin = user?.role === "admin";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const changePassword = trpc.property.propAuth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => toast.error(err.message || "Failed to change password"),
  });

  const handleChangePassword = () => {
    if (!currentPassword) { toast.error("Please enter your current password"); return; }
    if (newPassword.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    changePassword.mutate({ currentPassword, newPassword });
  };

  const [defaultCurrency, setDefaultCurrency] = useState("AED");
  const [egpToAedRate, setEgpToAedRate] = useState("0.077");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [overdueAlerts, setOverdueAlerts] = useState(true);
  const [reminderDays, setReminderDays] = useState(7);

  // Load user profile
  useEffect(() => {
    if (user) {
      setProfileName(user.name || "");
      setProfileEmail(user.email || "");
    }
  }, [user]);

  // Load settings from DB
  useEffect(() => {
    if (settings) {
      setDefaultCurrency(settings.defaultCurrency || "AED");
      setEgpToAedRate(settings.egpToAedRate || "0.077");
      setEmailNotifications(settings.emailNotifications !== "off");
      setOverdueAlerts(settings.paymentReminders !== "off");
      setReminderDays(Number(settings.reminderDaysBefore) || 7);
    }
  }, [settings]);

  const handleSaveProfile = () => {
    updateProfile.mutate({
      name: profileName || undefined,
      email: profileEmail || "",
    });
  };

  const handleSave = () => {
    updateSettings.mutate({
      defaultCurrency: defaultCurrency as "AED" | "EGP" | "Aggregated",
      egpToAedRate,
      emailNotifications: emailNotifications ? "on" : "off",
      paymentReminders: overdueAlerts ? "on" : "off",
      reminderDaysBefore: reminderDays,
    });
  };

  const inputStyle = { border: "1px solid #D5D0C8", color: "#2C3E50" };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: "#2C3E50" }}>Settings</h1>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#2D5A3D" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: "#2C3E50" }}>Settings</h1>

      {/* Profile */}
      <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #E8E5E0" }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ background: "linear-gradient(to right, #2D5A3D, #4A7C59)" }}>
          <div className="flex items-center gap-2 text-white">
            <User className="h-4 w-4" />
            <h3 className="font-semibold text-sm">Profile</h3>
          </div>
          {!profileEditing && (
            <button
              onClick={() => setProfileEditing(true)}
              className="flex items-center gap-1 text-white/80 hover:text-white text-xs transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Name</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                readOnly={!profileEditing}
                className={`w-full mt-1 px-3 py-2 rounded-lg text-sm ${profileEditing ? 'bg-white ring-2 ring-[#4A7C59]/30' : 'bg-gray-50'}`}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Email</label>
              <input
                type="email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                readOnly={!profileEditing}
                placeholder="Enter your email"
                className={`w-full mt-1 px-3 py-2 rounded-lg text-sm ${profileEditing ? 'bg-white ring-2 ring-[#4A7C59]/30' : 'bg-gray-50'}`}
                style={inputStyle}
              />
            </div>
          </div>
          {profileEditing ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveProfile}
                disabled={updateProfile.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
                style={{ background: "#2D5A3D" }}
              >
                {updateProfile.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Profile
              </button>
              <button
                onClick={() => {
                  setProfileEditing(false);
                  setProfileName(user?.name || "");
                  setProfileEmail(user?.email || "");
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ color: "#666666", border: "1px solid #D5D0C8" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <p className="text-xs" style={{ color: "#666666" }}>Click "Edit" to update your name or email.</p>
          )}
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #E8E5E0" }}>
        <div className="px-5 py-3" style={{ background: "linear-gradient(to right, #2D5A3D, #4A7C59)" }}>
          <div className="flex items-center gap-2 text-white">
            <Lock className="h-4 w-4" />
            <h3 className="font-semibold text-sm">Change Password</h3>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Current Password</label>
            <div className="relative mt-1">
              <input
                type={showCurrentPw ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-3 py-2 rounded-lg text-sm pr-10"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "#666666" }}
              >
                {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>New Password</label>
              <div className="relative mt-1">
                <input
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full px-3 py-2 rounded-lg text-sm pr-10"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "#666666" }}
                >
                  {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
                style={inputStyle}
              />
            </div>
          </div>
          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs" style={{ color: "#C0714A" }}>Passwords do not match</p>
          )}
          <button
            onClick={handleChangePassword}
            disabled={changePassword.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
            style={{ background: "#2D5A3D" }}
          >
            {changePassword.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            Change Password
          </button>
        </div>
      </div>

      {/* Exchange Rate */}
      <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #E8E5E0" }}>
        <div className="px-5 py-3" style={{ background: "linear-gradient(to right, #C0714A, #D4956E)" }}>
          <div className="flex items-center gap-2 text-white">
            <DollarSign className="h-4 w-4" />
            <h3 className="font-semibold text-sm">Currency Conversion</h3>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>EGP to AED Exchange Rate</label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-medium" style={{ color: "#666666" }}>1 EGP =</span>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={egpToAedRate}
                  onChange={(e) => setEgpToAedRate(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg text-sm font-currency"
                  style={inputStyle}
                />
                <span className="text-sm font-medium" style={{ color: "#666666" }}>AED</span>
              </div>
              <p className="text-xs mt-1" style={{ color: "#666666" }}>
                Used for the "Aggregated (AED)" view on Dashboard, Payment Calendar, and Liability Forecast.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Default Currency View</label>
              <select value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                <option value="AED">AED - UAE Dirham</option>
                <option value="EGP">EGP - Egyptian Pound</option>
                <option value="Aggregated">Aggregated (AED)</option>
              </select>
            </div>
          </div>
          <div className="p-3 rounded-lg" style={{ background: "#FFF8F0", border: "1px solid #F0D4B8" }}>
            <p className="text-xs" style={{ color: "#C0714A" }}>
              <strong>Tip:</strong> When you select "Aggregated (AED)" on the Dashboard or Liability Forecast, all EGP amounts will be converted to AED using the rate above. Update this rate periodically to reflect current market conditions.
            </p>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #E8E5E0" }}>
        <div className="px-5 py-3" style={{ background: "linear-gradient(to right, #2D5A3D, #4A7C59)" }}>
          <div className="flex items-center gap-2 text-white">
            <Globe className="h-4 w-4" />
            <h3 className="font-semibold text-sm">Preferences</h3>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium" style={{ color: "#2C3E50" }}>Payment Reminder (days before due date)</label>
            <input
              type="number"
              min="1"
              max="30"
              value={reminderDays}
              onChange={(e) => setReminderDays(Number(e.target.value))}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #E8E5E0" }}>
        <div className="px-5 py-3" style={{ background: "linear-gradient(to right, #2D5A3D, #4A7C59)" }}>
          <div className="flex items-center gap-2 text-white">
            <Bell className="h-4 w-4" />
            <h3 className="font-semibold text-sm">Notifications</h3>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium" style={{ color: "#2C3E50" }}>Payment Reminders</div>
              <div className="text-xs" style={{ color: "#666666" }}>Get notified before upcoming payments</div>
            </div>
            <button
              onClick={() => setEmailNotifications(!emailNotifications)}
              className="relative w-11 h-6 rounded-full transition-colors"
              style={{ background: emailNotifications ? "#2D5A3D" : "#D5D0C8" }}
            >
              <div className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform" style={{ left: emailNotifications ? "calc(100% - 22px)" : "2px" }} />
            </button>
          </div>
          <div className="flex items-center justify-between" style={{ borderTop: "1px solid #E8E5E0", paddingTop: "1rem" }}>
            <div>
              <div className="text-sm font-medium" style={{ color: "#2C3E50" }}>Overdue Alerts</div>
              <div className="text-xs" style={{ color: "#666666" }}>Get alerts for overdue payments</div>
            </div>
            <button
              onClick={() => setOverdueAlerts(!overdueAlerts)}
              className="relative w-11 h-6 rounded-full transition-colors"
              style={{ background: overdueAlerts ? "#2D5A3D" : "#D5D0C8" }}
            >
              <div className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform" style={{ left: overdueAlerts ? "calc(100% - 22px)" : "2px" }} />
            </button>
          </div>
        </div>
      </div>

      {/* Save Button - only admin can change settings */}
      {isAdmin ? (
        <div className="flex justify-end pb-8">
          <button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="px-8 py-2.5 rounded-lg text-white text-sm font-medium transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
            style={{ background: "#2D5A3D" }}
          >
            {updateSettings.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : (
              "Save Settings"
            )}
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-lg mb-8" style={{ background: "#FFF8F0", border: "1px solid #F0D4B8" }}>
          <p className="text-sm" style={{ color: "#C0714A" }}>
            Settings can only be modified by the portfolio administrator. Contact the admin to request changes.
          </p>
        </div>
      )}
    </div>
  );
}
