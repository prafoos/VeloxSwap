import VXCABI from './VXC.json';
import USDCStakingABI from './USDCStaking.json';

// ============================================================
// ERC20 ABI
// Existing Mock USDC / ARCG + Official USDC / EURC / cirBTC
// ============================================================

export const ERC20_ABI = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" }
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" }
    ],
    name: "transferFrom",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
] as const;


// ============================================================
// EXISTING MOCK USDC / ARCG POOL ABI
// DO NOT MODIFY
// ============================================================

export const POOL_ABI = [
  {
    inputs: [],
    name: "getReserves",
    outputs: [
      { name: "_reserveUsdc", type: "uint256" },
      { name: "_reserveArcg", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "reserveIn", type: "uint256" },
      { name: "reserveOut", type: "uint256" }
    ],
    name: "getAmountOut",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "pure",
    type: "function"
  },
  {
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minAmountOut", type: "uint256" }
    ],
    name: "swap",
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "amountUsdcDesired", type: "uint256" },
      { name: "amountArcgDesired", type: "uint256" }
    ],
    name: "addLiquidity",
    outputs: [
      { name: "amountUsdcUsed", type: "uint256" },
      { name: "amountArcgUsed", type: "uint256" },
      { name: "lpTokens", type: "uint256" }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "lpAmount", type: "uint256" }],
    name: "removeLiquidity",
    outputs: [
      { name: "amountUsdc", type: "uint256" },
      { name: "amountArcg", type: "uint256" }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "usdc",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "arcg",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  }
] as const;


// ============================================================
// VXC ABI
// ============================================================

export const VXC_ABI = VXCABI;


// ============================================================
// STAKING ABI
// ============================================================

export const STAKING_ABI = USDCStakingABI;


// ============================================================
// ARC TOKEN PAIR POOL ABI
//
// Used by the NEW pools:
//
// Official USDC / EURC
// Official USDC / ARCG
// Official USDC / cirBTC
//
// Existing POOL_ABI above remains untouched.
// ============================================================

export const ARC_TOKEN_PAIR_POOL_ABI = [
  // ----------------------------------------------------------
  // TOKEN INFORMATION
  // ----------------------------------------------------------

  {
    inputs: [],
    name: "token0",
    outputs: [
      { name: "", type: "address" }
    ],
    stateMutability: "view",
    type: "function"
  },

  {
    inputs: [],
    name: "token1",
    outputs: [
      { name: "", type: "address" }
    ],
    stateMutability: "view",
    type: "function"
  },

  {
    inputs: [],
    name: "token0Decimals",
    outputs: [
      { name: "", type: "uint8" }
    ],
    stateMutability: "view",
    type: "function"
  },

  {
    inputs: [],
    name: "token1Decimals",
    outputs: [
      { name: "", type: "uint8" }
    ],
    stateMutability: "view",
    type: "function"
  },


  // ----------------------------------------------------------
  // RESERVES
  // ----------------------------------------------------------

  {
    inputs: [],
    name: "reserve0",
    outputs: [
      { name: "", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },

  {
    inputs: [],
    name: "reserve1",
    outputs: [
      { name: "", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },

  {
    inputs: [],
    name: "getReserves",
    outputs: [
      { name: "_reserve0", type: "uint256" },
      { name: "_reserve1", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },


  // ----------------------------------------------------------
  // PRICE / AMOUNT OUT
  // ----------------------------------------------------------

  {
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "reserveIn", type: "uint256" },
      { name: "reserveOut", type: "uint256" }
    ],
    name: "getAmountOut",
    outputs: [
      { name: "", type: "uint256" }
    ],
    stateMutability: "pure",
    type: "function"
  },


  // ----------------------------------------------------------
  // SWAP
  // ----------------------------------------------------------

  {
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minAmountOut", type: "uint256" }
    ],
    name: "swap",
    outputs: [
      { name: "amountOut", type: "uint256" }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },


  // ----------------------------------------------------------
  // ADD LIQUIDITY
  // ----------------------------------------------------------

  {
    inputs: [
      { name: "amount0Desired", type: "uint256" },
      { name: "amount1Desired", type: "uint256" }
    ],
    name: "addLiquidity",
    outputs: [
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" },
      { name: "liquidity", type: "uint256" }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },


  // ----------------------------------------------------------
  // REMOVE LIQUIDITY
  // ----------------------------------------------------------

  {
    inputs: [
      { name: "liquidity", type: "uint256" }
    ],
    name: "removeLiquidity",
    outputs: [
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },


  // ----------------------------------------------------------
  // LP TOKEN
  // ----------------------------------------------------------

  {
    inputs: [
      { name: "account", type: "address" }
    ],
    name: "balanceOf",
    outputs: [
      { name: "", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },

  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    name: "approve",
    outputs: [
      { name: "", type: "bool" }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },

  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    name: "allowance",
    outputs: [
      { name: "", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },

  {
    inputs: [],
    name: "totalSupply",
    outputs: [
      { name: "", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const; 