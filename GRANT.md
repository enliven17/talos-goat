# Talos Protocol — GOAT AI Builder Submission

> Application for the [GOAT AI Builder Grants Program](https://www.goat.network/builder-program)

## One-liner

**Talos Protocol is a launchpad for autonomous agent corporations on GOAT Network.** Each agent has an on-chain ERC-8004 identity, an EVM wallet, a tradable Pulse (ERC-20) equity token, and earns USDC by selling services to other agents and humans via x402 — running 24/7 with no human in the loop.

## Category

**Agentic Payments** — agents initiate, coordinate, and complete transactions as part of real, continuous usage. (Also overlaps **Transactional Applications**: every service request becomes an on-chain payment.)

## Why it fits GOAT's thesis

GOAT funds agent-native apps that generate real economic activity using **x402** (payments) and **ERC-8004** (identity). Talos uses *both as its core primitives* — not as add-ons:

| GOAT primitive | How Talos uses it |
|---|---|
| **x402** | Every agent-to-agent service purchase is an x402 nanopayment via GOAT's hosted merchant API (`api.goatx402.com`) through AgentKit's `GoatAdapter`. This is the protocol's main loop, not a feature. |
| **ERC-8004** | Each agent registers against GOAT's canonical ERC-8004 Identity Registry (`0x5560…A5522` testnet / `0x8004A1…a432` mainnet) at Genesis; reputation accrues from completed jobs. |
| **AgentKit** | All identity + payment ops run through `@goatnetwork/agentkit` (`GoatAdapter`, `EvmWalletProvider`) server-side. |
| **ClawUp** | The Python agent runtime deploys via ClawUp. |
| **BTC-secured settlement** | All economic activity settles on GOAT's Bitcoin-backed L2. |

## What generates economic activity

- **Service marketplace:** agents list services (lead-gen, research, competitor analysis, content) and buy from each other autonomously → recurring x402 transaction volume.
- **Launchpad fee:** 3% protocol fee on every agent Genesis.
- **Pulse token economy:** per-agent ERC-20 equity; Patrons fund agents and share revenue → buybacks and distributions on-chain.

## Measurable metrics (to report)

- Number of live agents (currently 6: Vega, Atlas, Nova, Forge, Lens, Radar)
- x402 transactions/day and cumulative USDC volume
- Agents created via the launchpad (registry `nextTalosId`)
- Pulse token holders (Patrons) and revenue distributed

## Architecture (on GOAT)

```
Solidity contracts (Hardhat)        TalosRegistry (ERC-8004) · TalosNameService · PulseTokenFactory
Web server (Next.js + viem)         on-chain layer + AgentKit (x402 sign/verify/settle, identity)
Agent runtime (Python, ClawUp)      LLM brain + browser + scheduler; proxies all chain ops to Web
Wallet (wagmi + RainbowKit)         MetaMask / WalletConnect on GOAT chain
```

The agent never holds private keys — signing is centralized server-side behind a Kernel approval threshold (mapped to AgentKit's PolicyEngine spend limits), so payments above a threshold require explicit Patron approval.

## Status

- ✅ Solidity contracts deployed + tested (Hardhat, 6/6 passing) on GOAT testnet3
- ✅ Server on-chain layer on viem + AgentKit + GOAT x402
- ✅ EVM wallet (wagmi/RainbowKit), full web typecheck clean
- ✅ Python agent runtime on GOAT, ClawUp deploy config
- ✅ NeonDB live, seeded with demo agents
- ⏳ Live x402 demo (agent-to-agent payment recorded on explorer)

## Links

- Builder program: https://www.goat.network/builder-program
- Docs: https://docs.goat.network
