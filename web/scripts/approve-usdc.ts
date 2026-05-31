/**
 * approve-usdc.ts — GOAT Network (EVM) replacement for the old Stellar
 * add-usdc-trustline.ts. ERC-20 tokens need no trustline, but the x402
 * facilitator may require an ERC-20 allowance, so this script approves a
 * spender to move the operator's USDC.
 *
 * Run:
 *   GOAT_OPERATOR_PRIVATE_KEY=0x... \
 *   GOAT_USDC_ADDRESS=0x... \
 *   X402_SPENDER_ADDRESS=0x... \
 *   npx tsx scripts/approve-usdc.ts [amount]
 *
 * `amount` is human-readable USDC (default "1000000"). Pass "max" for an
 * effectively unlimited allowance.
 */

import "dotenv/config";
import { maxUint256, parseUnits } from "viem";
import { approveUSDC, getUSDCAddress, USDC_DECIMALS } from "../src/lib/goat";
import { getWalletClient } from "../src/lib/goat-chain";

const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

async function main() {
  const operatorSecret = process.env.GOAT_OPERATOR_PRIVATE_KEY;
  if (!operatorSecret) {
    console.error("GOAT_OPERATOR_PRIVATE_KEY is not set");
    process.exit(1);
  }

  const spender = process.env.X402_SPENDER_ADDRESS ?? process.env.GOAT_USDC_SPENDER;
  if (!spender) {
    console.error("X402_SPENDER_ADDRESS (the allowed spender, e.g. the x402 facilitator) is not set");
    process.exit(1);
  }

  const usdc = getUSDCAddress();
  const amountArg = process.argv[2] ?? "1000000";
  console.log(`USDC token:   ${usdc}`);
  console.log(`Spender:      ${spender}`);
  console.log(`Allowance:    ${amountArg}`);

  if (amountArg === "max") {
    // Unlimited allowance — approveUSDC parses human units, so call writeContract directly.
    const wallet = getWalletClient(operatorSecret);
    const txHash = await wallet.writeContract({
      address: usdc,
      abi: ERC20_APPROVE_ABI,
      functionName: "approve",
      args: [spender as `0x${string}`, maxUint256],
    });
    console.log(`Approved (max): ${txHash}`);
    return;
  }

  // Validate the amount parses at USDC decimals before sending.
  parseUnits(amountArg, USDC_DECIMALS);
  const { txHash } = await approveUSDC(operatorSecret, spender, amountArg);
  console.log(`Approved ${amountArg} USDC: ${txHash}`);
}

main().catch((err) => {
  console.error("approve-usdc failed:", err);
  process.exit(1);
});
