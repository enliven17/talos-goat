"use client";

import type { TalosDetail } from "@/lib/types";

type DistPreview = {
  totalRevenue: number;
  distributableAmount: number;
  investorSharePercent: number;
  breakdown: { walletAddress: string; pulseAmount: number; sharePercent: string; estimatedUsdc: string }[];
};

export function RevenueTab({
  talos,
  address,
  isConnected,
  distPreview,
  distLoading,
  loadDistPreview,
  handleDistribute,
}: {
  talos: TalosDetail;
  address: string | null;
  isConnected: boolean;
  distPreview: DistPreview | null;
  distLoading: boolean;
  loadDistPreview: () => void;
  handleDistribute: () => void;
}) {
  const REVENUE_HISTORY = talos.revenueHistory ?? [];
  const maxRevenue = Math.max(...REVENUE_HISTORY.map((r) => r.amount), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: talos.revenue },
          { label: "This Month", value: `$${(REVENUE_HISTORY[REVENUE_HISTORY.length - 1]?.amount ?? 0).toLocaleString()}` },
          { label: "Avg Monthly", value: `$${Math.round(REVENUE_HISTORY.length > 0 ? REVENUE_HISTORY.reduce((s, r) => s + r.amount, 0) / REVENUE_HISTORY.length : 0).toLocaleString()}` },
          { label: "From Jobs", value: `$${talos.jobStats.totalRevenue.toLocaleString()}` },
        ].map((s) => (
          <div key={s.label} className="bg-surface border border-border p-4 text-center">
            <div className="text-xl font-bold text-accent">{s.value}</div>
            <div className="text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Distribution Panel */}
      <div className="bg-surface border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-accent">[REVENUE DISTRIBUTION]</div>
          <button
            onClick={loadDistPreview}
            className="text-xs text-muted hover:text-accent transition-colors"
          >
            Load preview &rarr;
          </button>
        </div>
        <p className="text-xs text-muted mb-4">
          {talos.investorShare ?? 25}% of treasury revenue is distributable to {talos.tokenSymbol} holders
          proportionally to their holdings.
        </p>
        {distPreview ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div className="bg-background border border-border p-3 text-center">
                <div className="text-accent font-bold text-sm">${distPreview.totalRevenue.toFixed(2)}</div>
                <div className="text-muted">Total Treasury</div>
              </div>
              <div className="bg-background border border-border p-3 text-center">
                <div className="text-accent font-bold text-sm">${distPreview.distributableAmount.toFixed(2)}</div>
                <div className="text-muted">To Distribute ({distPreview.investorSharePercent}%)</div>
              </div>
              <div className="bg-background border border-border p-3 text-center">
                <div className="text-foreground font-bold text-sm">${(distPreview.totalRevenue - distPreview.distributableAmount).toFixed(2)}</div>
                <div className="text-muted">Treasury Retained</div>
              </div>
            </div>
            <div className="space-y-1">
              {distPreview.breakdown.map((b) => (
                <div key={b.walletAddress} className={`flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0 ${b.walletAddress === address ? "text-accent" : "text-muted"}`}>
                  <span className="font-mono">{b.walletAddress === address ? "You" : `${b.walletAddress.slice(0, 8)}...`}</span>
                  <span>{b.pulseAmount.toLocaleString()} {talos.tokenSymbol} ({b.sharePercent}%)</span>
                  <span className="font-bold">${b.estimatedUsdc} USDC</span>
                </div>
              ))}
            </div>
            {isConnected && (
              <button
                onClick={handleDistribute}
                disabled={distLoading || distPreview.distributableAmount <= 0}
                className={`w-full py-2.5 text-sm font-medium transition-colors ${
                  distPreview.distributableAmount > 0
                    ? "bg-accent text-background hover:bg-foreground"
                    : "bg-surface text-muted border border-border cursor-not-allowed"
                }`}
              >
                {distLoading ? "Distributing..." : `Distribute ${distPreview.distributableAmount.toFixed(2)} USDC to Holders`}
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={loadDistPreview}
            className="border border-border px-4 py-2 text-xs text-muted hover:text-accent hover:border-accent transition-colors"
          >
            Load distribution preview
          </button>
        )}
      </div>

      <div className="bg-surface border border-border p-6">
        <div className="text-xs text-muted mb-6">[REVENUE HISTORY]</div>
        {REVENUE_HISTORY.length === 0 ? (
          <div className="text-center py-12 text-muted text-sm">No revenue data yet.</div>
        ) : (
          <div className="flex items-end gap-3 h-40">
            {REVENUE_HISTORY.map((r) => (
              <div key={r.month} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs text-accent">${(r.amount / 1000).toFixed(1)}K</span>
                <div className="w-full bg-border relative" style={{ height: `${(r.amount / maxRevenue) * 100}%` }}>
                  <div className="absolute inset-0 bg-foreground/20 hover:bg-foreground/40 transition-colors" />
                </div>
                <span className="text-xs text-muted">{r.month}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
