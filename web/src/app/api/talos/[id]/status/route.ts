import { NextRequest } from "next/server";
import { db } from "@/db";
import { tlsTalos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgent, withRoute } from "@/lib/api-handler";
import { parseBody, updateStatusSchema } from "@/lib/schemas";

// PATCH /api/talos/:id/status — Agent status update (online/offline)
export const PATCH = withRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

    await requireAgent(request, id);

    const parsed = await parseBody(request, updateStatusSchema);
    if (parsed.error) return parsed.error;
    const { agentOnline } = parsed.data;

    const [updated] = await db
      .update(tlsTalos)
      .set({
        agentOnline,
        agentLastSeen: new Date(),
      })
      .where(eq(tlsTalos.id, id))
      .returning();

    return Response.json({
      id: updated.id,
      agentOnline: updated.agentOnline,
      agentLastSeen: updated.agentLastSeen,
    });
});
