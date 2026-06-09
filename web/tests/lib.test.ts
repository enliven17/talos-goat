import { describe, it, expect } from "vitest";
import {
  normalizePrivateKey,
  explorerTxUrl,
  goatChain,
  WGBTC_ADDRESS,
} from "../src/lib/goat-chain";
import { isValidAddress, getUSDCAddress, USDC_DECIMALS } from "../src/lib/goat";
import { buildX402Header } from "../src/lib/x402";
import { isNameAvailableOnChain, resolveNameOnChain } from "../src/lib/contracts";

describe("goat-chain", () => {
  it("normalizes private keys to 0x-prefixed", () => {
    expect(normalizePrivateKey("abc123")).toBe("0xabc123");
    expect(normalizePrivateKey("0xabc123")).toBe("0xabc123");
  });

  it("builds explorer tx URLs", () => {
    expect(explorerTxUrl("0xdead")).toMatch(/\/tx\/0xdead$/);
  });

  it("uses BTC as the native gas token", () => {
    expect(goatChain.nativeCurrency.symbol).toBe("BTC");
    expect(typeof goatChain.id).toBe("number");
  });
});

describe("goat payment token", () => {
  it("validates EVM addresses (strict EIP-55 checksum)", () => {
    // A properly checksummed address (as produced by viem/wagmi) passes.
    expect(isValidAddress("0xEf2869a6F377b921c859DdF68208bf8767644431")).toBe(true);
    // All-lowercase is also accepted by viem's isAddress.
    expect(isValidAddress("0xef2869a6f377b921c859ddf68208bf8767644431")).toBe(true);
    expect(isValidAddress("not-an-address")).toBe(false);
    expect(isValidAddress("GABC123")).toBe(false); // old Stellar format rejected
  });

  it("defaults the payment token to WGBTC (18 decimals) when no USDC is configured", () => {
    // No GOAT_USDC_ADDRESS in the test env → falls back to WGBTC.
    expect(getUSDCAddress().toLowerCase()).toBe(WGBTC_ADDRESS.toLowerCase());
    expect(USDC_DECIMALS).toBe(18);
  });
});

describe("x402", () => {
  it("builds the X-Payment header", () => {
    expect(buildX402Header("tok_123")).toBe("x402 tok_123");
  });
});

describe("name service (no contract deployed → regex fallback)", () => {
  it("accepts valid names and rejects invalid ones", async () => {
    expect(await isNameAvailableOnChain("marketbot")).toBe(true);
    expect(await isNameAvailableOnChain("market-bot-9")).toBe(true);
    expect(await isNameAvailableOnChain("Bad_Name")).toBe(false); // uppercase + underscore
    expect(await isNameAvailableOnChain("double--hyphen")).toBe(false);
  });

  it("resolveName returns null when no registry is configured", async () => {
    expect(await resolveNameOnChain("marketbot")).toBeNull();
  });
});
