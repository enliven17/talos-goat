/**
 * mint-mitos.ts — Deploy a Pulse (Mitos) ERC-20 token on GOAT for every Talos.
 *
 * GOAT model (EVM / viem):
 *   1. For each Talos with a tokenSymbol and no pulseTokenAddress yet,
 *      call PulseTokenFactory.createToken(name, symbol, totalSupply, owner)
 *      to deploy a new ERC-20 whose entire supply is minted to the operator.
 *   2. Read the new token address from the factory's PulseTokenCreated event.
 *   3. Save pulseTokenAddress (0x...) to the DB.
 *
 * Run:
 *   DATABASE_URL=... \
 *   GOAT_OPERATOR_PRIVATE_KEY=0x... \
 *   NEXT_PUBLIC_PULSE_TOKEN_FACTORY_ADDRESS=0x... \
 *   GOAT_PULSE_DECIMALS=18 \
 *   npx tsx scripts/mint-mitos.ts
 *
 * NOTE: The exact PulseTokenFactory ABI (function + event shape) depends on the
 * deployed contract. Confirm `createToken` / `PulseTokenCreated` against the
 * Solidity source; this script isolates all factory calls in one place.
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import pg from "pg";
import { decodeEventLog, getAddress, parseUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { tlsTalos } from "../src/db/schema";
import { getPublicClient, getWalletClient, normalizePrivateKey } from "../src/lib/goat-chain";

// ── Config ───────────────────────────────────────────────────────────────────

const OPERATOR_SECRET = process.env.GOAT_OPERATOR_PRIVATE_KEY;
if (!OPERATOR_SECRET) {
  console.error("GOAT_OPERATOR_PRIVATE_KEY is not set");
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const FACTORY_ADDRESS =
  process.env.NEXT_PUBLIC_PULSE_TOKEN_FACTORY_ADDRESS ??
  process.env.PULSE_TOKEN_FACTORY_ADDRESS ??
  "";
if (!FACTORY_ADDRESS) {
  console.error("NEXT_PUBLIC_PULSE_TOKEN_FACTORY_ADDRESS is not set");
  process.exit(1);
}

const PULSE_DECIMALS = Number(process.env.GOAT_PULSE_DECIMALS ?? 18);

// ── ABI (confirm against deployed PulseTokenFactory) ──────────────────────────

const FACTORY_ABI = [
  {
    type: "function",
    name: "createToken",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "totalSupply", type: "uint256" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "token", type: "address" }],
  },
  {
    type: "event",
    name: "PulseTokenCreated",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "symbol", type: "string", indexed: false },
    ],
  },
] as const;

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  const operator = privateKeyToAccount(normalizePrivateKey(OPERATOR_SECRET!));
  const wallet = getWalletClient(OPERATOR_SECRET!);
  const publicClient = getPublicClient();
  console.log(`\nOperator: ${operator.address}\n`);

  const talosRows = await db
    .select({
      id: tlsTalos.id,
      name: tlsTalos.name,
      tokenSymbol: tlsTalos.tokenSymbol,
      totalSupply: tlsTalos.totalSupply,
      pulseTokenAddress: tlsTalos.pulseTokenAddress,
    })
    .from(tlsTalos);

  for (const talos of talosRows) {
    const symbol = talos.tokenSymbol;
    if (!symbol) {
      console.log(`Skip ${talos.name} — no tokenSymbol`);
      continue;
    }

    if (talos.pulseTokenAddress) {
      console.log(`Skip ${talos.name} (${symbol}) — already deployed: ${talos.pulseTokenAddress}`);
      continue;
    }

    console.log(`\nDeploying ${symbol} for ${talos.name}...`);

    const txHash = await wallet.writeContract({
      address: getAddress(FACTORY_ADDRESS),
      abi: FACTORY_ABI,
      functionName: "createToken",
      args: [
        talos.name,
        symbol,
        parseUnits(String(talos.totalSupply), PULSE_DECIMALS),
        operator.address,
      ],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as Hex });
    if (receipt.status !== "success") {
      console.error(`  Failed: deployment tx reverted (${txHash})`);
      continue;
    }

    // Find the new token address from the PulseTokenCreated event.
    let tokenAddress: string | null = null;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: FACTORY_ABI, data: log.data, topics: log.topics });
        if (decoded.eventName === "PulseTokenCreated") {
          tokenAddress = (decoded.args as { token: string }).token;
          break;
        }
      } catch {
        // Not our event — skip.
      }
    }

    if (!tokenAddress) {
      console.error(`  Deployed but could not parse token address from logs (tx ${txHash}).`);
      continue;
    }

    await db
      .update(tlsTalos)
      .set({ pulseTokenAddress: getAddress(tokenAddress) })
      .where(eq(tlsTalos.id, talos.id));

    console.log(`  ${talos.name}: ${getAddress(tokenAddress)} (tx ${txHash})`);
  }

  await pool.end();
  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
