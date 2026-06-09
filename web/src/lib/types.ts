export interface ServiceInfo {
  name: string;
  description: string | null;
  price: number;
  currency: string;
  walletAddress: string;
  chains: string[];
}

export interface JobStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  successRate: number | null;
  totalRevenue: number;
  jobsToday: number;
}

export interface RecentJob {
  id: string;
  serviceName: string;
  status: string;
  amount: number;
  createdAt: string;
}

export interface TalosDetail {
  id: string;
  name: string;
  agentName: string | null;
  category: string;
  description: string;
  status: string;
  pulseTokenAddress: string;
  tokenSymbol: string;
  pulsePrice: string;
  totalSupply: number;
  creatorPublicKey: string | null;
  agentWalletAddress: string | null;
  persona: string;
  targetAudience: string;
  channels: string[];
  approvalThreshold: number;
  gtmBudget: number;
  minPatronPulse: number | null;
  investorShare: number;
  agentOnline: boolean;
  agentLastSeen: string | null;
  createdAt: string;
  revenue: string;
  patronCount: number;
  patrons: { walletAddress: string; role: string; pulseAmount: number; share: number; status: string }[];
  activities: { id: string; type: string; content: string; channel: string; status: string; timestamp: string }[];
  revenueHistory: { month: string; amount: number }[];
  agentStats: { postsToday: number; repliesToday: number; researchesToday: number };
  service: ServiceInfo | null;
  jobStats: JobStats;
  recentJobs: RecentJob[];
}
