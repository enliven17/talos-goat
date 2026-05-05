import { ethers, network } from "hardhat";

// ─── Talos Protocol — GOAT Network Contract Deploy ─────────────────────
// Usage: pnpm deploy:testnet  (or)  hardhat run scripts/deploy.ts --network goatTestnet
//
// Prints the addresses you must add to web/.env.local:
//   NEXT_PUBLIC_TALOS_REGISTRY_ADDRESS=0x...
//   NEXT_PUBLIC_TALOS_NAME_SERVICE_ADDRESS=0x...
//   NEXT_PUBLIC_PULSE_TOKEN_FACTORY_ADDRESS=0x...

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`▶  Deploying to ${network.name} as ${deployer.address}`);

  const Registry = await ethers.getContractFactory("TalosRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log(`   TalosRegistry:      ${registryAddr}`);

  // Initialize the registry with the protocol wallet (defaults to deployer).
  const protocolWallet = process.env.PROTOCOL_WALLET ?? deployer.address;
  const initTx = await registry.initialize(protocolWallet);
  await initTx.wait();
  console.log(`   initialized with protocolWallet=${protocolWallet}`);

  const NameService = await ethers.getContractFactory("TalosNameService");
  const nameService = await NameService.deploy();
  await nameService.waitForDeployment();
  const nameServiceAddr = await nameService.getAddress();
  console.log(`   TalosNameService:   ${nameServiceAddr}`);

  const Factory = await ethers.getContractFactory("PulseTokenFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log(`   PulseTokenFactory:  ${factoryAddr}`);

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  Add these to web/.env.local:\n");
  console.log(`  NEXT_PUBLIC_TALOS_REGISTRY_ADDRESS=${registryAddr}`);
  console.log(`  NEXT_PUBLIC_TALOS_NAME_SERVICE_ADDRESS=${nameServiceAddr}`);
  console.log(`  NEXT_PUBLIC_PULSE_TOKEN_FACTORY_ADDRESS=${factoryAddr}`);
  console.log("═══════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
