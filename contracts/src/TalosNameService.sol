// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TalosNameService
/// @notice Human-readable name registration for Talos IDs on GOAT Network.
///         Ported from the Soroban (Rust) `talos_name_service` contract.
///         Name -> Talos ID mapping (e.g. "marketbot" -> 42).
///         On-chain validation enforces byte-length bounds (3-32);
///         character-level validation is handled off-chain (Next.js regex).
contract TalosNameService {
    mapping(string => uint256) private _nameRecord; // name -> talosId
    mapping(uint256 => string) private _talosName; // talosId -> name

    event NameRegistered(uint256 indexed talosId, string name);

    function _validateName(string calldata name) private pure returns (bool) {
        uint256 len = bytes(name).length;
        return len >= 3 && len <= 32;
    }

    /// @notice Register a name for a Talos.
    function registerName(uint256 talosId, string calldata name) external {
        require(_validateName(name), "Invalid name: must be 3-32 bytes");
        require(_nameRecord[name] == 0, "Name already taken");

        _nameRecord[name] = talosId;
        _talosName[talosId] = name;

        emit NameRegistered(talosId, name);
    }

    /// @notice Resolve a name to a Talos ID. Returns 0 if not registered.
    function resolveName(string calldata name) external view returns (uint256) {
        return _nameRecord[name];
    }

    /// @notice Get the name associated with a Talos ID. Empty string if none.
    function nameOf(uint256 talosId) external view returns (string memory) {
        return _talosName[talosId];
    }

    /// @notice Check if a name is available.
    function isNameAvailable(string calldata name) external view returns (bool) {
        if (!_validateName(name)) return false;
        return _nameRecord[name] == 0;
    }

    /// @notice Check if a Talos has a registered name.
    function hasName(uint256 talosId) external view returns (bool) {
        return bytes(_talosName[talosId]).length > 0;
    }
}
