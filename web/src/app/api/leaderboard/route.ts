import { db } from "@/db";
import { tlsTalos, tlsPatrons, tlsActivities, tlsRevenues } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { withRoute } from "@/lib/api-handler";

// GET /api/leaderboard — Ranking data
export const GET = withRoute(async () => {
    const patronCount = db
      .select({
        talosId: tlsPatrons.talosId,
        count: sql<number>`count(*)::int`.as("patronCount"),
      })
      .from(tlsPatrons)
      .groupBy(tlsPatrons.talosId)
      .as("patronCount");

    const activityCount = db
      .select({
        talosId: tlsActivities.talosId,
        count: sql<number>`count(*)::int`.as("activityCount"),
      })
      .from(tlsActivities)
      .groupBy(tlsActivities.talosId)
      .as("activityCount");

    const revenueSum = db
      .select({
        talosId: tlsRevenues.talosId,
        total: sql<number>`coalesce(sum(${tlsRevenues.amount}), 0)::float`.as("revenueTotal"),
      })
      .from(tlsRevenues)
      .groupBy(tlsRevenues.talosId)
      .as("revenueSum");

    const rows = await db
      .select({
        id: tlsTalos.id,
        name: tlsTalos.name,
        category: tlsTalos.category,
        status: tlsTalos.status,
        pulsePrice: tlsTalos.pulsePrice,
        totalSupply: tlsTalos.totalSupply,
        patronCount: patronCount.count,
        activityCount: activityCount.count,
        totalRevenue: revenueSum.total,
      })
      .from(tlsTalos)
      .leftJoin(patronCount, eq(tlsTalos.id, patronCount.talosId))
      .leftJoin(activityCount, eq(tlsTalos.id, activityCount.talosId))
      .leftJoin(revenueSum, eq(tlsTalos.id, revenueSum.talosId));

    const leaderboard = rows.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      status: c.status,
      pulsePrice: c.pulsePrice,
      totalSupply: c.totalSupply,
      patronCount: c.patronCount ?? 0,
      activityCount: c.activityCount ?? 0,
      totalRevenue: c.totalRevenue ?? 0,
      marketCap: Number(c.pulsePrice) * c.totalSupply,
    }));

    leaderboard.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return Response.json(leaderboard);
});
