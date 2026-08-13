// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockToken is ERC20, Ownable {
    constructor() ERC20("Arc Gold", "ARCG") Ownable(msg.sender) {
        // Mint an initial supply of 1,000,000 ARCG to the deployer
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }

    /**
     * @dev Public mint function allowing anyone to mint tokens for testing.
     * @param to The address receiving the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
