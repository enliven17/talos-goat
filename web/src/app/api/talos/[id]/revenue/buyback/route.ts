import { NextRequest } from "next/server";
import { db } from "@/db";
import { tlsTalos, tlsRevenues } from "@/db/schema";
import { and, eq, sum } from "drizzle-orm";
import { getAddress, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getPublicClient, getWalletClient, normalizePrivateKey } from "@/lib/goat-chain";

// Standard EVM burn sink — tokens sent here are unrecoverable (effective burn).
const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";
const PULSE_DECIMALS = Number(process.env.GOAT_PULSE_DECIMALS ?? 18);

const PULSE_ERC20_ABI = [
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
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

function getOperatorAddress(): string | null {
  if (process.env.GOAT_OPERATOR_ADDRESS) return process.env.GOAT_OPERATOR_ADDRESS;
  const key = process.env.GOAT_OPERATOR_PRIVATE_KEY;
  if (!key) return null;
  try {
    return privateKeyToAccount(normalizePrivateKey(key)).address;
  } catch {
    return null;
  }
}

/**
 * POST /api/talos/:id/revenue/buyback
 *
 * Treasury buyback on GOAT: the operator burns Pulse (Mitos) ERC-20 tokens by
 * transferring them from the treasury to the canonical burn address, and records
 * the USDC spent as a negative (expense) revenue event.
 *
 * Simplified testnet model:
 * - Burns `mitosAmount` Pulse tokens (ERC-20 transfer to the burn address)
 * - Records `usdcAmount` as a treasury_buyback expense
 *
 * Body: { requesterAddress, usdcAmount, mitosAmount }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { requesterAddress, usdcAmount, mitosAmount } = body as {
      requesterAddress?: string;
      usdcAmount?: number;
      mitosAmount?: number;
    };

    if (!requesterAddress) {
      return Response.json({ error: "requesterAddress is required" }, { status: 400 });
    }
    if (!usdcAmount || usdcAmount <= 0) {
      return Response.json({ error: "usdcAmount must be positive" }, { status: 400 });
    }
    if (!mitosAmount || mitosAmount <= 0) {
      return Response.json({ error: "mitosAmount must be positive" }, { status: 400 });
    }

    const talos = await db.query.tlsTalos.findFirst({ where: eq(tlsTalos.id, id) });
    if (!talos) return Response.json({ error: "TALOS not found" }, { status: 404 });

    const operatorAddress = getOperatorAddress();
    const reqLc = requesterAddress.toLowerCase();
    const isCreator = talos.creatorPublicKey?.toLowerCase() === reqLc;
    const isOperator = operatorAddress?.toLowerCase() === reqLc;
    if (!isCreator && !isOperator) {
      return Response.json({ error: "Only creator or operator can trigger buyback" }, { status: 403 });
    }

    const pulseTokenAddress = talos.pulseTokenAddress;
    if (!pulseTokenAddress) {
      return Response.json({ error: "No Pulse token configured for this TALOS" }, { status: 400 });
    }

    const operatorSecret = process.env.GOAT_OPERATOR_PRIVATE_KEY;
    if (!operatorSecret) {
      return Response.json({ error: "GOAT_OPERATOR_PRIVATE_KEY not configured" }, { status: 500 });
    }

    // Burn Pulse tokens: ERC-20 transfer from operator treasury to the burn address.
    const wallet = getWalletClient(operatorSecret);
    const txHash = await wallet.writeContract({
      address: getAddress(pulseTokenAddress),
      abi: PULSE_ERC20_ABI,
      functionName: "transfer",
      args: [getAddress(BURN_ADDRESS), parseUnits(String(mitosAmount), PULSE_DECIMALS)],
    });

    // Record as negative revenue (treasury expense)
    await db.insert(tlsRevenues).values({
      talosId: id,
      amount: String(-usdcAmount),
      currency: "USDC",
      source: "buyback",
      txHash,
    });

    const tokenSymbol = talos.tokenSymbol ?? "MITOS";
    return Response.json({
      success: true,
      txHash,
      mitosBurned: mitosAmount,
      usdcSpent: usdcAmount,
      message: `Buyback: burned ${mitosAmount.toLocaleString()} ${tokenSymbol} tokens. tx: ${txHash.slice(0, 12)}...`,
    });
  } catch (err: any) {
    console.error("[buyback]", err?.shortMessage ?? err?.message ?? err);
    return Response.json(
      { error: err?.shortMessage ?? err?.message ?? "Buyback failed" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/talos/:id/revenue/buyback
 * Preview: treasury balance + buyback stats
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const talos = await db.query.tlsTalos.findFirst({ where: eq(tlsTalos.id, id) });
    if (!talos) return Response.json({ error: "TALOS not found" }, { status: 404 });

    const [revenueResult, buybackResult] = await Promise.all([
      db.select({ total: sum(tlsRevenues.amount) }).from(tlsRevenues).where(eq(tlsRevenues.talosId, id)),
      db.select({ total: sum(tlsRevenues.amount) })
        .from(tlsRevenues)
        .where(and(eq(tlsRevenues.talosId, id), eq(tlsRevenues.source, "buyback"))),
    ]);

    const totalRevenue = parseFloat(revenueResult[0]?.total ?? "0");
    const totalBuyback = Math.abs(parseFloat(buybackResult[0]?.total ?? "0"));
    const treasuryShare = talos.treasuryShare ?? 15;
    const investorShare = talos.investorShare ?? 25;
    const treasuryBalance = (totalRevenue * treasuryShare) / 100;

    // Check on-chain Pulse (ERC-20) balance of the operator treasury
    let operatorMitosBalance = 0;
    const operatorAddress = getOperatorAddress();
    if (talos.pulseTokenAddress && operatorAddress) {
      try {
        const client = getPublicClient();
        const raw = (await client.readContract({
          address: getAddress(talos.pulseTokenAddress),
          abi: PULSE_ERC20_ABI,
          functionName: "balanceOf",
          args: [getAddress(operatorAddress)],
        })) as bigint;
        operatorMitosBalance = Number(raw) / 10 ** PULSE_DECIMALS;
      } catch { /* offline */ }
    }

    return Response.json({
      totalRevenue,
      treasuryBalance,
      treasurySharePercent: treasuryShare,
      investorSharePercent: investorShare,
      totalBuybackExecuted: totalBuyback,
      operatorMitosBalance,
      tokenSymbol: talos.tokenSymbol ?? "MITOS",
      circulatingSupply: talos.totalSupply - operatorMitosBalance,
    });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
