import { NextRequest } from "next/server";
import { db } from "@/db";
import { tlsTalos, tlsApprovals, tlsPatrons } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { withRoute } from "@/lib/api-handler";
import { parseBody, createApprovalSchema } from "@/lib/schemas";

// GET /api/talos/:id/approvals — Pending approval list
// Public read (no auth) — patrons need to see approvals to vote
// Agent-authenticated write is handled in POST
export const GET = withRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // optional filter: pending | approved | rejected

    const rows = await db
      .select()
      .from(tlsApprovals)
      .where(
        status
          ? and(eq(tlsApprovals.talosId, id), eq(tlsApprovals.status, status))
          : eq(tlsApprovals.talosId, id),
      )
      .orderBy(desc(tlsApprovals.createdAt));

    return Response.json(rows);
});

// POST /api/talos/:id/approvals — Create approval request
// Can be called by: local agent (Bearer api_key) OR active patron (proposerPublicKey)
export const POST = withRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

    const talos = await db
      .select()
      .from(tlsTalos)
      .where(eq(tlsTalos.id, id))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!talos) {
      return Response.json({ error: "TALOS not found" }, { status: 404 });
    }

    const parsed = await parseBody(request, createApprovalSchema);
    if (parsed.error) return parsed.error;
    const { type, title, description, amount, proposerPublicKey } = parsed.data;

    // Auth: either agent API key or active patron
    const authHeader = request.headers.get("authorization");
    const isAgentAuth = authHeader?.startsWith("Bearer ");

    if (!isAgentAuth) {
      if (!proposerPublicKey) {
        return Response.json({ error: "proposerPublicKey required for patron proposals" }, { status: 401 });
      }
      const patron = await db
        .select({ id: tlsPatrons.id })
        .from(tlsPatrons)
        .where(and(eq(tlsPatrons.talosId, id), eq(tlsPatrons.walletAddress, proposerPublicKey), eq(tlsPatrons.status, "active")))
        .limit(1)
        .then(r => r[0] ?? null);
      if (!patron) {
        return Response.json({ error: "Only active patrons can propose approvals" }, { status: 403 });
      }
    }

    // State machine guard: prevent duplicate pending approvals of the same type.
    // Agent should resolve the existing one before creating another.
    const existing = await db
      .select({ id: tlsApprovals.id })
      .from(tlsApprovals)
      .where(
        and(
          eq(tlsApprovals.talosId, id),
          eq(tlsApprovals.type, type),
          eq(tlsApprovals.status, "pending"),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    if (existing) {
      return Response.json(
        {
          error: "An approval of this type is already pending",
          existingId: existing.id,
        },
        { status: 409 },
      );
    }

    const [approval] = await db
      .insert(tlsApprovals)
      .values({
        talosId: id,
        type,
        title,
        description,
        amount: amount != null ? String(amount) : undefined,
      })
      .returning();

    return Response.json(approval, { status: 201 });
});
