"use client";

import type { TalosDetail } from "@/lib/types";

type Approval = {
  id: string; type: string; title: string; description: string | null;
  amount: string | null; status: string; decidedBy: string | null;
  createdAt: string;
};

type ProposeForm = { type: string; title: string; description: string; amount: string };

type BuybackPreview = {
  totalRevenue: number; treasuryBalance: number; treasurySharePercent: number;
  totalBuybackExecuted: number; operatorMitosBalance: number; circulatingSupply: number;
};

type BuybackForm = { usdcAmount: string; mitosAmount: string };

export function GovernanceTab({
  talos,
  isConnected,
  isPatron,
  patronStatus,
  approvals,
  approvalsLoaded,
  loadApprovals,
  handleVote,
  proposeOpen,
  setProposeOpen,
  proposeForm,
  setProposeForm,
  proposeLoading,
  handlePropose,
  buybackPreview,
  buybackLoading,
  buybackForm,
  setBuybackForm,
  loadBuybackPreview,
  handleBuyback,
}: {
  talos: TalosDetail;
  isConnected: boolean;
  isPatron: boolean;
  patronStatus: "none" | "loading" | "patron";
  approvals: Approval[];
  approvalsLoaded: boolean;
  loadApprovals: () => void;
  handleVote: (approvalId: string, decision: "approved" | "rejected") => void;
  proposeOpen: boolean;
  setProposeOpen: (open: boolean) => void;
  proposeForm: ProposeForm;
  setProposeForm: React.Dispatch<React.SetStateAction<ProposeForm>>;
  proposeLoading: boolean;
  handlePropose: () => void;
  buybackPreview: BuybackPreview | null;
  buybackLoading: boolean;
  buybackForm: BuybackForm;
  setBuybackForm: React.Dispatch<React.SetStateAction<BuybackForm>>;
  loadBuybackPreview: () => void;
  handleBuyback: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Propose + Approve section */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted">{approvals.length} proposals total</div>
        <div className="flex gap-2">
          {!approvalsLoaded && (
            <button onClick={loadApprovals} className="border border-border px-4 py-1.5 text-xs text-muted hover:text-accent hover:border-accent transition-colors">
              Load proposals
            </button>
          )}
          {isConnected && (isPatron || patronStatus === "patron") && (
            <button
              onClick={() => setProposeOpen(true)}
              className="bg-accent text-background px-4 py-1.5 text-xs font-medium hover:bg-foreground transition-colors"
            >
              + Propose Action
            </button>
          )}
        </div>
      </div>

      {/* Propose form modal */}
      {proposeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setProposeOpen(false)} />
          <div className="relative bg-background border border-border w-full max-w-md mx-4 p-6 space-y-4">
            <div className="text-xs text-accent mb-2">[NEW PROPOSAL]</div>
            <div>
              <label className="text-xs text-muted block mb-1">Type</label>
              <select
                value={proposeForm.type}
                onChange={e => setProposeForm(f => ({ ...f, type: e.target.value }))}
                className="w-full bg-surface border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
              >
                {["transaction", "strategy", "policy", "channel"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Title *</label>
              <input
                value={proposeForm.title}
                onChange={e => setProposeForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-surface border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
                placeholder="Short description of the action"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Details</label>
              <textarea
                rows={3}
                value={proposeForm.description}
                onChange={e => setProposeForm(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-surface border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent resize-none"
                placeholder="Explain the rationale..."
              />
            </div>
            {proposeForm.type === "transaction" && (
              <div>
                <label className="text-xs text-muted block mb-1">Amount (USDC)</label>
                <input
                  type="number"
                  value={proposeForm.amount}
                  onChange={e => setProposeForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full bg-surface border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
                  placeholder="0.00"
                />
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setProposeOpen(false)} className="flex-1 border border-border py-2 text-sm text-muted hover:text-foreground transition-colors">
                Cancel
              </button>
              <button
                onClick={handlePropose}
                disabled={!proposeForm.title || proposeLoading}
                className="flex-1 bg-accent text-background py-2 text-sm font-medium hover:bg-foreground transition-colors disabled:opacity-50"
              >
                {proposeLoading ? "Submitting..." : "Submit Proposal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approvals list */}
      {approvalsLoaded && approvals.length === 0 && (
        <div className="py-16 text-center text-muted text-sm">No proposals yet.</div>
      )}
      {approvals.map(a => (
        <div key={a.id} className="bg-surface border border-border p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs border border-border px-2 py-0.5 text-muted uppercase">{a.type}</span>
                <span className={`text-xs font-bold ${a.status === "pending" ? "text-yellow-400" : a.status === "approved" ? "text-green-400" : "text-red-400"}`}>
                  [{a.status.toUpperCase()}]
                </span>
              </div>
              <h4 className="text-sm font-bold text-foreground">{a.title}</h4>
              {a.description && <p className="text-xs text-muted mt-1">{a.description}</p>}
              {a.amount && <p className="text-xs text-accent mt-1">${Number(a.amount).toFixed(2)} USDC</p>}
            </div>
            {a.status === "pending" && isConnected && (isPatron || patronStatus === "patron") && (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleVote(a.id, "approved")}
                  className="text-xs px-3 py-1.5 border border-green-400/30 text-green-400 hover:bg-green-400 hover:text-background transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleVote(a.id, "rejected")}
                  className="text-xs px-3 py-1.5 border border-red-400/30 text-red-400 hover:bg-red-400 hover:text-background transition-colors"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
          <div className="text-xs text-muted/60 flex gap-4">
            <span>{new Date(a.createdAt).toLocaleDateString()}</span>
            {a.decidedBy && <span>Decided by {a.decidedBy.slice(0, 8)}...</span>}
          </div>
        </div>
      ))}

      {/* Buyback section */}
      <div className="bg-surface border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-accent">[TREASURY BUYBACK]</div>
          <button onClick={loadBuybackPreview} className="text-xs text-muted hover:text-accent transition-colors">
            Load stats &rarr;
          </button>
        </div>
        <p className="text-xs text-muted mb-4">
          Burns {talos.tokenSymbol} tokens from treasury, reducing circulating supply.
        </p>
        {buybackPreview ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {[
                { label: "Treasury Balance", value: `$${buybackPreview.treasuryBalance.toFixed(2)}` },
                { label: "Total Burned", value: `$${buybackPreview.totalBuybackExecuted.toFixed(2)}` },
                { label: "Circulating Supply", value: buybackPreview.circulatingSupply.toLocaleString() },
              ].map(s => (
                <div key={s.label} className="bg-background border border-border p-3 text-center">
                  <div className="font-bold text-accent">{s.value}</div>
                  <div className="text-muted mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
            {isConnected && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted block mb-1">USDC to spend</label>
                  <input
                    type="number" value={buybackForm.usdcAmount}
                    onChange={e => setBuybackForm(f => ({ ...f, usdcAmount: e.target.value }))}
                    className="w-full bg-surface border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">{talos.tokenSymbol} to burn</label>
                  <input
                    type="number" value={buybackForm.mitosAmount}
                    onChange={e => setBuybackForm(f => ({ ...f, mitosAmount: e.target.value }))}
                    className="w-full bg-surface border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                    placeholder="0"
                  />
                </div>
              </div>
            )}
            {isConnected && (
              <button
                onClick={handleBuyback}
                disabled={buybackLoading || !buybackForm.usdcAmount || !buybackForm.mitosAmount}
                className="w-full py-2.5 text-sm font-medium bg-accent text-background hover:bg-foreground transition-colors disabled:opacity-50"
              >
                {buybackLoading ? "Processing..." : `Burn ${buybackForm.mitosAmount || "0"} ${talos.tokenSymbol}`}
              </button>
            )}
          </div>
        ) : (
          <button onClick={loadBuybackPreview} className="border border-border px-4 py-2 text-xs text-muted hover:text-accent hover:border-accent transition-colors">
            Load buyback stats
          </button>
        )}
      </div>
    </div>
  );
}
