import { NextRequest } from "next/server";
import { db } from "@/db";
import { tlsTalos, tlsActivities } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAgent, withRoute } from "@/lib/api-handler";
import { parseBody, reportActivitySchema } from "@/lib/schemas";

// GET /api/talos/:id/activity — Get activities
export const GET = withRoute(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

    const talos = await db
      .select({ id: tlsTalos.id })
      .from(tlsTalos)
      .where(eq(tlsTalos.id, id))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!talos) {
      return Response.json({ error: "TALOS not found" }, { status: 404 });
    }

    const activities = await db
      .select()
      .from(tlsActivities)
      .where(eq(tlsActivities.talosId, id))
      .orderBy(desc(tlsActivities.createdAt))
      .limit(50);

    return Response.json(activities);
});

// POST /api/talos/:id/activity — Report activity (from Local Agent)
export const POST = withRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

    await requireAgent(request, id);

    const parsed = await parseBody(request, reportActivitySchema);
    if (parsed.error) return parsed.error;
    const { type, content, channel, status } = parsed.data;

    const [activity] = await db
      .insert(tlsActivities)
      .values({
        talosId: id,
        type,
        content,
        channel,
        status: status ?? "completed",
      })
      .returning();

    return Response.json(activity, { status: 201 });
});
