// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../tokens/MintableBaseToken.sol";
import "../tokens/interfaces/IYieldToken.sol";

contract CustomEscrowedToken is MintableBaseToken, IYieldToken {

    mapping (address => bool) public override isHandler;

    modifier onlyHandler() {
        require(isHandler[msg.sender], "CustomEscrowedToken: forbidden");
        _;
    }

    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) 
        public MintableBaseToken(_name, _symbol, _initialSupply) {
    }

    function setHandler(address _handler, bool _isActive) external override onlyGov {
        isHandler[_handler] = _isActive;
    }

    function addAdmin(address _account) external override onlyGov {
        admins[_account] = true;
    }

    function removeAdmin(address _account) external override onlyHandler {
        admins[_account] = false;
    }

    function id() external view returns (string memory _name) {
        return name();
    }
} 