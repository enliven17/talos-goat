import { expect } from "chai";
import { ethers } from "hardhat";

describe("TalosRegistry", () => {
  async function deploy() {
    const [deployer, investor, treasury] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("TalosRegistry");
    const registry = await Registry.deploy();
    await registry.initialize(deployer.address);
    return { registry, deployer, investor, treasury };
  }

  const patron = (creator: string, investor: string, treasury: string) => ({
    creatorShare: 6000,
    investorShare: 3000,
    treasuryShare: 1000,
    creatorAddr: creator,
    investorAddr: investor,
    treasuryAddr: treasury,
  });
  const kernel = { approvalThreshold: 100, gtmBudget: 1000, minPatronPulse: 10 };
  const pulse = { totalSupply: 1_000_000, priceUsdCents: 100, tokenSymbol: "VEGA" };

  it("creates a Talos with id 1 and emits events", async () => {
    const { registry, deployer, investor, treasury } = await deploy();
    await expect(
      registry.createTalos(
        "vega",
        "Marketing",
        "desc",
        patron(deployer.address, investor.address, treasury.address),
        kernel,
        pulse,
        "ipfs://meta"
      )
    )
      .to.emit(registry, "TalosCreated")
      .and.to.emit(registry, "AgentRegistered");

    expect(await registry.nextTalosId()).to.equal(2);
    const t = await registry.getTalos(1);
    expect(t.name).to.equal("vega");
    expect(t.active).to.equal(true);
    expect(t.metadataURI).to.equal("ipfs://meta");
    expect(await registry.creatorOf(1)).to.equal(deployer.address);
  });

  it("rejects createTalos when creatorAddr != msg.sender", async () => {
    const { registry, investor, treasury } = await deploy();
    await expect(
      registry.createTalos(
        "vega",
        "Marketing",
        "desc",
        patron(investor.address, investor.address, treasury.address),
        kernel,
        pulse,
        "ipfs://meta"
      )
    ).to.be.revertedWith("creatorAddr must be msg.sender");
  });

  it("only creator can deactivate", async () => {
    const { registry, deployer, investor, treasury } = await deploy();
    await registry.createTalos(
      "vega",
      "Marketing",
      "desc",
      patron(deployer.address, investor.address, treasury.address),
      kernel,
      pulse,
      "ipfs://meta"
    );
    await expect(registry.connect(investor).deactivateTalos(1)).to.be.revertedWith(
      "Not Talos creator"
    );
    await registry.deactivateTalos(1);
    expect(await registry.isActive(1)).to.equal(false);
  });
});

describe("TalosNameService", () => {
  async function deploy() {
    const NameService = await ethers.getContractFactory("TalosNameService");
    const ns = await NameService.deploy();
    return { ns };
  }

  it("registers and resolves names", async () => {
    const { ns } = await deploy();
    expect(await ns.isNameAvailable("marketbot")).to.equal(true);
    await ns.registerName(42, "marketbot");
    expect(await ns.resolveName("marketbot")).to.equal(42);
    expect(await ns.nameOf(42)).to.equal("marketbot");
    expect(await ns.isNameAvailable("marketbot")).to.equal(false);
    expect(await ns.hasName(42)).to.equal(true);
  });

  it("rejects too-short names and duplicates", async () => {
    const { ns } = await deploy();
    await expect(ns.registerName(1, "ab")).to.be.revertedWith(
      "Invalid name: must be 3-32 bytes"
    );
    await ns.registerName(1, "abc");
    await expect(ns.registerName(2, "abc")).to.be.revertedWith("Name already taken");
  });
});

describe("PulseTokenFactory", () => {
  it("mints total supply to treasury", async () => {
    const [, treasury] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("PulseTokenFactory");
    const factory = await Factory.deploy();
    await factory.createPulseToken(1, "Vega", "VEGA", 1_000_000n, treasury.address, 7);
    const tokenAddr = await factory.tokenOfTalos(1);
    const token = await ethers.getContractAt("PulseToken", tokenAddr);
    expect(await token.symbol()).to.equal("VEGA");
    expect(await token.decimals()).to.equal(7);
    expect(await token.balanceOf(treasury.address)).to.equal(1_000_000n);
    await expect(
      factory.createPulseToken(1, "Vega", "VEGA", 1n, treasury.address, 7)
    ).to.be.revertedWith("Token already exists");
  });
});
