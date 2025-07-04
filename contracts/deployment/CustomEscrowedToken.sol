// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../tokens/MintableBaseToken.sol";

contract CustomEscrowedToken is MintableBaseToken {
    
    constructor(string memory _name, string memory _symbol) public MintableBaseToken(_name, _symbol, 0) {
    }

    function id() external pure returns (string memory) {
        return "escrowed-token";
    }
}
