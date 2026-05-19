import { db } from "@/db";
import { tlsTalos, tlsPatrons, tlsRevenues } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAddress, parseUnits } from "viem";
import { getAccountInfo } from "@/lib/goat";
import { getWalletClient } from "@/lib/goat-chain";

// Minimal ERC-20 transfer ABI for the Pulse (Mitos) token.
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
] as const;

// Pulse token decimals on GOAT (ERC-20). Override via env if the deployed token differs.
const PULSE_DECIMALS = Number(process.env.GOAT_PULSE_DECIMALS ?? 18);

/**
 * Buy Pulse (Mitos) tokens from a Talos.
 *
 * Flow:
 * 1. Verify buyer's GOAT account exists
 * 2. Calculate total cost (amount * pricePerToken)
 * 3. Verify txHash is present (USDC payment already submitted by client)
 * 4. Transfer Pulse ERC-20 tokens from the operator treasury to the buyer
 * 5. Record patron status if buyer meets minimum threshold
 * 6. Record revenue
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  const { buyerAddress, amount, txHash } = body as {
    buyerAddress?: string;
    amount?: number;
    txHash?: string;
  };

  if (!buyerAddress || typeof buyerAddress !== "string") {
    return NextResponse.json({ error: "buyerAddress is required" }, { status: 400 });
  }
  if (!amount || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }
  if (!txHash) {
    return NextResponse.json({ error: "txHash is required — submit USDC payment first" }, { status: 400 });
  }

  const talos = await db.query.tlsTalos.findFirst({
    where: eq(tlsTalos.id, id),
  });

  if (!talos) {
    return NextResponse.json({ error: "TALOS not found" }, { status: 404 });
  }

  const pricePerToken = Number(talos.pulsePrice);
  if (pricePerToken <= 0) {
    return NextResponse.json({ error: "Token is not available for purchase" }, { status: 400 });
  }

  const totalCost = Math.round(amount * pricePerToken * 1e6) / 1e6;

  // Verify buyer's GOAT account exists
  const accountInfo = await getAccountInfo(buyerAddress);
  if (!accountInfo.exists) {
    return NextResponse.json(
      { error: `GOAT account ${buyerAddress} does not exist` },
      { status: 400 },
    );
  }

  // ── Transfer Pulse (Mitos) ERC-20 tokens from operator treasury to buyer ──
  let mitosTxHash: string | null = null;
  const pulseTokenAddress = talos.pulseTokenAddress; // ERC-20 contract (0x...)

  if (pulseTokenAddress) {
    try {
      const operatorSecret = process.env.GOAT_OPERATOR_PRIVATE_KEY;

      if (operatorSecret) {
        const wallet = getWalletClient(operatorSecret);
        mitosTxHash = await wallet.writeContract({
          address: getAddress(pulseTokenAddress),
          abi: PULSE_ERC20_ABI,
          functionName: "transfer",
          args: [getAddress(buyerAddress), parseUnits(String(amount), PULSE_DECIMALS)],
        });
      }
    } catch (err: any) {
      console.error("[buy-token] Pulse token transfer failed:", err?.message ?? err);
      return NextResponse.json(
        { error: "Failed to send Pulse tokens to buyer. Purchase cancelled." },
        { status: 500 },
      );
    }
  }

  // ── Patron threshold check ─────────────────────────────────────────
  const minForPatron = talos.minPatronPulse ?? 100;

  const existingPatron = await db.query.tlsPatrons.findFirst({
    where: and(
      eq(tlsPatrons.talosId, id),
      eq(tlsPatrons.walletAddress, buyerAddress),
    ),
  });

  const currentPulseAmount = existingPatron?.pulseAmount ?? 0;
  const newPulseAmount = currentPulseAmount + amount;
  const becomesPatron = newPulseAmount >= minForPatron;

  if (becomesPatron) {
    if (existingPatron) {
      await db
        .update(tlsPatrons)
        .set({ pulseAmount: newPulseAmount, updatedAt: new Date() })
        .where(eq(tlsPatrons.id, existingPatron.id));
    } else {
      await db.insert(tlsPatrons).values({
        talosId: id,
        walletAddress: buyerAddress,
        role: "patron",
        share: "0",
        pulseAmount: newPulseAmount,
        status: "active",
      });
    }
  } else if (existingPatron) {
    // Update token balance even if still below threshold
    await db
      .update(tlsPatrons)
      .set({ pulseAmount: newPulseAmount, updatedAt: new Date() })
      .where(eq(tlsPatrons.id, existingPatron.id));
  }

  // ── Record revenue ─────────────────────────────────────────────────
  await db.insert(tlsRevenues).values({
    talosId: id,
    amount: String(totalCost),
    currency: "USDC",
    source: "token_sale",
    txHash,
  });

  const tokenSymbol = talos.tokenSymbol ?? "MITOS";

  return NextResponse.json({
    success: true,
    txHash,
    mitosTxHash,
    tokenSymbol,
    amount,
    pricePerToken,
    totalCost,
    currency: "USDC",
    buyerAddress,
    totalPulseHeld: newPulseAmount,
    patronStatus: becomesPatron
      ? existingPatron
        ? "updated"
        : "registered"
      : newPulseAmount < minForPatron
        ? `pending (need ${minForPatron - newPulseAmount} more ${tokenSymbol})`
        : "active",
    message: `Successfully purchased ${amount.toLocaleString()} ${tokenSymbol} for ${totalCost.toFixed(2)} USDC`,
  });
}
