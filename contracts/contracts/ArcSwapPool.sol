// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ArcSwapPool is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable usdc;
    address public immutable arcg;

    uint256 public reserveUsdc;
    uint256 public reserveArcg;

    event LiquidityAdded(address indexed provider, uint256 amountUsdc, uint256 amountArcg, uint256 lpTokens);
    event LiquidityRemoved(address indexed provider, uint256 amountUsdc, uint256 amountArcg, uint256 lpTokens);
    event Swap(address indexed buyer, address indexed tokenIn, uint256 amountIn, uint256 amountOut);

    constructor(address _usdc, address _arcg) ERC20("Arc Swap USDC-ARCG LP", "ARC-LP") {
        require(_usdc != address(0) && _arcg != address(0), "Invalid token addresses");
        usdc = _usdc;
        arcg = _arcg;
    }

    /**
     * @dev Get reserves of the pool.
     */
    function getReserves() external view returns (uint256 _reserveUsdc, uint256 _reserveArcg) {
        return (reserveUsdc, reserveArcg);
    }

    /**
     * @dev Calculate amount of token out given amount in and reserves.
     */
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256) {
        require(amountIn > 0, "Insufficient input amount");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");
        
        // Apply 0.3% fee: amountInWithFee = amountIn * 997
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        return numerator / denominator;
    }

    /**
     * @dev Swaps tokenIn for the other token.
     * @param tokenIn The address of the token to swap from (must be usdc or arcg).
     * @param amountIn The amount of tokenIn to swap.
     * @param minAmountOut The minimum acceptable amount of output tokens.
     */
    function swap(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant returns (uint256 amountOut) {
        require(tokenIn == usdc || tokenIn == arcg, "Invalid input token");
        require(amountIn > 0, "Amount must be greater than zero");

        bool isUsdc = tokenIn == usdc;
        address tokenOut = isUsdc ? arcg : usdc;
        uint256 reserveIn = isUsdc ? reserveUsdc : reserveArcg;
        uint256 reserveOut = isUsdc ? reserveArcg : reserveUsdc;

        amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        require(amountOut >= minAmountOut, "Slippage limit exceeded");

        // Transfer tokens
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

        // Update reserves
        if (isUsdc) {
            reserveUsdc += amountIn;
            reserveArcg -= amountOut;
        } else {
            reserveArcg += amountIn;
            reserveUsdc -= amountOut;
        }

        emit Swap(msg.sender, tokenIn, amountIn, amountOut);
    }

    /**
     * @dev Adds liquidity to the pool.
     * @param amountUsdcDesired The amount of USDC (6 decimals) to add.
     * @param amountArcgDesired The amount of ARCG (18 decimals) to add.
     */
    function addLiquidity(
        uint256 amountUsdcDesired,
        uint256 amountArcgDesired
    ) external nonReentrant returns (uint256 amountUsdcUsed, uint256 amountArcgUsed, uint256 lpTokens) {
        require(amountUsdcDesired > 0 && amountArcgDesired > 0, "Amounts must be greater than zero");

        if (totalSupply() == 0) {
            // First liquidity deposit: initialize price ratio
            amountUsdcUsed = amountUsdcDesired;
            amountArcgUsed = amountArcgDesired;
            // Using geometric mean to mint initial LP tokens, adjusting scale so it fits nicely
            // We scale USDC amount (6 decimals) to 18 decimals internally for LP mint calculations to avoid low LP tokens
            lpTokens = MathSqrt((amountUsdcUsed * 10**12) * amountArcgUsed);
        } else {
            // Maintain current reserve ratio
            uint256 amountArcgOptimal = (amountUsdcDesired * reserveArcg) / reserveUsdc;
            if (amountArcgOptimal <= amountArcgDesired) {
                amountUsdcUsed = amountUsdcDesired;
                amountArcgUsed = amountArcgOptimal;
            } else {
                uint256 amountUsdcOptimal = (amountArcgDesired * reserveUsdc) / reserveArcg;
                require(amountUsdcOptimal <= amountUsdcDesired, "Optimal USDC exceeds desired");
                amountUsdcUsed = amountUsdcOptimal;
                amountArcgUsed = amountArcgDesired;
            }
            // lpTokens = totalSupply * (amountUsed / reserve)
            // Using USDC reserve with scale adjustment
            lpTokens = (totalSupply() * (amountUsdcUsed * 10**12)) / (reserveUsdc * 10**12);
        }

        require(lpTokens > 0, "Insufficient LP tokens minted");

        // Transfer tokens
        IERC20(usdc).safeTransferFrom(msg.sender, address(this), amountUsdcUsed);
        IERC20(arcg).safeTransferFrom(msg.sender, address(this), amountArcgUsed);

        // Update reserves
        reserveUsdc += amountUsdcUsed;
        reserveArcg += amountArcgUsed;

        // Mint LP tokens to provider
        _mint(msg.sender, lpTokens);

        emit LiquidityAdded(msg.sender, amountUsdcUsed, amountArcgUsed, lpTokens);
    }

    /**
     * @dev Removes liquidity from the pool.
     * @param lpAmount The amount of LP tokens to burn.
     */
    function removeLiquidity(
        uint256 lpAmount
    ) external nonReentrant returns (uint256 amountUsdc, uint256 amountArcg) {
        require(lpAmount > 0, "LP amount must be greater than zero");
        require(balanceOf(msg.sender) >= lpAmount, "Insufficient LP balance");

        uint256 totalLp = totalSupply();
        amountUsdc = (reserveUsdc * lpAmount) / totalLp;
        amountArcg = (reserveArcg * lpAmount) / totalLp;

        require(amountUsdc > 0 && amountArcg > 0, "Insufficient liquidity returned");

        // Burn LP tokens
        _burn(msg.sender, lpAmount);

        // Update reserves
        reserveUsdc -= amountUsdc;
        reserveArcg -= amountArcg;

        // Transfer tokens
        IERC20(usdc).safeTransfer(msg.sender, amountUsdc);
        IERC20(arcg).safeTransfer(msg.sender, amountArcg);

        emit LiquidityRemoved(msg.sender, amountUsdc, amountArcg, lpAmount);
    }

    /**
     * @dev Babylonian square root algorithm.
     */
    function MathSqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
