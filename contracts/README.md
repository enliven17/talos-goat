# Talos Protocol — GOAT Network Smart Contracts

EVM/Solidity smart contracts for the Talos Protocol on **GOAT Network** (Bitcoin-secured, Type-1 zkEVM L2). Built with Hardhat + OpenZeppelin. Ported from the original Soroban (Rust) contracts.

## Contracts

### 1. TalosRegistry (`src/TalosRegistry.sol`)
- Creates and manages Talos agent corporations on-chain
- Patron configuration (creator/investor/treasury shares)
- Kernel policy (approval threshold, GTM budget, min patron pulse)
- Pulse token metadata
- 3% protocol fee config (`PROTOCOL_FEE_BPS = 300`)
- **ERC-8004 alignment:** `metadataURI` per agent + `AgentRegistered` event
- Events: `TalosCreated`, `PatronUpdated`, `KernelUpdated`, `PulseUpdated`, `TalosDeactivated`, `AgentRegistered`

### 2. TalosNameService (`src/TalosNameService.sol`)
- Human-readable name → Talos ID mapping (e.g. `marketbot` → 42)
- On-chain length guard (3–32 bytes); character rules enforced off-chain
- Events: `NameRegistered`

### 3. PulseToken / PulseTokenFactory (`src/PulseToken.sol`, `src/PulseTokenFactory.sol`)
- ERC-20 per-agent equity token (the EVM replacement for classic Stellar "Mitos" assets)
- Factory mints the full supply to the treasury at genesis and records `tokenOfTalos[id]`

## Prerequisites

```bash
pnpm install            # hardhat + @openzeppelin/contracts + toolbox
```

Fund your deployer address with testnet BTC from the GOAT faucet (0.01 BTC/day).

## Build & Test

```bash
pnpm build              # hardhat compile
pnpm test               # hardhat test (test/talos.test.ts)
```

## Deploy

Copy `.env.example` → `.env` and set `DEPLOYER_PRIVATE_KEY` (+ optionally `PROTOCOL_WALLET`, RPC overrides).

```bash
pnpm deploy:testnet     # GOAT testnet (goatTestnet network)
pnpm deploy:mainnet     # GOAT mainnet (goatMainnet network)
```

The script prints the three addresses to copy into `web/.env.local`:

```
NEXT_PUBLIC_TALOS_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_TALOS_NAME_SERVICE_ADDRESS=0x...
NEXT_PUBLIC_PULSE_TOKEN_FACTORY_ADDRESS=0x...
```

> ⚠️ Network values (RPC URLs, chain IDs) are env-overridable in `hardhat.config.ts`.
> AgentKit references chainId **48816 (Testnet3)**; confirm the canonical RPC/chainId
> in [docs.goat.network](https://docs.goat.network) before mainnet deployment.

## Project Structure

```
contracts/
├── hardhat.config.ts
├── package.json
├── tsconfig.json
├── src/
│   ├── TalosRegistry.sol
│   ├── TalosNameService.sol
│   ├── PulseToken.sol
│   └── PulseTokenFactory.sol
├── scripts/
│   └── deploy.ts
└── test/
    └── talos.test.ts
```

## License

MIT
