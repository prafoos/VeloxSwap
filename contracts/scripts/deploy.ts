import { ethers } from "hardhat";


async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`Connected to chain ID: ${network.chainId}`);

  // 1. Deploy Mock USDC
  console.log("Deploying Mock USDC (6 decimals)...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const usdcAddress = await mockUSDC.getAddress();
  console.log(`Mock USDC deployed to: ${usdcAddress}`);

  // 2. Deploy Mock Token (ARCG)
  console.log("Deploying MockToken (ARCG)...");
  const MockToken = await ethers.getContractFactory("MockToken");
  const mockToken = await MockToken.deploy();
  await mockToken.waitForDeployment();
  const arcgAddress = await mockToken.getAddress();
  console.log(`ARCG Token deployed to: ${arcgAddress}`);

  // 3. Deploy ArcSwapPool
  console.log("Deploying ArcSwapPool...");
  const ArcSwapPool = await ethers.getContractFactory("ArcSwapPool");
  const pool = await ArcSwapPool.deploy(usdcAddress, arcgAddress);
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  console.log(`ArcSwapPool deployed to: ${poolAddress}`);

  console.log("\n====================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("====================================");
  console.log(`USDC (6 decimals):   ${usdcAddress}`);
  console.log(`ARCG (18 decimals):  ${arcgAddress}`);
  console.log(`ArcSwapPool:         ${poolAddress}`);
  console.log("====================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
