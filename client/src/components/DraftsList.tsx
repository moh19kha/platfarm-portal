/**
 * DraftsList — Shows saved drafts in the New Shipment dropdown
 */
import { C, MONO } from "@/lib/data";
import { trpc } from "@/lib/trpc";

interface DraftsListProps {
  onResume: (draftId: number, wizardType: string) => void;
  wizardTypes: string[];
}

const WIZARD_LABELS: Record<string, string> = {
  purchase: "Purchase",
  sales: "Sales",
  multi_linked: "Multi-Linked",
};

const STEP_LABELS: Record<string, string[]> = {
  purchase: ["", "Basic Info", "Product Lines", "Shipping"],
  sales: ["", "Basic Info", "Product Lines", "Shipping"],
  multi_linked: ["", "Companies", "Product Lines", "Shipping", "Review"],
};

export function DraftsList({ onResume, wizardTypes }: DraftsListProps) {
  const { data: drafts } = trpc.drafts.list.useQuery();
  const deleteMutation = trpc.drafts.delete.useMutation();
  const utils = trpc.useUtils();

  const filteredDrafts = (drafts || []).filter(d => wizardTypes.includes(d.wizardType));

  if (filteredDrafts.length === 0) return null;

  const handleDelete = async (e: React.MouseEvent, draftId: number) => {
    e.stopPropagation();
    try {
      await deleteMutation.mutateAsync({ id: draftId });
      utils.drafts.list.invalidate();
    } catch {}
  };

  return (
    <div>
      <div style={{
        padding: "6px 14px", background: C.gBg,
        borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{
          fontSize: 8, fontWeight: 700, color: C.sage,
          textTransform: "uppercase", letterSpacing: 0.8,
        }}>Saved Drafts</div>
      </div>
      <div style={{ maxHeight: 180, overflowY: "auto" }}>
        {filteredDrafts.map(draft => {
          const stepLabels = STEP_LABELS[draft.wizardType] || [];
          const stepName = stepLabels[draft.currentStep] || `Step ${draft.currentStep}`;
          const typeLabel = WIZARD_LABELS[draft.wizardType] || draft.wizardType;
          const timeAgo = getTimeAgo(new Date(draft.updatedAt));

          return (
            <div
              key={draft.id}
              onClick={() => onResume(draft.id, draft.wizardType)}
              style={{
                padding: "8px 14px", cursor: "pointer",
                borderBottom: `1px solid ${C.border}`,
                transition: "background .1s",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.gBg}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 10, fontWeight: 600, color: C.dark,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {draft.label}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                  <span style={{
                    fontSize: 8, fontFamily: MONO, color: C.white,
                    background: draft.wizardType === "purchase" ? C.forest : draft.wizardType === "sales" ? C.terra : C.sage,
                    padding: "1px 5px", borderRadius: 3,
                  }}>{typeLabel}</span>
                  <span style={{ fontSize: 8, color: C.muted }}>
                    {stepName} · {timeAgo}
                  </span>
                </div>
              </div>
              <div
                onClick={(e) => handleDelete(e, draft.id)}
                style={{
                  width: 18, height: 18, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: C.muted, fontSize: 12, flexShrink: 0,
                  marginLeft: 6, transition: "all .15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = C.red; e.currentTarget.style.background = "#fef2f2"; }}
                onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.background = "transparent"; }}
                title="Delete draft"
              >×</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
