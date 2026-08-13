// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        // Mint initial supply to deployer
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }

    /**
     * @dev Overrides decimals to return 6, simulating the official USDC contract decimals.
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /**
     * @dev Public mint function to simulate getting test USDC.
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
