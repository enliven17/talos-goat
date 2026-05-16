/**
 * x402 payments on GOAT Network — sign, verify, and settle.
 * Replaces `stellar-x402.ts` (Soroban auth entries + OpenZeppelin facilitator).
 *
 * GOAT's x402 is a hosted merchant API at `https://api.goatx402.com`, wrapped by
 * AgentKit's `GoatAdapter` (create → authorize → status). It requires merchant
 * credentials: GOAT_X402_BASE_URL / GOAT_X402_API_KEY / GOAT_X402_API_SECRET.
 *
 * When credentials are absent (local/dev), we fall back to a direct on-chain
 * ERC-20 transfer via AgentKit's EvmWalletProvider so the agent-to-agent loop
 * still works on testnet. Return shapes are kept stable so the
 * /api/talos/:id/sign route and the Python agent proxy don't change.
 */

import { WGBTC_ADDRESS } from "./goat-chain";
import { getGoatAdapter, getEvmWallet } from "./agentkit";

const X402_HOSTED =
  Boolean(process.env.GOAT_X402_API_KEY && process.env.GOAT_X402_API_SECRET);

export interface X402PaymentPayload {
  /** EVM address of the payer (agent's wallet). */
  from: string;
  /** EVM address of the payee (service provider). */
  to: string;
  /** Amount in token base units (string). */
  amount: string;
  /** ERC-20 token address; defaults to WGBTC (GOAT's canonical ERC-20). */
  token?: string;
}

/**
 * Create an x402 payment authorization on behalf of the agent.
 * Hosted path → returns the GOAT paymentId. Dev fallback → returns the tx hash.
 */
export async function signX402Payment(
  agentSecretKey: string,
  payload: X402PaymentPayload,
): Promise<{ paymentToken: string }> {
  const asset = payload.token ?? WGBTC_ADDRESS;

  if (X402_HOSTED) {
    const adapter = await getGoatAdapter();
    const res = await adapter.x402CreatePayment({
      to: payload.to,
      asset,
      amount: payload.amount,
      fromAddress: payload.from,
    });
    // Authorize immediately (server holds the payer key). Some flows require an
    // EIP-712 signature; GoatAdapter accepts an optional signature argument.
    try {
      await adapter.x402AuthorizePayment(res.paymentId);
    } catch (err) {
      console.warn("[x402] authorize deferred to settle step:", err);
    }
    return { paymentToken: res.paymentId };
  }

  // Dev fallback: settle directly with an on-chain ERC-20 transfer.
  console.warn(
    "[x402] GOAT_X402_API_KEY/SECRET not set — settling via direct ERC-20 transfer (dev mode).",
  );
  const wallet = await getEvmWallet(agentSecretKey);
  const { txHash } = await wallet.transferErc20(asset, payload.to, payload.amount);
  return { paymentToken: txHash };
}

/**
 * Verify an x402 payment. Hosted → checks GOAT order status.
 * Dev fallback → a tx-hash token is treated as already settled.
 */
export async function verifyX402Payment(
  paymentToken: string,
  _expectedAmount: string,
  _expectedTo: string,
): Promise<boolean> {
  if (!X402_HOSTED) {
    return paymentToken.startsWith("0x") && paymentToken.length === 66;
  }
  try {
    const adapter = await getGoatAdapter();
    const status = await adapter.x402GetPaymentStatus(paymentToken);
    return status.status === "authorized" || status.status === "settled";
  } catch (err) {
    console.error("[x402] verifyX402Payment failed:", err);
    return false;
  }
}

/**
 * Settle an x402 payment. Hosted → authorize/confirm the GOAT order.
 * Dev fallback → the token already IS the settlement tx hash.
 */
export async function settleX402Payment(
  paymentToken: string,
): Promise<{ txHash: string }> {
  if (!X402_HOSTED) {
    return { txHash: paymentToken };
  }
  const adapter = await getGoatAdapter();
  const res = await adapter.x402AuthorizePayment(paymentToken);
  // The settlement tx hash, if any, surfaces in the raw payload.
  const raw = res.raw as { txHash?: string } | undefined;
  return { txHash: raw?.txHash ?? paymentToken };
}

/** Build the X-Payment header value for an x402 request. */
export function buildX402Header(paymentToken: string): string {
  return `x402 ${paymentToken}`;
}
