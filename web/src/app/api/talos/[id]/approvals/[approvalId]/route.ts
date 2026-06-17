import { NextRequest } from "next/server";
import { db } from "@/db";
import { tlsTalos, tlsApprovals, tlsPatrons } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { recordApprovalOnChain } from "@/lib/goat";
import { withRoute } from "@/lib/api-handler";
import { parseBody, decideApprovalSchema } from "@/lib/schemas";

// PATCH /api/talos/:id/approvals/:approvalId — Approve/reject
export const PATCH = withRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string; approvalId: string }> }
) => {
  const { id, approvalId } = await params;

    const talos = await db
      .select({ id: tlsTalos.id })
      .from(tlsTalos)
      .where(eq(tlsTalos.id, id))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!talos) {
      return Response.json({ error: "TALOS not found" }, { status: 404 });
    }

    const existing = await db
      .select()
      .from(tlsApprovals)
      .where(eq(tlsApprovals.id, approvalId))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!existing || existing.talosId !== id) {
      return Response.json({ error: "Approval not found" }, { status: 404 });
    }

    const parsed = await parseBody(request, decideApprovalSchema);
    if (parsed.error) return parsed.error;
    const { status, decidedBy } = parsed.data;

    // Verify the caller is an active Patron (Creator or Investor) of this TALOS
    const patron = await db
      .select()
      .from(tlsPatrons)
      .where(
        and(
          eq(tlsPatrons.talosId, id),
          eq(sql`${tlsPatrons.walletAddress}`, decidedBy),
          eq(tlsPatrons.status, "active")
        )
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!patron) {
      return Response.json(
        { error: "Only active Patrons can approve or reject decisions" },
        { status: 403 }
      );
    }

    // Record approval decision on GOAT Network
    const onChainResult = await recordApprovalOnChain(
      approvalId,
      id,
      status,
      decidedBy,
    );

    const [approval] = await db
      .update(tlsApprovals)
      .set({
        status,
        decidedAt: new Date(),
        decidedBy,
        txHash: onChainResult?.txHash ?? null,
      })
      .where(eq(tlsApprovals.id, approvalId))
      .returning();

    return Response.json(approval);
});
