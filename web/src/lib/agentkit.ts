/**
 * GOAT AgentKit integration (`@goatnetwork/agentkit`).
 *
 * AgentKit is GOAT's TypeScript agent infrastructure. We use three real exports:
 *   - `GoatAdapter`         — hosted x402 payment API (create/authorize/status)
 *   - `EvmWalletProvider`   — ethers-backed wallet (balances, transfers, signTypedData)
 *   - `getIdentityRegistryAddress` + `erc8004RegisterAgentAction` — ERC-8004 identity
 *
 * The Talos Web server is the only component that holds agent private keys, so
 * AgentKit runs HERE (behind the /api/talos/:id/* routes), not in the Python
 * agent runtime. Each call is bound to a single agent's server-side secret key.
 *
 * x402 on GOAT is a hosted merchant API at `https://api.goatx402.com`
 * (GoatAdapter reads GOAT_X402_BASE_URL / GOAT_X402_API_KEY / GOAT_X402_API_SECRET).
 */

import {
  GOAT_AGENTKIT_NETWORK,
  ERC8004_IDENTITY_REGISTRY,
  normalizePrivateKey,
} from "./goat-chain";

/** A `GoatAdapter` for the configured network (x402 + bitvm2 bridge API). */
export async function getGoatAdapter() {
  const { GoatAdapter } = await import("@goatnetwork/agentkit");
  return new GoatAdapter(
    GOAT_AGENTKIT_NETWORK as "goat-mainnet" | "goat-testnet",
  );
}

/**
 * An `EvmWalletProvider` bound to a server-held agent key.
 * Backed by ethers; exposes signTypedData / transferErc20 / approveErc20 / writeContract.
 */
export async function getEvmWallet(privateKey: string) {
  const { EvmWalletProvider } = await import("@goatnetwork/agentkit");
  const { goatNetworks } = await import("@goatnetwork/agentkit");
  const { Wallet, JsonRpcProvider } = await import("ethers");

  const net = goatNetworks[GOAT_AGENTKIT_NETWORK as "goat-mainnet" | "goat-testnet"];
  const provider = new JsonRpcProvider(net.rpcUrl);
  const signer = new Wallet(normalizePrivateKey(privateKey), provider);
  return new EvmWalletProvider(signer, provider, GOAT_AGENTKIT_NETWORK);
}

/**
 * Register (or update) an ERC-8004 agent identity against GOAT's canonical
 * Identity Registry. Used at TALOS Genesis alongside TalosRegistry.createTalos.
 *
 * Uses the standard ERC-8004 `register(string)` entrypoint via the wallet's
 * writeContract. Best-effort: if the registry's selector differs on this
 * network, the call is caught and reported, never blocking Genesis.
 */
export async function registerAgentIdentity(
  privateKey: string,
  metadataURI: string,
): Promise<{ txHash?: string; registry: string; error?: string }> {
  try {
    const wallet = await getEvmWallet(privateKey);
    const { txHash } = await wallet.writeContract(
      ERC8004_IDENTITY_REGISTRY,
      ["function register(string agentURI) returns (uint256)"],
      "register",
      [metadataURI],
    );
    return { txHash, registry: ERC8004_IDENTITY_REGISTRY };
  } catch (err) {
    return {
      registry: ERC8004_IDENTITY_REGISTRY,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
