import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";

/** Robust copy-to-clipboard helper — always uses textarea fallback for reliability */
function copyText(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Always use textarea fallback — clipboard API can fail in tooltips/overlays
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "-9999px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length); // iOS fix
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) { resolve(true); return; }
    } catch { /* fallback failed, try clipboard API */ }
    // Try clipboard API as secondary
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => resolve(true)).catch(() => resolve(false));
    } else {
      resolve(false);
    }
  });
}

/** Small "Copied!" flash indicator */
function CopiedFlash({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="text-[10px] font-semibold text-green-600 ml-1 animate-pulse">
      Copied!
    </span>
  );
}

interface RefTooltipProps {
  refs: string[];
  children: ReactNode;
  label?: string;
  className?: string;
}

/**
 * Drill-down tooltip that shows a scrollable list of references on hover.
 * Click individual refs to copy, or use the "Copy All" button.
 */
export function RefTooltip({ refs, children, label, className = "" }: RefTooltipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);

  const show = () => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      left: Math.max(8, rect.left + rect.width / 2 - 140),
    });
    setOpen(true);
  };

  const hide = () => {
    timeoutRef.current = window.setTimeout(() => {
      setOpen(false);
      setCopiedIdx(null);
      setCopiedAll(false);
    }, 200);
  };

  const keepOpen = () => { if (timeoutRef.current !== null) clearTimeout(timeoutRef.current); };

  const handleCopyOne = useCallback(async (ref: string, idx: number) => {
    const ok = await copyText(ref);
    if (ok) {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1200);
    }
  }, []);

  const handleCopyAll = useCallback(async () => {
    const text = refs.join("\n");
    const ok = await copyText(text);
    if (ok) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
    }
  }, [refs]);

  useEffect(() => {
    if (!open || !tooltipRef.current) return;
    const el = tooltipRef.current;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      setPos(prev => prev ? { ...prev, left: window.innerWidth - rect.width - 8 } : prev);
    }
    if (rect.bottom > window.innerHeight - 8) {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (triggerRect) {
        setPos(prev => prev ? { ...prev, top: triggerRect.top - rect.height - 6 } : prev);
      }
    }
  }, [open]);

  if (!refs || refs.length === 0) return <>{children}</>;

  return (
    <span
      ref={triggerRef}
      className={`cursor-pointer ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      style={{ position: "relative", display: "inline-block", borderBottom: "1px dashed currentColor", paddingBottom: 1 }}
    >
      {children}
      {open && pos && (
        <div
          ref={tooltipRef}
          onMouseEnter={keepOpen}
          onMouseLeave={hide}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
          }}
          className="bg-popover text-popover-foreground border border-border rounded-lg shadow-xl w-[280px] max-h-[320px] overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-border bg-muted/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {label || "References"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-xs font-mono text-muted-foreground">
                  {refs.length} {refs.length === 1 ? "record" : "records"}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopyAll(); }}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-accent/60 hover:bg-accent text-accent-foreground transition-colors cursor-pointer"
                  title="Copy all references"
                >
                  {copiedAll ? `✓ ${refs.length} copied` : "Copy All"}
                </button>
              </span>
            </div>
          </div>
          <div className="overflow-y-auto max-h-[260px] p-1.5">
            {refs.map((ref, i) => (
              <div
                key={`${ref}-${i}`}
                onClick={(e) => { e.stopPropagation(); handleCopyOne(ref, i); }}
                className="px-2 py-1 text-xs font-mono hover:bg-accent/50 rounded transition-colors cursor-pointer flex items-center justify-between group"
                title="Click to copy"
              >
                <span>{ref}</span>
                {copiedIdx === i ? (
                  <span className="text-[10px] text-green-600 font-semibold">✓</span>
                ) : (
                  <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    📋
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

/**
 * Custom Recharts tooltip content that shows references on hover.
 * Use as: <Tooltip content={<RefChartTooltip dataKey="tons" refsKey="refs" />} />
 */
interface RefChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  dataKey?: string;
  refsKey?: string;
  valueFormatter?: (val: number) => string;
  valueLabel?: string;
  /** Optional function to derive a sub-label from the data point payload */
  subLabel?: (payload: any) => string;
}

export function RefChartTooltip({
  active,
  payload,
  label,
  dataKey = "value",
  refsKey = "refs",
  valueFormatter,
  valueLabel,
  subLabel,
}: RefChartTooltipProps) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  if (!active || !payload || payload.length === 0) return null;

  const handleCopyOne = async (ref: string, idx: number) => {
    const ok = await copyText(ref);
    if (ok) { setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 1200); }
  };

  const handleCopyAllRefs = async (allRefs: string[]) => {
    const ok = await copyText(allRefs.join("\n"));
    if (ok) { setCopiedAll(true); setTimeout(() => setCopiedAll(false), 1200); }
  };

  // Multi-series: show each series with its own refs
  if (payload.length > 1) {
    const allRefs: string[] = payload[0]?.payload?.[refsKey] || [];
    return (
      <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-xl w-[280px] max-h-[400px] overflow-hidden">
        <div className="px-3 py-2 border-b border-border bg-muted/50">
          <div className="font-semibold text-sm">{label}</div>
        </div>
        <div className="overflow-y-auto max-h-[340px]">
          {payload.filter((e: any) => e.value != null).map((entry: any, idx: number) => {
            const val = valueFormatter ? valueFormatter(entry.value) : String(entry.value);
            const seriesRefs: string[] = entry.payload?.[`${entry.dataKey}_refs`] || [];
            return (
              <div key={idx} className="border-b border-border/50 last:border-0">
                <div className="px-3 py-1.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs font-medium">{entry.name || entry.dataKey}</span>
                  <span className="ml-auto text-xs font-mono font-semibold">{val}</span>
                </div>
                {seriesRefs.length > 0 && (
                  <div className="px-3 pb-1.5">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-muted-foreground">{seriesRefs.length} records</span>
                      <button
                        onClick={() => handleCopyAllRefs(seriesRefs)}
                        className="text-[10px] px-1 py-0.5 rounded bg-accent/60 hover:bg-accent text-accent-foreground transition-colors cursor-pointer"
                      >
                        {copiedAll ? "✓" : "Copy"}
                      </button>
                    </div>
                    <div className="max-h-[80px] overflow-y-auto">
                      {seriesRefs.map((ref: string, i: number) => (
                        <span
                          key={i}
                          onClick={() => handleCopyOne(ref, i)}
                          className="text-[10px] font-mono text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Click to copy"
                        >
                          {ref}{i < seriesRefs.length - 1 ? ", " : ""}
                          {copiedIdx === i && <CopiedFlash show />}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {allRefs.length > 0 && payload.every((e: any) => !(e.payload?.[`${e.dataKey}_refs`]?.length)) && (
            <div className="p-1.5">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {allRefs.length} records
                </span>
                <button
                  onClick={() => handleCopyAllRefs(allRefs)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-accent/60 hover:bg-accent text-accent-foreground transition-colors cursor-pointer"
                >
                  {copiedAll ? "✓ Copied" : "Copy All"}
                </button>
              </div>
              {allRefs.map((ref: string, i: number) => (
                <div
                  key={`${ref}-${i}`}
                  onClick={() => handleCopyOne(ref, i)}
                  className="px-2 py-0.5 text-xs font-mono hover:bg-accent/50 rounded transition-colors cursor-pointer flex items-center justify-between group"
                  title="Click to copy"
                >
                  <span>{ref}</span>
                  {copiedIdx === i ? (
                    <span className="text-[10px] text-green-600 font-semibold">✓</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">📋</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Single series
  const item = payload[0];
  const value = item.value ?? item.payload?.[dataKey];
  const refs: string[] = item.payload?.[refsKey] || [];
  const formatted = valueFormatter ? valueFormatter(value) : String(value);

  return (
    <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-xl w-[280px] max-h-[360px] overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/50">
        <div className="font-semibold text-sm">{label || item.name}</div>
        <div className="text-sm text-muted-foreground mt-0.5">
          {valueLabel || dataKey}: <span className="font-mono font-semibold text-foreground">{formatted}</span>
        </div>
        {subLabel && (
          <div className="text-xs text-muted-foreground mt-0.5">{subLabel(item.payload)}</div>
        )}
      </div>
      {refs.length > 0 && (
        <div className="overflow-y-auto max-h-[260px] p-1.5">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {refs.length} {refs.length === 1 ? "record" : "records"}
            </span>
            <button
              onClick={() => handleCopyAllRefs(refs)}
              className="text-[10px] px-1.5 py-0.5 rounded bg-accent/60 hover:bg-accent text-accent-foreground transition-colors cursor-pointer"
            >
              {copiedAll ? `✓ ${refs.length} copied` : "Copy All"}
            </button>
          </div>
          {refs.map((ref, i) => (
            <div
              key={`${ref}-${i}`}
              onClick={() => handleCopyOne(ref, i)}
              className="px-2 py-0.5 text-xs font-mono hover:bg-accent/50 rounded transition-colors cursor-pointer flex items-center justify-between group"
              title="Click to copy"
            >
              <span>{ref}</span>
              {copiedIdx === i ? (
                <span className="text-[10px] text-green-600 font-semibold">✓</span>
              ) : (
                <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">📋</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Multi-bar chart tooltip that shows refs for each bar in a grouped bar chart.
 */
interface MultiBarTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  refsMap?: Record<string, string[]>;
  valueFormatter?: (val: number) => string;
}

export function MultiBarTooltip({
  active,
  payload,
  label,
  refsMap,
  valueFormatter,
}: MultiBarTooltipProps) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  if (!active || !payload || payload.length === 0) return null;

  const handleCopyOne = async (ref: string, idx: number) => {
    const ok = await copyText(ref);
    if (ok) { setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 1200); }
  };

  const handleCopyAllRefs = async (allRefs: string[]) => {
    const ok = await copyText(allRefs.join("\n"));
    if (ok) { setCopiedAll(true); setTimeout(() => setCopiedAll(false), 1200); }
  };

  return (
    <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-xl w-[280px] max-h-[400px] overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/50">
        <div className="font-semibold text-sm">{label}</div>
      </div>
      <div className="overflow-y-auto max-h-[340px]">
        {payload.map((entry: any, idx: number) => {
          const val = valueFormatter ? valueFormatter(entry.value) : String(entry.value);
          const refs = refsMap?.[entry.dataKey] || [];
          return (
            <div key={idx} className="border-b border-border/50 last:border-0">
              <div className="px-3 py-1.5 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                <span className="text-xs font-medium">{entry.name || entry.dataKey}</span>
                <span className="ml-auto text-xs font-mono font-semibold">{val}</span>
              </div>
              {refs.length > 0 && (
                <div className="px-3 pb-1.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-muted-foreground">{refs.length} records</span>
                    <button
                      onClick={() => handleCopyAllRefs(refs)}
                      className="text-[10px] px-1 py-0.5 rounded bg-accent/60 hover:bg-accent text-accent-foreground transition-colors cursor-pointer"
                    >
                      {copiedAll ? "✓" : "Copy"}
                    </button>
                  </div>
                  <div className="max-h-[80px] overflow-y-auto">
                    {refs.map((ref, i) => (
                      <span
                        key={i}
                        onClick={() => handleCopyOne(ref, i)}
                        className="text-[10px] font-mono text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Click to copy"
                      >
                        {ref}{i < refs.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
