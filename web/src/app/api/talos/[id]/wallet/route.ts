import { NextRequest } from "next/server";
import { db } from "@/db";
import { tlsTalos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgent, withRoute } from "@/lib/api-handler";

// GET /api/talos/:id/wallet — Agent fetches its GOAT (EVM) wallet info at startup
export const GET = withRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

    await requireAgent(request, id);

    const talos = await db
      .select({
        agentWalletId: tlsTalos.agentWalletId,
        agentWalletAddress: tlsTalos.agentWalletAddress,
      })
      .from(tlsTalos)
      .where(eq(tlsTalos.id, id))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!talos?.agentWalletId) {
      return Response.json({ error: "No agent wallet for this TALOS" }, { status: 404 });
    }

    return Response.json({
      agentWalletId: talos.agentWalletId,
      agentWalletAddress: talos.agentWalletAddress,
    });
});
