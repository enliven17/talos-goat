// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PulseToken} from "./PulseToken.sol";

/// @title PulseTokenFactory
/// @notice Deploys a fresh PulseToken (ERC-20) per Talos at genesis, replacing
///         the unique Stellar issuer keypair model. Records token address by
///         Talos ID so the platform can resolve an agent's equity token.
contract PulseTokenFactory {
    mapping(uint256 => address) public tokenOfTalos;

    event PulseTokenCreated(
        uint256 indexed talosId,
        address indexed token,
        string symbol,
        uint256 totalSupply,
        address treasury
    );

    /// @notice Create the Pulse token for a Talos. Reverts if one already exists.
    function createPulseToken(
        uint256 talosId,
        string calldata name,
        string calldata symbol,
        uint256 totalSupply,
        address treasury,
        uint8 decimals_
    ) external returns (address) {
        require(tokenOfTalos[talosId] == address(0), "Token already exists");

        PulseToken token = new PulseToken(name, symbol, totalSupply, treasury, decimals_);
        tokenOfTalos[talosId] = address(token);

        emit PulseTokenCreated(talosId, address(token), symbol, totalSupply, treasury);
        return address(token);
    }
}
