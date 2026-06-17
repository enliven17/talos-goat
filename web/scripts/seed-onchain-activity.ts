/**
 * Seed commerce activity with real GOAT testnet transaction hashes.
 *
 * Usage:
 *   cd web
 *   pnpm exec tsx scripts/seed-onchain-activity.ts
 */

import dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { toHex } from "viem";
import { getPublicClient, getWalletClient } from "../src/lib/goat-chain";
import {
  tlsCommerceJobs,
  tlsCommerceServices,
  tlsPlaybookPurchases,
  tlsPlaybooks,
  tlsTalos,
} from "../src/db/schema";

dotenv.config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
const OPERATOR_KEY = process.env.GOAT_OPERATOR_PRIVATE_KEY;

if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!OPERATOR_KEY) throw new Error("GOAT_OPERATOR_PRIVATE_KEY is required");

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);
const operatorKey = OPERATOR_KEY;

type Agent = {
  id: string;
  name: string;
  agentName: string | null;
};

type Service = {
  talosId: string;
  serviceName: string;
  price: string;
};

type Playbook = {
  id: string;
  talosId: string;
  title: string;
};

const payloads = [
  {
    input: "Map the best buyer personas for a GOAT x402 launch.",
    result: "Audience segments, pain points, and top acquisition channels generated.",
  },
  {
    input: "Find high-intent leads discussing AI agent payments.",
    result: "Lead shortlist with relevance scores and outreach angles generated.",
  },
  {
    input: "Compare on-chain agent commerce competitors.",
    result: "Competitive matrix and positioning gaps generated.",
  },
  {
    input: "Detect market trend signals for AI wallets.",
    result: "Trend report with momentum score and example posts generated.",
  },
];

function pickRequester(agents: Agent[], sellerId: string, offset: number) {
  const candidates = agents.filter((agent) => agent.id !== sellerId);
  return candidates[offset % candidates.length];
}

async function sendActivityTx(label: string, index: number) {
  const wallet = getWalletClient(operatorKey);
  const memo = JSON.stringify({
    protocol: "talos",
    kind: "activity-seed",
    label,
    index,
    at: new Date().toISOString(),
  });

  const txHash = await wallet.sendTransaction({
    to: wallet.account.address,
    value: BigInt(0),
    data: toHex(memo),
  });

  await getPublicClient().waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

async function main() {
  console.log("Seeding GOAT-backed activity...");

  const agents = await db
    .select({
      id: tlsTalos.id,
      name: tlsTalos.name,
      agentName: tlsTalos.agentName,
    })
    .from(tlsTalos)
    .where(sql`${tlsTalos.agentName} is not null`)
    .orderBy(tlsTalos.createdAt);

  const services = await db
    .select({
      talosId: tlsCommerceServices.talosId,
      serviceName: tlsCommerceServices.serviceName,
      price: tlsCommerceServices.price,
    })
    .from(tlsCommerceServices)
    .limit(4);

  const playbooks = await db
    .select({
      id: tlsPlaybooks.id,
      talosId: tlsPlaybooks.talosId,
      title: tlsPlaybooks.title,
    })
    .from(tlsPlaybooks)
    .limit(4);

  if (agents.length < 2) throw new Error("Need at least two named agents");
  if (services.length === 0 && playbooks.length === 0) {
    throw new Error("Need at least one service or playbook");
  }

  let insertedJobs = 0;
  let insertedPurchases = 0;

  for (let i = 0; i < services.length; i++) {
    const service = services[i];
    const requester = pickRequester(agents, service.talosId, i);
    const txHash = await sendActivityTx(`service:${service.serviceName}`, i);
    const createdAt = new Date(Date.now() - i * 9 * 60_000);

    const inserted = await db
      .insert(tlsCommerceJobs)
      .values({
        talosId: service.talosId,
        requesterTalosId: requester.id,
        serviceName: service.serviceName,
        payload: { input: payloads[i % payloads.length].input },
        result: { output: payloads[i % payloads.length].result },
        status: "completed",
        paymentSig: `seed-goat-${txHash}`,
        txHash,
        amount: service.price,
        createdAt,
        updatedAt: createdAt,
      })
      .onConflictDoNothing({ target: tlsCommerceJobs.paymentSig })
      .returning({ id: tlsCommerceJobs.id });

    insertedJobs += inserted.length;
    console.log(`service ${service.serviceName}: ${txHash}`);
  }

  for (let i = 0; i < playbooks.length; i++) {
    const playbook = playbooks[i];
    const buyer = pickRequester(agents, playbook.talosId, i + 2);
    const existingPurchase = await db
      .select({ id: tlsPlaybookPurchases.id })
      .from(tlsPlaybookPurchases)
      .where(
        sql`${tlsPlaybookPurchases.playbookId} = ${playbook.id} and ${tlsPlaybookPurchases.buyerAddress} = ${buyer.id}`,
      )
      .limit(1);

    if (existingPurchase.length > 0) {
      console.log(`playbook ${playbook.title}: already purchased by ${buyer.name}, skipping`);
      continue;
    }

    const txHash = await sendActivityTx(`playbook:${playbook.title}`, i);
    const createdAt = new Date(Date.now() - (i * 11 + 5) * 60_000);

    const inserted = await db
      .insert(tlsPlaybookPurchases)
      .values({
        playbookId: playbook.id,
        buyerAddress: buyer.id,
        txHash,
        createdAt,
      })
      .onConflictDoNothing({
        target: [
          tlsPlaybookPurchases.playbookId,
          tlsPlaybookPurchases.buyerAddress,
        ],
      })
      .returning({ id: tlsPlaybookPurchases.id });

    insertedPurchases += inserted.length;
    console.log(`playbook ${playbook.title}: ${txHash}`);
  }

  console.log(`Inserted ${insertedJobs} service jobs and ${insertedPurchases} playbook purchases.`);
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
