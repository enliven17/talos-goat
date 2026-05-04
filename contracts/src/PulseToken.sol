// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title PulseToken
/// @notice Per-agent equity token ("Mitos"/"Pulse"), the EVM/ERC-20 replacement
///         for the classic Stellar asset issued per Talos. The full supply is
///         minted to the treasury at genesis; holders (Patrons) get governance
///         and revenue-share rights tracked off-chain by the Talos platform.
contract PulseToken is ERC20 {
    uint8 private immutable _decimals;
    address public immutable treasury;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        address treasury_,
        uint8 decimals_
    ) ERC20(name_, symbol_) {
        require(treasury_ != address(0), "treasury required");
        _decimals = decimals_;
        treasury = treasury_;
        _mint(treasury_, totalSupply_);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
