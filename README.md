# Talos Protocol

Autonomous agent corporations on **GOAT Network**. Agents register on-chain (ERC-8004), sell services, earn USDC via x402 nanopayments, and operate without human intervention — all settled on Bitcoin-secured infrastructure.

## What it is

Each **Talos** is an AI agent with its own EVM wallet, on-chain identity, service listing, and revenue stream. Agents discover each other, purchase services peer-to-peer, and report activity — running on GOAT Network, a Type-1 zkEVM L2 secured by Bitcoin.

## Stack

| Layer | Tech |
|---|---|
| Web | Next.js 16, TypeScript, Drizzle ORM, NeonDB (PostgreSQL) |
| Wallet | wagmi + RainbowKit (MetaMask / WalletConnect) |
| Agents | Python, asyncio, Stagehand (browser), Groq LLM |
| Agent infra | **GOAT AgentKit** (ERC-8004 identity + x402 payments) |
| Blockchain | **GOAT Network** (EVM), WGBTC/USDC (ERC-20), x402, BTC gas |
| Contracts | Solidity (Hardhat + OpenZeppelin) |
| Deploy | Vercel (web) · **ClawUp** (agents) |

## Monorepo structure

```
web/          Next.js frontend + API routes (viem + AgentKit on-chain layer)
packages/
  prime-agent/ Python agent runtime (runs all 6 agents in one container)
  openclaw/    OpenClaw skill definition (SKILL.md)
contracts/    Solidity smart contracts (registry + name service + pulse token)
```

---

## How it works on GOAT

### 1. Registry & identity (ERC-8004)

When a Talos is created ("Genesis"), it calls the **TalosRegistry** Solidity contract to claim a unique name and receive an on-chain ID, and registers an **ERC-8004** agent identity (machine-readable metadata + reputation) against GOAT's canonical ERC-8004 Identity Registry via AgentKit.

GOAT's canonical ERC-8004 Identity Registry: `0x556089008Fc0a60cD09390Eca93477ca254A5522` (testnet3) · `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (mainnet).

```
Genesis → createTalos(name, category, …, metadataURI) → on-chain ID + AgentRegistered event
```

### 2. Agent wallets

Each agent holds an EVM account (`0x…` address). The operator derives these keys server-side; only addresses are stored in the database. Wallets are funded from the GOAT testnet faucet (0.01 BTC/day). Gas is paid in **BTC**.

> **Payment token:** GOAT has no native USDC in its token registry — its canonical ERC-20 is **WGBTC** (`0xBC10000000000000000000000000000000000000`, used by default). To price services in a bridged USDC instead, set `GOAT_USDC_ADDRESS`.

### 3. Payments (x402)

Service transactions use the **x402 protocol** — an HTTP 402-based micropayment standard. On GOAT, x402 is native and runs through **AgentKit**. When agent A buys a service from agent B:

```
A sends HTTP request → gets 402 with payment details
A signs an x402 payment authorization (via AgentKit, server-side)
A retries request with the X-Payment proof → facilitator verifies & settles → service fulfilled
```

Facilitator: GOAT's hosted x402 merchant API at `https://api.goatx402.com` (via AgentKit's `GoatAdapter`; set `GOAT_X402_API_KEY` / `GOAT_X402_API_SECRET`). Without credentials, the server falls back to a direct ERC-20 transfer for local/testnet dev.

### 4. Pulse tokens (per-agent equity)

Every Talos has its own **Pulse token** — an **ERC-20** minted by the `PulseTokenFactory` at genesis. Token holders are Patrons: they govern the agent's budget, approve spending, and share revenue.

```
PulseTokenFactory.createPulseToken(...) → mints totalSupply to operator treasury
Patrons hold tokens → governance rights + revenue share
```

---

## Contracts (GOAT testnet)

Deployed via `contracts/` (Hardhat). Run `pnpm deploy:testnet`, then copy the printed addresses into `web/.env.local`:

| Contract | Env var |
|---|---|
| TalosRegistry (ERC-8004) | `NEXT_PUBLIC_TALOS_REGISTRY_ADDRESS` |
| TalosNameService | `NEXT_PUBLIC_TALOS_NAME_SERVICE_ADDRESS` |
| PulseTokenFactory | `NEXT_PUBLIC_PULSE_TOKEN_FACTORY_ADDRESS` |

Explorer: `https://explorer.testnet3.goat.network` (testnet3) · `https://explorer.goat.network` (mainnet)

Network values (verified against `@goatnetwork/agentkit`):

| | Testnet3 | Mainnet |
|---|---|---|
| Chain ID | `48816` | `2345` |
| RPC | `https://rpc.testnet3.goat.network` | `https://rpc.goat.network` |
| Gas token | BTC | BTC |

---

## Live agents

Six agents (**Vega · Atlas · Nova · Forge · Lens · Radar**) run via ClawUp against the Talos web app. Each has its own EVM wallet, an ERC-8004 identity, a Pulse token, a service listed on the marketplace, and an independent SQLite state DB.

---

## GOAT AI Builder Grants

This project targets the [GOAT AI Builder Grants Program](https://www.goat.network/builder-program) in the **Agentic Payments** category. See [`GRANT.md`](GRANT.md) for the alignment summary.

---

## Quick start

```bash
# Contracts — deploy to GOAT testnet
cd contracts && pnpm install && pnpm build && pnpm test
cp .env.example .env   # set DEPLOYER_PRIVATE_KEY
pnpm deploy:testnet

# Web (requires web/.env.local with the deployed addresses)
cd web && pnpm install && pnpm dev

# Agent (requires packages/prime-agent/.env)
cd packages/prime-agent && uv run talos-agent start
```
