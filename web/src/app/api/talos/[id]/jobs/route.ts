import { NextRequest } from "next/server";
import { db } from "@/db";
import { tlsTalos, tlsCommerceServices, tlsCommerceJobs, tlsRevenues } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  decodeEventLog,
  getAddress,
  parseUnits,
  type Hex,
} from "viem";
import { getPublicClient } from "@/lib/goat-chain";
import { getUSDCAddress, USDC_DECIMALS } from "@/lib/goat";
import { fulfillInstant } from "@/lib/fulfillment";

// ERC-20 Transfer event used to verify the on-chain USDC payment.
const ERC20_TRANSFER_EVENT = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

/**
 * POST /api/talos/:id/jobs
 *
 * Human user requests a service from an agent.
 * Accepts either:
 *   - signedTx: a raw signed EVM transaction (server broadcasts + verifies payment)
 *   - txHash: an already-broadcast tx hash (server verifies the USDC Transfer log)
 *
 * Body: { buyerAddress, signedTx?, txHash?, payload? }
 */

/**
 * Verify that a confirmed GOAT transaction contains an ERC-20 USDC Transfer of at
 * least `expectedAmount` to `expectedRecipient`. Waits for the receipt.
 */
async function verifyUsdcPayment(
  txHash: string,
  expectedAmount: string,
  expectedRecipient: string,
): Promise<void> {
  const client = getPublicClient();
  const receipt = await client.waitForTransactionReceipt({ hash: txHash as Hex });
  if (receipt.status !== "success") {
    throw new Error("Payment transaction reverted on-chain");
  }

  const usdcAddress = getUSDCAddress().toLowerCase();
  const recipient = getAddress(expectedRecipient).toLowerCase();
  const minAmount = parseUnits(expectedAmount, USDC_DECIMALS);

  const valid = receipt.logs.some((log) => {
    if (log.address.toLowerCase() !== usdcAddress) return false;
    try {
      const decoded = decodeEventLog({
        abi: ERC20_TRANSFER_EVENT,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Transfer") return false;
      const { to, value } = decoded.args as { to: string; value: bigint };
      return to.toLowerCase() === recipient && value >= minAmount;
    } catch {
      return false;
    }
  });

  if (!valid) {
    throw new Error("Payment TX does not include required USDC payment to service recipient");
  }
}

/** Broadcast a raw signed EVM tx and verify its USDC payment. */
async function submitAndVerifyPayment(
  signedTx: string,
  expectedAmount: string,
  expectedRecipient: string,
): Promise<{ txHash: string }> {
  const client = getPublicClient();
  const txHash = await client.sendRawTransaction({
    serializedTransaction: (signedTx.startsWith("0x") ? signedTx : `0x${signedTx}`) as Hex,
  });
  await verifyUsdcPayment(txHash, expectedAmount, expectedRecipient);
  return { txHash };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { buyerAddress, signedTx, txHash: providedTxHash, payload } = body as {
      buyerAddress?: string;
      signedTx?: string;
      txHash?: string;
      payload?: Record<string, unknown>;
    };

    if (!buyerAddress) {
      return Response.json({ error: "buyerAddress is required" }, { status: 400 });
    }
    if (!signedTx && !providedTxHash) {
      return Response.json({ error: "signedTx (or txHash) is required" }, { status: 400 });
    }

    const [service, talos] = await Promise.all([
      db.select().from(tlsCommerceServices).where(eq(tlsCommerceServices.talosId, id)).limit(1).then(r => r[0] ?? null),
      db.select({ id: tlsTalos.id, agentOnline: tlsTalos.agentOnline, name: tlsTalos.name, agentWalletAddress: tlsTalos.agentWalletAddress })
        .from(tlsTalos).where(eq(tlsTalos.id, id)).limit(1).then(r => r[0] ?? null),
    ]);

    if (!talos) return Response.json({ error: "TALOS not found" }, { status: 404 });
    if (!service) return Response.json({ error: "This agent offers no services" }, { status: 404 });

    // Determine the expected payment recipient.
    const recipient = service.walletAddress ?? talos.agentWalletAddress;
    if (!recipient) {
      return Response.json({ error: "No payment recipient configured for this service" }, { status: 500 });
    }

    // Broadcast + verify if a signed tx is provided; otherwise verify the supplied txHash.
    let txHash: string;
    try {
      if (signedTx) {
        ({ txHash } = await submitAndVerifyPayment(signedTx, String(service.price), recipient));
      } else {
        txHash = providedTxHash!;
        await verifyUsdcPayment(txHash, String(service.price), recipient);
      }
    } catch (err: any) {
      return Response.json({ error: err?.shortMessage ?? err?.message ?? "Payment verification failed" }, { status: 402 });
    }

    // Replay prevention — same txHash can't be used twice
    const duplicate = await db.select({ id: tlsCommerceJobs.id })
      .from(tlsCommerceJobs).where(eq(tlsCommerceJobs.txHash, txHash)).limit(1).then(r => r[0] ?? null);
    if (duplicate) {
      return Response.json({ error: "Transaction already used for a job (replay)" }, { status: 409 });
    }

    // ── Instant fulfillment: run handler now and return result ────────
    if (service.fulfillmentMode === "instant") {
      let result: Record<string, unknown>;
      try {
        result = await fulfillInstant(service.serviceName, payload ?? {});
      } catch (err: any) {
        return Response.json(
          { error: `Fulfillment failed: ${err?.message ?? "unknown error"}` },
          { status: 502 },
        );
      }

      const [job] = await db.transaction(async (tx) => {
        const [job] = await tx.insert(tlsCommerceJobs).values({
          talosId: id,
          requesterTalosId: `human:${buyerAddress}`,
          serviceName: service.serviceName,
          payload: payload ?? {},
          result,
          paymentSig: txHash,
          txHash,
          amount: service.price,
          status: "completed",
        }).returning();
        await tx.insert(tlsRevenues).values({
          talosId: id,
          amount: service.price,
          currency: service.currency ?? "USDC",
          source: "commerce",
          txHash,
        });
        return [job];
      });

      return Response.json(
        { jobId: job.id, status: "completed", serviceName: service.serviceName, result, txHash },
        { status: 201 },
      );
    }

    // ── Async: queue for agent to process ─────────────────────────────
    const [job] = await db.transaction(async (tx) => {
      const [job] = await tx.insert(tlsCommerceJobs).values({
        talosId: id,
        requesterTalosId: `human:${buyerAddress}`,
        serviceName: service.serviceName,
        payload: payload ?? {},
        paymentSig: txHash,
        txHash,
        amount: service.price,
        status: "pending",
      }).returning();

      await tx.insert(tlsRevenues).values({
        talosId: id,
        amount: service.price,
        currency: service.currency ?? "USDC",
        source: "commerce",
        txHash,
      });

      return [job];
    });

    return Response.json(
      {
        jobId: job.id,
        status: "pending",
        serviceName: service.serviceName,
        amount: Number(service.price),
        txHash,
        message: `Job queued. The agent will process your request and you can poll for results.`,
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    if (e?.code === "23505") {
      return Response.json({ error: "Transaction already used for a job (replay)" }, { status: 409 });
    }
    console.error("[jobs POST]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/talos/:id/jobs?txHash=xxx  or  ?jobId=xxx
 * Poll job status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const txHash = searchParams.get("txHash");

  if (!jobId && !txHash) {
    return Response.json({ error: "Provide jobId or txHash" }, { status: 400 });
  }

  try {
    const job = jobId
      ? await db.select().from(tlsCommerceJobs)
          .where(eq(tlsCommerceJobs.id, jobId)).limit(1).then(r => r[0] ?? null)
      : await db.select().from(tlsCommerceJobs)
          .where(eq(tlsCommerceJobs.txHash, txHash!)).limit(1).then(r => r[0] ?? null);

    if (!job || job.talosId !== id) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    return Response.json({
      jobId: job.id,
      status: job.status,
      serviceName: job.serviceName,
      result: job.result,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
