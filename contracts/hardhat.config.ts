import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

// ── GOAT Network config ───────────────────────────────────────────────
// NOTE: confirm canonical values in the GOAT docs (docs.goat.network).
// AgentKit references chainId 48816 (Testnet3); some explorers list 2345.
// All values are env-overridable so we never hardcode an unverified URL.
const GOAT_TESTNET_RPC =
  process.env.GOAT_TESTNET_RPC ?? "https://rpc.testnet3.goat.network";
const GOAT_TESTNET_CHAIN_ID = Number(process.env.GOAT_TESTNET_CHAIN_ID ?? 48816);
const GOAT_MAINNET_RPC =
  process.env.GOAT_MAINNET_RPC ?? "https://rpc.goat.network";
const GOAT_MAINNET_CHAIN_ID = Number(process.env.GOAT_MAINNET_CHAIN_ID ?? 2345);

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? "";
const accounts = DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  paths: {
    sources: "./src",
  },
  networks: {
    goatTestnet: {
      url: GOAT_TESTNET_RPC,
      chainId: GOAT_TESTNET_CHAIN_ID,
      accounts,
    },
    goatMainnet: {
      url: GOAT_MAINNET_RPC,
      chainId: GOAT_MAINNET_CHAIN_ID,
      accounts,
    },
  },
};

export default config;
