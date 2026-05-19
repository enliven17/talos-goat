import { NextRequest } from "next/server";
import { db } from "@/db";
import { tlsTalos, tlsPatrons, tlsRevenues } from "@/db/schema";
import { eq, and, sum } from "drizzle-orm";
import { privateKeyToAccount } from "viem/accounts";
import { sendUSDC } from "@/lib/goat";
import { normalizePrivateKey } from "@/lib/goat-chain";

// Operator address that is allowed to trigger distribution. Set GOAT_OPERATOR_ADDRESS
// (0x...) explicitly, or it is derived from GOAT_OPERATOR_PRIVATE_KEY at runtime.
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
 * POST /api/talos/:id/revenue/distribute
 *
 * Distribute accumulated treasury USDC to Pulse holders proportionally.
 * Requires GOAT_OPERATOR_PRIVATE_KEY (operator holds the agent treasury for now).
 *
 * Body: { requesterAddress } — must be creator or operator
 *
 * Returns: list of transfers executed
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { requesterAddress } = body as { requesterAddress?: string };

    if (!requesterAddress) {
      return Response.json({ error: "requesterAddress is required" }, { status: 400 });
    }

    const talos = await db.query.tlsTalos.findFirst({ where: eq(tlsTalos.id, id) });
    if (!talos) return Response.json({ error: "TALOS not found" }, { status: 404 });

    // Only creator or operator can distribute (case-insensitive EVM address compare)
    const operatorAddress = getOperatorAddress();
    const reqLc = requesterAddress.toLowerCase();
    const isCreator = talos.creatorPublicKey?.toLowerCase() === reqLc;
    const isOperator = operatorAddress?.toLowerCase() === reqLc;
    if (!isCreator && !isOperator) {
      return Response.json({ error: "Only the creator or operator can trigger distribution" }, { status: 403 });
    }

    // Calculate total revenue
    const revenueResult = await db
      .select({ total: sum(tlsRevenues.amount) })
      .from(tlsRevenues)
      .where(eq(tlsRevenues.talosId, id));
    const totalRevenue = parseFloat(revenueResult[0]?.total ?? "0");

    if (totalRevenue <= 0) {
      return Response.json({ error: "No revenue to distribute" }, { status: 400 });
    }

    // Get all active patrons
    const patrons = await db
      .select()
      .from(tlsPatrons)
      .where(and(eq(tlsPatrons.talosId, id), eq(tlsPatrons.status, "active")));

    if (patrons.length === 0) {
      return Response.json({ error: "No active patrons to distribute to" }, { status: 400 });
    }

    const totalPulse = patrons.reduce((s, p) => s + p.pulseAmount, 0);
    if (totalPulse === 0) {
      return Response.json({ error: "Total Pulse held by patrons is 0" }, { status: 400 });
    }

    // investorShare % goes to patrons, rest stays in treasury
    const investorShare = talos.investorShare ?? 25; // default 25%
    const distributableAmount = (totalRevenue * investorShare) / 100;

    const operatorSecret = process.env.GOAT_OPERATOR_PRIVATE_KEY;
    if (!operatorSecret) {
      return Response.json({ error: "GOAT_OPERATOR_PRIVATE_KEY not configured" }, { status: 500 });
    }

    const transfers: { patron: string; amount: number; txHash: string }[] = [];
    const errors: { patron: string; error: string }[] = [];

    for (const patron of patrons) {
      const shareRatio = patron.pulseAmount / totalPulse;
      // USDC has 6 decimals; round to that precision.
      const patronAmount = Math.floor(distributableAmount * shareRatio * 1e6) / 1e6;

      if (patronAmount < 0.000001) continue; // Skip dust

      try {
        // ERC-20 USDC transfer from operator treasury to the patron.
        const { txHash } = await sendUSDC(
          operatorSecret,
          patron.walletAddress,
          patronAmount.toFixed(6),
        );
        transfers.push({ patron: patron.walletAddress, amount: patronAmount, txHash });
      } catch (err: any) {
        errors.push({
          patron: patron.walletAddress,
          error: err?.shortMessage ?? err?.message ?? "unknown",
        });
      }
    }

    return Response.json({
      success: true,
      totalRevenue,
      distributableAmount,
      investorSharePercent: investorShare,
      transfers,
      errors,
      message: `Distributed ${distributableAmount.toFixed(2)} USDC (${investorShare}% of ${totalRevenue.toFixed(2)} USDC treasury) to ${transfers.length} patrons`,
    });
  } catch (err) {
    console.error("[revenue/distribute]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/talos/:id/revenue/distribute
 * Preview distribution without executing
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const talos = await db.query.tlsTalos.findFirst({ where: eq(tlsTalos.id, id) });
    if (!talos) return Response.json({ error: "TALOS not found" }, { status: 404 });

    const [revenueResult, patrons] = await Promise.all([
      db.select({ total: sum(tlsRevenues.amount) }).from(tlsRevenues).where(eq(tlsRevenues.talosId, id)),
      db.select().from(tlsPatrons).where(and(eq(tlsPatrons.talosId, id), eq(tlsPatrons.status, "active"))),
    ]);

    const totalRevenue = parseFloat(revenueResult[0]?.total ?? "0");
    const investorShare = talos.investorShare ?? 25;
    const distributableAmount = (totalRevenue * investorShare) / 100;
    const totalPulse = patrons.reduce((s, p) => s + p.pulseAmount, 0);

    const breakdown = patrons.map((p) => ({
      walletAddress: p.walletAddress,
      pulseAmount: p.pulseAmount,
      sharePercent: totalPulse > 0 ? ((p.pulseAmount / totalPulse) * 100).toFixed(2) : "0",
      estimatedUsdc: totalPulse > 0
        ? ((distributableAmount * p.pulseAmount) / totalPulse).toFixed(6)
        : "0",
    }));

    return Response.json({
      totalRevenue,
      distributableAmount,
      investorSharePercent: investorShare,
      treasuryRetained: totalRevenue - distributableAmount,
      breakdown,
    });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
