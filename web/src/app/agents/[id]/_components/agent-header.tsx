"use client";

import Link from "next/link";
import { AgentAvatar } from "@/components/agent-avatar";
import type { TalosDetail } from "@/lib/types";
import { TABS, type Tab } from "./tabs";

export function AgentHeader({
  talos,
  tab,
  setTab,
  isConnected,
  connect,
  isPatron,
  patronStatus,
  meetsThreshold,
  minRequired,
  handleBecomePatron,
  openBuyModal,
}: {
  talos: TalosDetail;
  tab: Tab;
  setTab: (t: Tab) => void;
  isConnected: boolean;
  connect: () => void;
  isPatron: boolean;
  patronStatus: "none" | "loading" | "patron";
  meetsThreshold: boolean;
  minRequired: number;
  handleBecomePatron: () => void;
  openBuyModal: () => void;
}) {
  return (
    <>
      <Link href="/agents" className="text-xs text-muted hover:text-foreground transition-colors">
        &larr; Agent Directory
      </Link>

      {/* Header */}
      <div className="mt-6 mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex gap-4">
          <div className="shrink-0 mt-1">
            <AgentAvatar name={talos.agentName || talos.name} size={56} />
          </div>
          <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-accent">{talos.name}</h1>
            <span className={`text-xs ${talos.status === "Active" ? "text-accent font-bold" : "text-muted"}`}>
              [{talos.agentOnline ? "ONLINE" : "OFFLINE"}]
            </span>
          </div>
          {talos.agentName && (
            <div className="flex items-center gap-2 text-sm text-foreground/70 mb-1">
              <span className="font-mono">{talos.agentName}.talos</span>
              {talos.description.includes("OpenClaw") && (
                <span className="inline-flex items-center gap-1 text-xs text-red-400/90 border border-red-400/30 px-1.5 py-0.5 leading-none">
                  <img src="/openclaw_icon.svg" alt="OpenClaw" width={14} height={14} />
                  OpenClaw
                </span>
              )}
            </div>
          )}
          <p className="text-sm text-muted max-w-xl">{talos.description}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted">
            <span>[{talos.category.toUpperCase()}]</span>
            <span>Created {talos.createdAt}</span>
            {talos.agentLastSeen && !talos.agentOnline && (
              <span>Last seen {new Date(talos.agentLastSeen).toLocaleDateString()}</span>
            )}
          </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isConnected ? (
            <>
              {isPatron || patronStatus === "patron" ? (
                <span className="border border-accent/30 text-accent px-5 py-2 text-sm font-bold">
                  Patron
                </span>
              ) : (
                <div className="relative group">
                  <button
                    onClick={handleBecomePatron}
                    disabled={!meetsThreshold || patronStatus === "loading"}
                    className={`px-5 py-2 text-sm font-medium transition-colors ${
                      meetsThreshold
                        ? "bg-accent text-background hover:bg-foreground"
                        : "bg-surface text-muted border border-border cursor-not-allowed"
                    }`}
                  >
                    {patronStatus === "loading" ? "Registering..." : "Become Patron"}
                  </button>
                  {!meetsThreshold && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-surface border border-border text-xs text-muted whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {minRequired.toLocaleString()} {talos.tokenSymbol} required
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={openBuyModal}
                className="border border-accent/40 text-accent px-5 py-2 text-sm font-medium hover:bg-accent hover:text-background transition-colors"
              >
                Buy ${talos.tokenSymbol}
              </button>
            </>
          ) : (
            <button
              onClick={connect}
              className="bg-accent text-background px-5 py-2 text-sm font-medium hover:bg-foreground transition-colors flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
              </svg>
              Connect to Invest
            </button>
          )}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-px bg-border mb-8">
        {[
          { label: `${talos.tokenSymbol} Price`, value: talos.pulsePrice },
          { label: "Patrons", value: talos.patronCount.toString() },
          { label: "Treasury", value: talos.revenue },
          { label: "Jobs Done", value: talos.jobStats.completed.toString() },
          {
            label: "Success Rate",
            value: talos.jobStats.successRate !== null ? `${talos.jobStats.successRate}%` : "—",
          },
        ].map((s) => (
          <div key={s.label} className="bg-surface px-4 py-4 text-center">
            <div className="text-lg font-bold text-accent">{s.value}</div>
            <div className="text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 sm:gap-6 border-b border-border mb-8 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 pt-1 text-sm transition-colors whitespace-nowrap shrink-0 ${
              tab === t ? "text-accent border-b border-accent" : "text-muted hover:text-foreground"
            }`}
          >
            {t}
            {t === "Services" && talos.service && (
              <span className="ml-1.5 text-xs text-accent/60">1</span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}
