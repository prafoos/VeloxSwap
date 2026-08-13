import { expect } from "chai";
import { ethers } from "hardhat";
import { MockUSDC, MockToken, ArcSwapPool } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ArcSwapPool", function () {
  let usdc: MockUSDC;
  let arcg: MockToken;
  let pool: ArcSwapPool;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy Mock USDC (6 decimals)
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDCFactory.deploy();

    // Deploy Mock ARCG (18 decimals)
    const MockTokenFactory = await ethers.getContractFactory("MockToken");
    arcg = await MockTokenFactory.deploy();

    // Deploy Pool
    const PoolFactory = await ethers.getContractFactory("ArcSwapPool");
    pool = await PoolFactory.deploy(await usdc.getAddress(), await arcg.getAddress());

    // Mint tokens to user for testing
    await usdc.mint(user.address, ethers.parseUnits("1000", 6)); // 1,000 USDC
    await arcg.mint(user.address, ethers.parseUnits("10000", 18)); // 10,000 ARCG
  });

  describe("Deployment", function () {
    it("Should set the correct token addresses", async function () {
      expect(await pool.usdc()).to.equal(await usdc.getAddress());
      expect(await pool.arcg()).to.equal(await arcg.getAddress());
    });

    it("Should initialize with zero reserves", async function () {
      const [reserveUsdc, reserveArcg] = await pool.getReserves();
      expect(reserveUsdc).to.equal(0);
      expect(reserveArcg).to.equal(0);
    });
  });

  describe("Liquidity Provision", function () {
    it("Should allow initial liquidity deposit and mint LP tokens", async function () {
      const amountUsdc = ethers.parseUnits("10", 6); // 10 USDC
      const amountArcg = ethers.parseUnits("100", 18); // 100 ARCG

      // Approve pool to spend tokens
      await usdc.approve(await pool.getAddress(), amountUsdc);
      await arcg.approve(await pool.getAddress(), amountArcg);

      // Add liquidity
      await expect(pool.addLiquidity(amountUsdc, amountArcg))
        .to.emit(pool, "LiquidityAdded");

      // Verify reserves
      const [reserveUsdc, reserveArcg] = await pool.getReserves();
      expect(reserveUsdc).to.equal(amountUsdc);
      expect(reserveArcg).to.equal(amountArcg);

      // Check LP token balance of owner
      // Math: sqrt((10 * 10^6 * 10^12) * 100 * 10^18) = sqrt(10^18 * 100 * 10^18) = sqrt(100 * 10^36) = 10 * 10^18 (since sqrt(1000 * 10^36) ≈ 31.62 * 10^18)
      // Actually: (10 * 10^12) * (100 * 10^18) = 10^13 * 10^20 = 10^33? No, 10 * 10^6 * 10^12 = 10^19. 100 * 10^18 = 10^20.
      // 10^19 * 10^20 = 10^39. Sqrt(10^39) = Sqrt(10) * 10^19 ≈ 3.162 * 10^19 = 31.62 * 10^18.
      const lpBalance = await pool.balanceOf(owner.address);
      expect(lpBalance).to.be.closeTo(ethers.parseUnits("31.62", 18), ethers.parseUnits("0.01", 18));
    });

    it("Should allow adding subsequent liquidity proportionally", async function () {
      // 1. Initial Deposit (10 USDC : 100 ARCG)
      await usdc.approve(await pool.getAddress(), ethers.parseUnits("100", 6));
      await arcg.approve(await pool.getAddress(), ethers.parseUnits("1000", 18));
      await pool.addLiquidity(ethers.parseUnits("10", 6), ethers.parseUnits("100", 18));

      // 2. User adds liquidity with 5 USDC. The pool should require exactly 50 ARCG.
      await usdc.connect(user).approve(await pool.getAddress(), ethers.parseUnits("5", 6));
      await arcg.connect(user).approve(await pool.getAddress(), ethers.parseUnits("60", 18)); // approved more than needed

      const tx = await pool.connect(user).addLiquidity(ethers.parseUnits("5", 6), ethers.parseUnits("60", 18));
      await expect(tx).to.emit(pool, "LiquidityAdded");

      // Verify that user deposited exactly 5 USDC and 50 ARCG
      const [reserveUsdc, reserveArcg] = await pool.getReserves();
      expect(reserveUsdc).to.equal(ethers.parseUnits("15", 6)); // 10 + 5
      expect(reserveArcg).to.equal(ethers.parseUnits("150", 18)); // 100 + 50
    });
  });

  describe("Swaps", function () {
    beforeEach(async function () {
      // Set up a pool with 100 USDC and 1000 ARCG
      const initialUsdc = ethers.parseUnits("100", 6);
      const initialArcg = ethers.parseUnits("1000", 18);
      await usdc.approve(await pool.getAddress(), initialUsdc);
      await arcg.approve(await pool.getAddress(), initialArcg);
      await pool.addLiquidity(initialUsdc, initialArcg);
    });

    it("Should swap USDC for ARCG correctly (with fee)", async function () {
      const amountIn = ethers.parseUnits("10", 6); // 10 USDC
      
      // Calculate expected output:
      // amountInWithFee = 10 * 10^6 * 997 = 9.97 * 10^9
      // numerator = 9.97 * 10^9 * 1000 * 10^18 = 9.97 * 10^30
      // denominator = (100 * 10^6 * 1000) + 9.97 * 10^9 = 1.0997 * 10^11
      // amountOut = 9.97 * 10^30 / 1.0997 * 10^11 = 9.0661 * 10^19 wei = 90.661 ARCG
      const expectedOut = ethers.parseUnits("90.661", 18);

      await usdc.connect(user).approve(await pool.getAddress(), amountIn);

      const userArcgBefore = await arcg.balanceOf(user.address);
      
      await expect(pool.connect(user).swap(await usdc.getAddress(), amountIn, ethers.parseUnits("90", 18)))
        .to.emit(pool, "Swap");

      const userArcgAfter = await arcg.balanceOf(user.address);
      const actualOut = userArcgAfter - userArcgBefore;

      expect(actualOut).to.be.closeTo(expectedOut, ethers.parseUnits("0.01", 18));
      
      // Check reserves updated
      const [reserveUsdc, reserveArcg] = await pool.getReserves();
      expect(reserveUsdc).to.equal(ethers.parseUnits("110", 6));
      expect(reserveArcg).to.equal(initialArcg - actualOut);
    });

    it("Should revert swap if output is below minimum slippage limit", async function () {
      const amountIn = ethers.parseUnits("10", 6);
      await usdc.connect(user).approve(await pool.getAddress(), amountIn);

      // Force minimum output that is too high (expecting 90.66, but setting min to 91)
      await expect(
        pool.connect(user).swap(await usdc.getAddress(), amountIn, ethers.parseUnits("91", 18))
      ).to.be.revertedWith("Slippage limit exceeded");
    });
  });

  describe("Liquidity Withdrawal", function () {
    it("Should allow burning LP tokens and returning correct reserves", async function () {
      const amountUsdc = ethers.parseUnits("100", 6);
      const amountArcg = ethers.parseUnits("1000", 18);
      await usdc.approve(await pool.getAddress(), amountUsdc);
      await arcg.approve(await pool.getAddress(), amountArcg);
      await pool.addLiquidity(amountUsdc, amountArcg);

      const lpBalance = await pool.balanceOf(owner.address);
      
      // Approve LP tokens for withdrawal (standard ERC-20 transfer/burn, but pool manages it)
      await pool.approve(await pool.getAddress(), lpBalance);

      const userUsdcBefore = await usdc.balanceOf(owner.address);
      const userArcgBefore = await arcg.balanceOf(owner.address);

      // Withdraw all liquidity
      await expect(pool.removeLiquidity(lpBalance))
        .to.emit(pool, "LiquidityRemoved");

      const userUsdcAfter = await usdc.balanceOf(owner.address);
      const userArcgAfter = await arcg.balanceOf(owner.address);

      expect(userUsdcAfter - userUsdcBefore).to.equal(amountUsdc);
      expect(userArcgAfter - userArcgBefore).to.equal(amountArcg);

      // Reserves should be zero
      const [reserveUsdc, reserveArcg] = await pool.getReserves();
      expect(reserveUsdc).to.equal(0);
      expect(reserveArcg).to.equal(0);
    });
  });
});
