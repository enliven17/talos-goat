// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TalosRegistry
/// @notice On-chain registry for Talos agent corporations on GOAT Network.
///         Ported from the Soroban (Rust) `talos_registry` contract.
///         Handles:
///         - Talos creation (with Pulse token metadata)
///         - Protocol fee config (3% launchpad fee)
///         - Talos metadata storage and retrieval
///         - ERC-8004-aligned agent identity (metadataURI + AgentRegistered event)
contract TalosRegistry {
    // ── Data Types ───────────────────────────────────────────────────

    struct Patron {
        uint32 creatorShare;
        uint32 investorShare;
        uint32 treasuryShare;
        address creatorAddr;
        address investorAddr;
        address treasuryAddr;
    }

    struct Kernel {
        uint256 approvalThreshold;
        uint256 gtmBudget;
        uint256 minPatronPulse;
    }

    struct Pulse {
        uint256 totalSupply;
        uint256 priceUsdCents;
        string tokenSymbol;
    }

    struct Talos {
        uint256 id;
        string name;
        string category;
        string description;
        address creator;
        Patron patron;
        Kernel kernel;
        Pulse pulse;
        uint64 createdAt;
        bool active;
        // ERC-8004 alignment: machine-readable metadata location.
        string metadataURI;
    }

    // ── Storage ──────────────────────────────────────────────────────

    uint256 public constant PROTOCOL_FEE_BPS = 300; // 3%

    address public protocolWallet;
    uint256 public protocolFeeBps;
    uint256 public nextTalosId;
    bool private _initialized;

    mapping(uint256 => Talos) private _talos;
    mapping(uint256 => address) public creatorOf;

    // ── Events ───────────────────────────────────────────────────────

    event TalosCreated(uint256 indexed talosId, address indexed creator, string name);
    event PatronUpdated(uint256 indexed talosId, uint32 creatorShare, uint32 investorShare);
    event KernelUpdated(uint256 indexed talosId, uint256 approvalThreshold, uint256 gtmBudget);
    event PulseUpdated(uint256 indexed talosId, uint256 totalSupply, uint256 priceUsdCents);
    event TalosDeactivated(uint256 indexed talosId);

    /// @notice ERC-8004-style identity registration signal for off-chain indexers.
    event AgentRegistered(uint256 indexed talosId, address indexed agent, string metadataURI);

    // ── Modifiers ────────────────────────────────────────────────────

    modifier onlyCreator(uint256 talosId) {
        require(_talos[talosId].id != 0, "Talos not found");
        require(_talos[talosId].creator == msg.sender, "Not Talos creator");
        _;
    }

    // ── Init ─────────────────────────────────────────────────────────

    /// @notice Initialize the registry with the protocol wallet and fee.
    /// @dev Mirrors the Soroban `initialize`. Idempotent-guarded.
    function initialize(address _protocolWallet) external {
        require(!_initialized, "Already initialized");
        _initialized = true;
        protocolWallet = _protocolWallet;
        protocolFeeBps = PROTOCOL_FEE_BPS;
        nextTalosId = 1;
    }

    // ── Writes ───────────────────────────────────────────────────────

    /// @notice Create a new Talos on-chain. Returns the new Talos ID.
    /// @dev Authorization is implicit: `msg.sender` becomes the creator
    ///      (replaces Soroban `patron.creator_addr.require_auth()`).
    function createTalos(
        string calldata name,
        string calldata category,
        string calldata description,
        Patron calldata patron,
        Kernel calldata kernel,
        Pulse calldata pulse,
        string calldata metadataURI
    ) external returns (uint256) {
        require(_initialized, "Not initialized");
        require(patron.creatorAddr == msg.sender, "creatorAddr must be msg.sender");

        uint256 id = nextTalosId;

        Talos storage t = _talos[id];
        t.id = id;
        t.name = name;
        t.category = category;
        t.description = description;
        t.creator = msg.sender;
        t.patron = patron;
        t.kernel = kernel;
        t.pulse = pulse;
        t.createdAt = uint64(block.timestamp);
        t.active = true;
        t.metadataURI = metadataURI;

        creatorOf[id] = msg.sender;
        nextTalosId = id + 1;

        emit TalosCreated(id, msg.sender, name);
        emit AgentRegistered(id, msg.sender, metadataURI);

        return id;
    }

    /// @notice Update patron shares for a Talos.
    function updatePatron(uint256 talosId, Patron calldata patron) external onlyCreator(talosId) {
        _talos[talosId].patron = patron;
        emit PatronUpdated(talosId, patron.creatorShare, patron.investorShare);
    }

    /// @notice Update kernel policy for a Talos.
    function updateKernel(uint256 talosId, Kernel calldata kernel) external onlyCreator(talosId) {
        _talos[talosId].kernel = kernel;
        emit KernelUpdated(talosId, kernel.approvalThreshold, kernel.gtmBudget);
    }

    /// @notice Update pulse token config for a Talos.
    function updatePulse(uint256 talosId, Pulse calldata pulse) external onlyCreator(talosId) {
        _talos[talosId].pulse = pulse;
        emit PulseUpdated(talosId, pulse.totalSupply, pulse.priceUsdCents);
    }

    /// @notice Update the ERC-8004 metadata URI for a Talos.
    function setAgentURI(uint256 talosId, string calldata metadataURI) external onlyCreator(talosId) {
        _talos[talosId].metadataURI = metadataURI;
        emit AgentRegistered(talosId, _talos[talosId].creator, metadataURI);
    }

    /// @notice Deactivate a Talos.
    function deactivateTalos(uint256 talosId) external onlyCreator(talosId) {
        _talos[talosId].active = false;
        emit TalosDeactivated(talosId);
    }

    // ── Reads ────────────────────────────────────────────────────────

    /// @notice Get a Talos by ID. Reverts if not found.
    function getTalos(uint256 talosId) external view returns (Talos memory) {
        require(_talos[talosId].id != 0, "Talos not found");
        return _talos[talosId];
    }

    /// @notice Whether a Talos exists.
    function exists(uint256 talosId) external view returns (bool) {
        return _talos[talosId].id != 0;
    }

    /// @notice Whether a Talos is active.
    function isActive(uint256 talosId) external view returns (bool) {
        return _talos[talosId].active;
    }

    /// @notice The ERC-8004 metadata URI for a Talos.
    function agentURI(uint256 talosId) external view returns (string memory) {
        return _talos[talosId].metadataURI;
    }
}
