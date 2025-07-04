// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../tokens/MintableBaseToken.sol";

contract CustomLiquidityToken is MintableBaseToken {
    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) 
        public MintableBaseToken(_name, _symbol, _initialSupply) {
    }

    function id() external view returns (string memory _name) {
        return name();
    }
} 