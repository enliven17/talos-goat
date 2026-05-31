/**
 * check-balances.ts — Print native BTC + USDC balances for an account on GOAT.
 *
 * Run:
 *   GOAT_OPERATOR_PRIVATE_KEY=0x... GOAT_USDC_ADDRESS=0x... npx tsx scripts/check-balances.ts
 *   # or check an arbitrary address:
 *   GOAT_USDC_ADDRESS=0x... npx tsx scripts/check-balances.ts 0xabc...def
 */

import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import { getBTCBalance, getUSDCBalance } from "../src/lib/goat";
import { normalizePrivateKey } from "../src/lib/goat-chain";

function resolveAddress(): string {
  const argAddress = process.argv[2];
  if (argAddress) return argAddress;

  if (process.env.GOAT_OPERATOR_ADDRESS) return process.env.GOAT_OPERATOR_ADDRESS;

  const secret = process.env.GOAT_OPERATOR_PRIVATE_KEY;
  if (!secret) {
    console.error(
      "Provide an address argument, or set GOAT_OPERATOR_ADDRESS / GOAT_OPERATOR_PRIVATE_KEY",
    );
    process.exit(1);
  }
  return privateKeyToAccount(normalizePrivateKey(secret)).address;
}

async function main() {
  const address = resolveAddress();
  console.log("Account:", address, "\n");

  const [btc, usdc] = await Promise.all([
    getBTCBalance(address),
    getUSDCBalance(address),
  ]);

  console.log("All balances:");
  console.log(`  BTC (native gas): ${btc}`);
  console.log(`  USDC:             ${usdc}`);
}

main().catch((err) => {
  console.error("check-balances failed:", err);
  process.exit(1);
});
