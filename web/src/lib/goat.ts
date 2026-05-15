/**
 * GOAT Network operations — account management, USDC (ERC-20) payments, balances.
 * Replaces the Stellar `stellar.ts` (Horizon + classic assets + trustlines).
 *
 * Agent secret keys are NEVER stored in the database. They are held server-side
 * in environment variables or a secret manager.
 */

import {
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  GOAT_CONFIG,
  WGBTC_ADDRESS,
  getPublicClient,
  getWalletClient,
  normalizePrivateKey,
} from "./goat-chain";

// Payment token on GOAT. GOAT has NO native USDC in its token registry — its
// canonical ERC-20 is WGBTC (Wrapped GOAT BTC). If you bridge a real USDC
// (e.g. via Stargate) set GOAT_USDC_ADDRESS + GOAT_USDC_DECIMALS; otherwise we
// default to WGBTC (18 decimals) so the agent-to-agent loop works out of the box.
const USDC_ADDRESS =
  process.env.NEXT_PUBLIC_GOAT_USDC_ADDRESS ??
  process.env.GOAT_USDC_ADDRESS ??
  WGBTC_ADDRESS;
const USDC_DECIMALS = Number(
  process.env.GOAT_USDC_DECIMALS ?? (USDC_ADDRESS === WGBTC_ADDRESS ? 18 : 6),
);

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export function getUSDCAddress(): `0x${string}` {
  return getAddress(USDC_ADDRESS);
}

/**
 * Create a new EVM keypair for an agent wallet (called during TALOS Genesis).
 * Returns { address, privateKey }.
 * Store `address` in DB as agentWalletId + agentWalletAddress.
 * Store `privateKey` server-side ONLY (env var or secret manager).
 */
export async function createAgentKeypair(): Promise<{
  address: string;
  privateKey: string;
}> {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { address: account.address, privateKey };
}

/**
 * Fund a new GOAT testnet account. GOAT has no programmatic friendbot; the public
 * faucet dispenses 0.01 BTC/day. We log the faucet URL for the operator.
 */
export async function fundTestnetAccount(address: string): Promise<void> {
  if (GOAT_CONFIG.network === "mainnet") return;
  console.log(
    `[goat] Fund ${address} with testnet BTC from the GOAT faucet (0.01 BTC/day). ` +
      `See docs.goat.network for the faucet URL.`,
  );
}

/**
 * Approve a spender to move USDC on the agent's behalf.
 * Replaces the Stellar `establishUSDCTrustline` — ERC-20 needs no trustline,
 * but a spender allowance may be required by the x402 facilitator.
 */
export async function approveUSDC(
  secretKey: string,
  spender: string,
  amount: string,
): Promise<{ txHash: string }> {
  const wallet = getWalletClient(secretKey);
  const txHash = await wallet.writeContract({
    address: getUSDCAddress(),
    abi: ERC20_ABI,
    functionName: "approve",
    args: [getAddress(spender), parseUnits(amount, USDC_DECIMALS)],
  });
  return { txHash };
}

/**
 * Send USDC from one account to another.
 * Amount is human-readable USDC units (e.g. "5.00" = 5 USDC).
 */
export async function sendUSDC(
  fromSecretKey: string,
  toAddress: string,
  amount: string,
): Promise<{ txHash: string }> {
  const wallet = getWalletClient(fromSecretKey);
  const txHash = await wallet.writeContract({
    address: getUSDCAddress(),
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [getAddress(toAddress), parseUnits(amount, USDC_DECIMALS)],
  });
  return { txHash };
}

/**
 * Get USDC balance for an account. Returns a human-readable string ("0" on error).
 */
export async function getUSDCBalance(address: string): Promise<string> {
  try {
    const client = getPublicClient();
    const raw = (await client.readContract({
      address: getUSDCAddress(),
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [getAddress(address)],
    })) as bigint;
    return formatUnits(raw, USDC_DECIMALS);
  } catch {
    return "0";
  }
}

/**
 * Get native BTC (gas token) balance for an account.
 * Replaces `getXLMBalance` (XLM → BTC).
 */
export async function getBTCBalance(address: string): Promise<string> {
  try {
    const client = getPublicClient();
    const raw = await client.getBalance({ address: getAddress(address) });
    return formatEther(raw);
  } catch {
    return "0";
  }
}

/**
 * Record an approval decision on-chain as a self-transaction carrying the
 * decision in the calldata (replaces the Stellar XLM self-payment + text memo).
 * Returns null if the operator key is not configured.
 */
export async function recordApprovalOnChain(
  approvalId: string,
  talosId: string,
  status: "approved" | "rejected",
  decidedBy: string,
): Promise<{ txHash: string } | null> {
  const operatorSecret = process.env.GOAT_OPERATOR_PRIVATE_KEY;
  if (!operatorSecret) {
    console.warn("[goat] GOAT_OPERATOR_PRIVATE_KEY not set, skipping on-chain record");
    return null;
  }

  try {
    const wallet = getWalletClient(operatorSecret);
    const memo = JSON.stringify({ approvalId, talosId, status, decidedBy });
    const data = `0x${Buffer.from(memo, "utf8").toString("hex")}` as Hex;
    const txHash = await wallet.sendTransaction({
      to: wallet.account.address, // self-transaction
      value: BigInt(0),
      data,
    });
    return { txHash };
  } catch (err) {
    console.error("[goat] Failed to record approval on-chain:", err);
    return null;
  }
}

/**
 * Check whether an account exists / has balances on GOAT.
 */
export async function getAccountInfo(
  address: string,
): Promise<{ exists: boolean; btcBalance: string; usdcBalance: string }> {
  try {
    const btc = await getBTCBalance(address);
    const usdc = await getUSDCBalance(address);
    return { exists: true, btcBalance: btc, usdcBalance: usdc };
  } catch {
    return { exists: false, btcBalance: "0", usdcBalance: "0" };
  }
}

/** Validate an EVM address (replaces `isValidStellarPublicKey`). */
export function isValidAddress(address: string): boolean {
  return isAddress(address);
}

/**
 * Ensure the connected wallet is a valid EVM address on GOAT.
 * Throws a user-friendly error otherwise (replaces `ensureStellarNetwork`).
 */
export async function ensureGoatNetwork(walletAddress: string): Promise<void> {
  if (!isValidAddress(walletAddress)) {
    throw new Error(
      "Invalid wallet address. Please connect an EVM wallet (MetaMask) on GOAT Network.",
    );
  }
}

export { USDC_DECIMALS, normalizePrivateKey };
