/**
 * GOAT contract interaction — replaces `soroban.ts`.
 *
 * Reads the TalosRegistry and TalosNameService Solidity contracts via viem.
 * Write calls (createTalos, registerName) go through the user's EVM wallet
 * (wagmi `useWriteContract`) client-side, so this module is read-only.
 */

import { getAddress } from "viem";
import { getPublicClient } from "./goat-chain";

// NEXT_PUBLIC_ prefix required — imported by client components (launch/page.tsx).
export const TALOS_REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_TALOS_REGISTRY_ADDRESS ?? "";

export const TALOS_NAME_SERVICE_ADDRESS =
  process.env.NEXT_PUBLIC_TALOS_NAME_SERVICE_ADDRESS ?? "";

export const PULSE_TOKEN_FACTORY_ADDRESS =
  process.env.NEXT_PUBLIC_PULSE_TOKEN_FACTORY_ADDRESS ?? "";

/**
 * ERC-20 used to pay for token purchases / service requests on GOAT.
 * Empty when payments settle in the native BTC gas token instead.
 */
export const PAYMENT_TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS ?? "";

export const NAME_SERVICE_ABI = [
  {
    type: "function",
    name: "isNameAvailable",
    stateMutability: "view",
    inputs: [{ name: "name", type: "string" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "resolveName",
    stateMutability: "view",
    inputs: [{ name: "name", type: "string" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "registerName",
    stateMutability: "nonpayable",
    inputs: [
      { name: "talosId", type: "uint256" },
      { name: "name", type: "string" },
    ],
    outputs: [],
  },
] as const;

export const REGISTRY_ABI = [
  {
    type: "function",
    name: "nextTalosId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isActive",
    stateMutability: "view",
    inputs: [{ name: "talosId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "creatorOf",
    stateMutability: "view",
    inputs: [{ name: "talosId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "createTalos",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "category", type: "string" },
      { name: "description", type: "string" },
      {
        name: "patron",
        type: "tuple",
        components: [
          { name: "creatorShare", type: "uint32" },
          { name: "investorShare", type: "uint32" },
          { name: "treasuryShare", type: "uint32" },
          { name: "creatorAddr", type: "address" },
          { name: "investorAddr", type: "address" },
          { name: "treasuryAddr", type: "address" },
        ],
      },
      {
        name: "kernel",
        type: "tuple",
        components: [
          { name: "approvalThreshold", type: "uint256" },
          { name: "gtmBudget", type: "uint256" },
          { name: "minPatronPulse", type: "uint256" },
        ],
      },
      {
        name: "pulse",
        type: "tuple",
        components: [
          { name: "totalSupply", type: "uint256" },
          { name: "priceUsdCents", type: "uint256" },
          { name: "tokenSymbol", type: "string" },
        ],
      },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** Minimal ERC-20 ABI for PulseToken transfers / approvals on GOAT. */
export const ERC20_ABI = [
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
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

/**
 * Check if a name is available on-chain via TalosNameService.
 * Falls back to regex validation if the contract isn't deployed.
 */
export async function isNameAvailableOnChain(name: string): Promise<boolean> {
  if (!TALOS_NAME_SERVICE_ADDRESS) {
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name) && !/--/.test(name);
  }
  try {
    const client = getPublicClient();
    return (await client.readContract({
      address: getAddress(TALOS_NAME_SERVICE_ADDRESS),
      abi: NAME_SERVICE_ABI,
      functionName: "isNameAvailable",
      args: [name],
    })) as boolean;
  } catch {
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name) && !/--/.test(name);
  }
}

/**
 * Resolve a name to its on-chain TALOS ID. Returns null if not registered.
 */
export async function resolveNameOnChain(name: string): Promise<number | null> {
  if (!TALOS_NAME_SERVICE_ADDRESS) return null;
  try {
    const client = getPublicClient();
    const id = (await client.readContract({
      address: getAddress(TALOS_NAME_SERVICE_ADDRESS),
      abi: NAME_SERVICE_ABI,
      functionName: "resolveName",
      args: [name],
    })) as bigint;
    return id > BigInt(0) ? Number(id) : null;
  } catch {
    return null;
  }
}
