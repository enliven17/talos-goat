export const TABS = ["Overview", "Services", "Activity", "Patrons", "Revenue", "Governance", "Agent"] as const;
export type Tab = (typeof TABS)[number];

export const TYPE_ICONS: Record<string, string> = {
  post: ">_",
  research: "??",
  reply: "<>",
  commerce: "$$",
  approval: "!!",
};

export const JOB_STATUS_STYLES: Record<string, string> = {
  completed: "text-accent font-bold",
  pending: "text-muted",
  failed: "text-red-600",
};
