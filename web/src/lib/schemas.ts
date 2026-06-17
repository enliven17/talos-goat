/**
 * Zod schemas for API request validation.
 * Shared across all POST endpoints to ensure consistent validation.
 */
import { z } from "zod/v4";

// EVM address: 0x followed by 40 hex chars (GOAT Network / EVM).
const evmAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address");

export const VALID_CATEGORIES = [
  "Marketing", "Development", "Research", "Design", "Finance",
  "Analytics", "Operations", "Sales", "Support", "Education",
] as const;

const VALID_ACTIVITY_TYPES = [
  "post", "research", "reply", "engagement", "commerce", "approval",
] as const;

const VALID_APPROVAL_TYPES = [
  "transaction", "strategy", "policy", "channel",
] as const;

// --- TALOS ---

export const createTalosSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(VALID_CATEGORIES),
  description: z.string().min(1).max(2000),
  totalSupply: z.number().int().positive().max(100_000_000).optional().default(1_000_000),
  persona: z.string().max(2000).optional(),
  targetAudience: z.string().max(2000).optional(),
  channels: z.array(z.string()).optional().default([]),
  toneVoice: z.string().max(500).nullable().optional(),
  approvalThreshold: z.number().nonnegative().optional().default(10),
  gtmBudget: z.number().nonnegative().optional().default(200),
  creatorPublicKey: z.string().optional(),
  walletPublicKey: z.string().optional(),
  onChainId: z.number().int().nullable().optional(),
  agentName: z.string().max(100).nullable().optional(),
  initialPrice: z.number().nonnegative().optional().default(0),
  minPatronPulse: z.number().int().nonnegative().nullable().optional(),
  pulseTokenAddress: z.string().nullable().optional(),   // ERC-20 contract address (0x...)
  tokenSymbol: z.string().max(20).nullable().optional(),
  // Optional commerce service
  serviceName: z.string().min(1).max(200).optional(),
  serviceDescription: z.string().max(2000).optional(),
  servicePrice: z.number().positive().max(1_000_000).optional(),
});

// --- Activity ---

export const reportActivitySchema = z.object({
  type: z.enum(VALID_ACTIVITY_TYPES),
  content: z.string().min(1).max(5000),
  // Required to match current route behavior (tls_activities.channel is NOT NULL
  // and the route rejects missing channel). Relaxed from optional → required.
  channel: z.string().min(1).max(100),
  status: z.string().max(50).optional().default("completed"),
});

// --- Approvals ---

export const createApprovalSchema = z.object({
  type: z.enum(VALID_APPROVAL_TYPES),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  amount: z.number().nonnegative().nullable().optional(),
  // Patron-proposal auth field — passed through so the route can authorize
  // non-agent callers. Added to match the existing route/caller contract.
  proposerPublicKey: z.string().optional(),
});

export const decideApprovalSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  decidedBy: z.string().min(1),   // EVM wallet address (0x...)
  txHash: z.string().optional(),
});

// --- Transfer (GOAT USDC ERC-20) ---

export const transferSchema = z.object({
  to: evmAddress,            // EVM recipient address (0x...)
  amount: z.number().positive(),
  currency: z.string().optional().default("USDC"),
});

// --- Patrons ---

export const becomePatronSchema = z.object({
  // Plain non-empty string (not strict evmAddress regex): the current route only
  // checks truthiness and e2e tests register placeholder wallets like "0xE2E_PATRON".
  walletAddress: z.string().min(1),
  pulseAmount: z.number().positive(),
});

// --- Commerce Service ---

export const registerServiceSchema = z.object({
  serviceName: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  price: z.number().positive(),
  walletAddress: evmAddress.optional(),
  chains: z.array(z.string()).optional().default(["goat"]),
  fulfillmentMode: z.enum(["instant", "async"]).optional().default("async"),
});

// --- Revenue ---

export const reportRevenueSchema = z.object({
  // Callers (Python agent + frontend + e2e) send amount as a positive number,
  // and the route checks `<= 0`. Relaxed from z.string() to match reality.
  amount: z.number().positive(),
  currency: z.string().optional().default("USDC"),
  source: z.string().min(1).max(200),
  txHash: z.string().nullable().optional(),
});

// --- Status ---

export const updateStatusSchema = z.object({
  agentOnline: z.boolean(),
});

// --- Regenerate Key ---

export const regenerateKeySchema = z.object({
  walletAddress: evmAddress,              // EVM wallet address (0x...)
  signature: z.string().min(1),           // EIP-191 personal_sign signature (0x...)
  message: z.string().min(1),
});

// --- Sign Payment (GOAT x402) ---

export const signPaymentSchema = z.object({
  payee: evmAddress,                       // EVM address of payee
  amount: z.union([z.string(), z.number()]),
  token: z.string().optional(),            // Optional ERC-20 token address; defaults to USDC
});

// --- Buy Token ---

export const buyTokenSchema = z.object({
  buyerAddress: evmAddress,                // EVM buyer address (0x...)
  amount: z.number().positive(),
});

// --- Playbooks ---

export const createPlaybookSchema = z.object({
  title: z.string().min(1).max(200),
  // category/channel kept as generic strings here; the route enforces its own
  // VALID_CATEGORIES/VALID_CHANNELS allow-lists (preserved).
  category: z.string().min(1).max(100),
  // Required to match current route behavior (route rejects missing channel).
  channel: z.string().min(1).max(100),
  // Required: route rejects missing description.
  description: z.string().min(1).max(5000),
  // Callers send price as a positive number; route checks typeof number && > 0.
  // Relaxed from z.string() to match reality.
  price: z.number().positive(),
  currency: z.string().optional().default("USDC"),
  content: z.record(z.string(), z.unknown()).nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  impressions: z.number().int().nonnegative().optional().default(0),
  // Callers send engagementRate as a number (route coerces via String()).
  // Relaxed from z.string() to match reality.
  engagementRate: z.number().nonnegative().optional().default(0),
  conversions: z.number().int().nonnegative().optional().default(0),
  periodDays: z.number().int().positive().optional().default(30),
});

/**
 * Parse and validate request body with a Zod schema.
 * Returns { data, error } — if error is set, return it as the Response.
 */
export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T>; error?: undefined } | { data?: undefined; error: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      error: Response.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return {
      error: Response.json(
        { error: "Validation failed", issues },
        { status: 400 },
      ),
    };
  }

  return { data: result.data };
}
