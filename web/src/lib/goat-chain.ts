/**
 * GOAT Network chain config + viem clients.
 * Replaces the Stellar Horizon/Soroban RPC setup.
 *
 * GOAT is a Bitcoin-secured Type-1 zkEVM L2; the native gas token is BTC.
 * Values are env-overridable — confirm canonical RPC/chainId at docs.goat.network.
 * AgentKit references chainId 48816 (Testnet3); some explorers list 2345.
 */

import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const GOAT_NETWORK =
  process.env.NEXT_PUBLIC_GOAT_NETWORK ?? process.env.GOAT_NETWORK ?? "testnet";

const GOAT_RPC_URL =
  process.env.NEXT_PUBLIC_GOAT_RPC_URL ??
  process.env.GOAT_RPC_URL ??
  (GOAT_NETWORK === "mainnet"
    ? "https://rpc.goat.network"
    : "https://rpc.testnet3.goat.network");

const GOAT_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_GOAT_CHAIN_ID ??
    process.env.GOAT_CHAIN_ID ??
    (GOAT_NETWORK === "mainnet" ? 2345 : 48816),
);

const GOAT_EXPLORER_URL =
  process.env.NEXT_PUBLIC_GOAT_EXPLORER_URL ??
  (GOAT_NETWORK === "mainnet"
    ? "https://explorer.goat.network"
    : "https://explorer.testnet3.goat.network");

// ── Verified GOAT addresses (from @goatnetwork/agentkit) ──────────────
// AgentKit network key for this environment.
export const GOAT_AGENTKIT_NETWORK =
  GOAT_NETWORK === "mainnet" ? "goat-mainnet" : "goat-testnet";

/** Wrapped GOAT BTC — GOAT's canonical ERC-20 (no native USDC; see goat.ts). */
export const WGBTC_ADDRESS = "0xBC10000000000000000000000000000000000000";

/** ERC-8004 Identity Registry (canonical, per network). */
export const ERC8004_IDENTITY_REGISTRY =
  GOAT_NETWORK === "mainnet"
    ? "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
    : "0x556089008Fc0a60cD09390Eca93477ca254A5522";

/** ERC-8004 Reputation Registry (canonical, per network). */
export const ERC8004_REPUTATION_REGISTRY =
  GOAT_NETWORK === "mainnet"
    ? "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"
    : "0xd9140951d8aE6E5F625a02F5908535e16e3af964";

export const goatChain = defineChain({
  id: GOAT_CHAIN_ID,
  name: GOAT_NETWORK === "mainnet" ? "GOAT Network" : "GOAT Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: {
    default: { http: [GOAT_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "GOAT Explorer", url: GOAT_EXPLORER_URL },
  },
  testnet: GOAT_NETWORK !== "mainnet",
});

export const GOAT_CONFIG = {
  network: GOAT_NETWORK,
  rpcUrl: GOAT_RPC_URL,
  chainId: GOAT_CHAIN_ID,
  explorerUrl: GOAT_EXPLORER_URL,
} as const;

/** A 0x-prefixed private key, normalizing bare hex. */
export function normalizePrivateKey(key: string): `0x${string}` {
  return (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`;
}

/** Read-only viem client for GOAT (replaces Horizon reads + Soroban simulate). */
export function getPublicClient() {
  return createPublicClient({ chain: goatChain, transport: http(GOAT_RPC_URL) });
}

/** Signing viem client bound to a server-held private key. */
export function getWalletClient(privateKey: string) {
  const account = privateKeyToAccount(normalizePrivateKey(privateKey));
  return createWalletClient({ account, chain: goatChain, transport: http(GOAT_RPC_URL) });
}

/** Block-explorer tx URL for the configured network. */
export function explorerTxUrl(txHash: string): string {
  return `${GOAT_EXPLORER_URL}/tx/${txHash}`;
}
