# VeloxSwap DEX: Crypto Swap Website on Arc Testnet

VeloxSwap is a high-performance, glassmorphic Decentralized Exchange (DEX) built for the **Arc Testnet**. It enables users to swap between **vUSDC** (6 decimals) and a custom test token **ARCG** (Arc Gold, 18 decimals) using a constant-product ($x \cdot y = k$) Automated Market Maker (AMM) pool. 

This project is fully designed for the Arc Network's unique Native USDC Gas model (gas is paid in 18-decimal Native USDC).

---

## 🚀 Key Arc Network Parameters Used
* **Chain ID:** `5042002` (Hex: `0x4CEF52`)
* **RPC Endpoint:** `https://rpc.testnet.arc.network`
* **Native Gas Token:** USDC (**18 decimals** for gas ledger transactions)
* **ERC-20 vUSDC Token:** `0x3600000000000000000000000000000000000000` (**6 decimals** for swapping and pooling)
* **Block Explorer:** [Arcscan Testnet](https://testnet.arcscan.app)
* **Faucet:** [Circle Faucet](https://faucet.circle.com)

---

## 📁 Repository Structure
```text
arc-swap/
├── README.md                      # Setup and deployment guidelines
├── train.md                       # Arc Network training reference
├── contracts/                     # Hardhat smart contract workspace
│   ├── contracts/
│   │   ├── MockToken.sol          # Target token (ARCG)
│   │   ├── MockUSDC.sol           # Mock USDC (6 decimals) for local testing
│   │   └── ArcSwapPool.sol        # Swap pool contract
│   ├── test/
│   │   └── ArcSwapPool.test.ts    # Mathematical & logical unit tests
│   ├── scripts/
│   │   └── deploy.ts              # Contract deployment script
│   ├── hardhat.config.ts          # Hardhat configuration
│   └── package.json
└── frontend/                      # React + Vite + TypeScript web app
    ├── src/
    │   ├── chains/
    │   │   └── arcTestnet.ts      # Custom viem/wagmi network config
    │   ├── contracts/
    │   │   ├── abis.ts            # Contract interfaces
    │   │   └── addresses.ts       # Mainnet/Testnet deployed contract addresses
    │   ├── App.tsx                # Main trading interface
    │   ├── index.css              # Custom neon glassmorphism stylesheet
    │   └── main.tsx               # Bootstrap configuration
    ├── package.json
    └── vite.config.ts
```

---

## 🛠️ Step 1: Smart Contract Setup & Deployment

Because the terminal sandbox is running in a constrained environment, please execute these commands in your local computer's terminal:

1. **Navigate to the contracts folder:**
   ```bash
   cd contracts
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   * Duplicate `.env.example` and rename it to `.env`:
     ```bash
     cp .env.example .env
     ```
   * Open `.env` and fill in your deployer wallet's private key:
     ```env
     PRIVATE_KEY=your_private_key_without_0x_here
     ```

4. **Compile the Contracts:**
   ```bash
   npx hardhat compile
   ```

5. **Run the Local Tests:**
   * This compiles and runs the complete Chai test suite checking swaps, slippage, and LP shares:
   ```bash
   npx hardhat test
   ```

6. **Deploy to Arc Testnet:**
   * Ensure your deployer wallet has some **Native Gas USDC** from the [Circle Faucet](https://faucet.circle.com).
   ```bash
   npx hardhat run scripts/deploy.ts --network arcTestnet
   ```
   * Save the logged contract addresses for the next step.

---

## 💻 Step 2: Frontend Web App Setup

1. **Navigate to the frontend folder:**
   ```bash
   cd ../frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Deployed Contract Addresses:**
   * Open `src/contracts/addresses.ts`.
   * Update the `ARCG` and `POOL` addresses with the deployment logs from Step 1:
     ```typescript
     export const CONTRACT_ADDRESSES = {
       USDC: "0x3600000000000000000000000000000000000000" as `0x${string}`, // Official Arc Testnet USDC
       ARCG: "YOUR_DEPLOYED_MOCK_TOKEN_ADDRESS" as `0x${string}`,
       POOL: "YOUR_DEPLOYED_POOL_ADDRESS" as `0x${string}`,
     };
     ```

4. **Launch the Development Server:**
   ```bash
   npm run dev
   ```
   * Open your browser and navigate to: `http://localhost:3000`

---

## 🧪 Step 3: Test and Swap on Arc

1. **Add Arc Testnet to Metamask:**
   * Name: `Arc Testnet`
   * RPC URL: `https://rpc.testnet.arc.network`
   * Chain ID: `5042002`
   * Currency Symbol: `USDC`
   * Block Explorer: `https://testnet.arcscan.app`

2. **Get Faucet Tokens:**
   * Go to [faucet.circle.com](https://faucet.circle.com), choose **Arc**, select **USDC** and paste your address. This funds your gas.
   * Open the **Faucet tab** on `http://localhost:3000` and click **Mint USDC** and **Mint ARCG** to obtain trading mock balances instantly.

3. **Provide Liquidity:**
   * Navigate to the **Liquidity tab** $\rightarrow$ **Add**.
   * Enter USDC (e.g. `10`) and ARCG (e.g. `100`), approve both tokens, and execute **Add Liquidity**.

4. **Swap Assets:**
   * Navigate to the **Swap tab**, choose the direction (e.g., USDC to ARCG), enter an amount, approve the token, and click **Swap Assets**.
   * Track the status block at the bottom, which links directly to the transaction details on the **Arcscan Explorer**.
