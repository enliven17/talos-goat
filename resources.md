# Resources

Curated resources for building Talos Protocol on **GOAT Network** — the agentic-economy
stack (x402 payments + ERC-8004 identity) on a Bitcoin-secured Type-1 zkEVM L2.

## GOAT Network — core

- **Docs:** https://docs.goat.network — concepts, networks, builders, AgentKit.
- **Networks & RPC:** https://docs.goat.network/network/networks-rpc
- **GitHub org:** https://github.com/GOATNetwork — `agentkit`, `goat-contracts`, `goat-docs`, sequencer, BitVM2.
- **Builder Program:** https://www.goat.network/builder-program — AI Builder Grants ($500 base → $1M Singularity).

### Network parameters (verified against `@goatnetwork/agentkit`)

| | Testnet3 | Mainnet |
|---|---|---|
| Chain ID | `48816` | `2345` |
| RPC | `https://rpc.testnet3.goat.network` | `https://rpc.goat.network` |
| Explorer | `https://explorer.testnet3.goat.network` | `https://explorer.goat.network` |
| Gas token | BTC | BTC |
| Faucet | GOAT Testnet3 faucet (0.01 BTC/day) | — |

### Canonical addresses

- **WGBTC** (Wrapped GOAT BTC, the native ERC-20): `0xBC10000000000000000000000000000000000000`
- **GOAT token:** `0xbC10000000000000000000000000000000000001`
- **ERC-8004 Identity Registry:** `0x556089008Fc0a60cD09390Eca93477ca254A5522` (testnet3) · `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (mainnet)
- **ERC-8004 Reputation Registry:** `0xd9140951d8aE6E5F625a02F5908535e16e3af964` (testnet3) · `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` (mainnet)

> Note: GOAT's token registry has **no native USDC**. Price services in WGBTC by
> default, or bridge a USDC (e.g. via Stargate) and set `GOAT_USDC_ADDRESS`.

## AgentKit

- **Package:** `@goatnetwork/agentkit` (`npm install @goatnetwork/agentkit`)
- **Scaffold:** `npm create goat-agent` — presets: `minimal` (10 actions), `defi` (27), `full` (118).
- **Architecture:** `ActionProvider` + `PolicyEngine` + `ExecutionRuntime`; wallet via `EvmWalletProvider`; high-level GOAT API via `GoatAdapter`.
- **Plugins:** `x402`, `x402-merchant`, `erc8004`, `bridge`, `bitvm2`, `wgbtc`, `dex`, `faucet`, `goat-token`, `erc721`, `layerzero`, `bitcoin`.
- **Framework exports:** `provider.openAITools()`, `langChainToolDefs()`, `mcpTools()`, `vercelAITools()`, `openAIAgentsTools()`.

## x402 (agentic payments)

- **Protocol spec:** https://www.x402.org/ — per-request HTTP 402 payment protocol.
- **Coinbase x402 docs:** https://docs.cdp.coinbase.com/x402/docs/welcome
- **GOAT x402 (hosted merchant API):** `https://api.goatx402.com` — used by AgentKit's `GoatAdapter` (`x402CreatePayment` → `x402AuthorizePayment` → `x402GetPaymentStatus`). Requires `GOAT_X402_API_KEY` / `GOAT_X402_API_SECRET`.
- **Flow:** payer signs an EIP-712 authorization (`EvmPayerWalletAdapter`); merchant gateway (`HttpMerchantGatewayAdapter`) verifies and settles.

## ERC-8004 (agent identity & reputation)

- On-chain agent registration with portable, machine-readable metadata + verifiable reputation.
- AgentKit `erc8004` plugin: `registerAgent`, `setAgentUri`, `getMetadata`, `giveFeedback`, `getReputation`, …
- Registers against GOAT's canonical Identity/Reputation registries (addresses above).

## EVM dev tooling used here

- **Contracts:** Hardhat + OpenZeppelin (`contracts/`, Solidity 0.8.24, `viaIR`).
- **Web on-chain layer:** [viem](https://viem.sh) (`web/src/lib/goat-chain.ts`, `goat.ts`, `contracts.ts`).
- **Wallet:** [wagmi](https://wagmi.sh) + [RainbowKit](https://www.rainbowkit.com) (MetaMask / WalletConnect).
- **Signing SDK:** [ethers v6](https://docs.ethers.org) (used by AgentKit).

## In this repo

- [`README.md`](README.md) — how it works on GOAT, stack, quick start.
- [`GRANT.md`](GRANT.md) — GOAT AI Builder Grant submission (Agentic Payments).
- [`contracts/README.md`](contracts/README.md) — Solidity contracts + deploy.
- [`packages/prime-agent/DEPLOY.md`](packages/prime-agent/DEPLOY.md) — ClawUp deployment.
