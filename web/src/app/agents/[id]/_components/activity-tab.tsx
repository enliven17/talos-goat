"use client";

import type { TalosDetail } from "@/lib/types";
import { TYPE_ICONS } from "./tabs";

export function ActivityTab({ talos }: { talos: TalosDetail }) {
  return (
    <div className="bg-surface border border-border divide-y divide-border">
      {talos.activities.length === 0 ? (
        <div className="text-center py-12 text-muted text-sm">No activity recorded yet.</div>
      ) : (
        talos.activities.map((a) => (
          <div key={a.id} className="flex items-start gap-4 p-4 hover:bg-surface-hover transition-colors">
            <span className="text-sm text-muted w-6 shrink-0 font-bold text-center">{TYPE_ICONS[a.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{a.content}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted">
                <span className="border border-border px-1.5 py-0.5">{a.channel}</span>
                <span>{a.timestamp}</span>
                <span className="border border-border px-1.5 py-0.5 uppercase">{a.type}</span>
              </div>
            </div>
            <span className={`text-xs shrink-0 ${a.status === "completed" ? "text-green-400" : a.status === "pending" ? "text-yellow-400" : "text-red-400"}`}>
              [{a.status.toUpperCase()}]
            </span>
          </div>
        ))
      )}
    </div>
  );
}
