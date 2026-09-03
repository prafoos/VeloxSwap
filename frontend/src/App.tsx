import { useState, useEffect } from 'react';
import { 
  useAccount, 
  useReadContract, 
  useWriteContract, 
  useWaitForTransactionReceipt, 
  useSwitchChain, 
  useBalance 
} from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { 
  Coins, 
  ArrowDownUp, 
  TrendingUp, 
  RefreshCw, 
  Droplet, 
  AlertCircle, 
  ExternalLink, 
  CheckCircle,
  Plus,
  Minus
} from 'lucide-react';
import { CONTRACT_ADDRESSES } from './contracts/addresses';
import { ERC20_ABI, POOL_ABI, STAKING_ABI } from './contracts/abis';
import { arcTestnet } from './chains/arcTestnet';
import { useQueryClient } from '@tanstack/react-query';
import { WalletConnectButton } from './WalletConnectButton';
import { waitForTransactionReceipt } from '@wagmi/core';
import { config } from './main'; 

export default function App(): JSX.Element {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const queryClient = useQueryClient();
  // Tabs: 'swap' | 'liquidity' | 'faucet'
  const [activeTab, setActiveTab] = useState<'swap' | 'liquidity' | 'stake' | 'faucet'>('swap');
  const [stakeTxHash, setStakeTxHash] = useState<string>('');

 useEffect(() => {
    if (!stakeTxHash) return;

    const timer = setTimeout(() => {
      setStakeTxHash('');
    }, 10000);

    return () => clearTimeout(timer);
  }, [stakeTxHash]); 

  // Network Guard Check
  const isWrongNetwork = isConnected && chainId !== arcTestnet.id;
  // ----------------------------------------------------
  // BALANCES FETCHING
  // ----------------------------------------------------
  
  // 1. Native Gas USDC (18 decimals)
  const { data: gasBalanceData, refetch: refetchGasBalance } = useBalance({
    address: address,
  });
  const nativeGasBalance = gasBalanceData ? parseFloat(gasBalanceData.formatted).toFixed(4) : "0.0000";

  // 2. ERC-20 USDC Token (6 decimals)
  const { data: erc20UsdcRaw, refetch: refetchErc20Usdc, isLoading: isUsdcLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10000,
    },
  });
  const erc20UsdcBalance = isUsdcLoading
  ? "Loading..."
  : erc20UsdcRaw ? parseFloat(formatUnits(erc20UsdcRaw, 6)).toFixed(2) : "0.00"; 

  // 3. Mock ARCG Token (18 decimals)
  // 3. Mock ARCG Token (18 decimals)
const { data: arcgRaw, refetch: refetchArcg, isLoading: isArcgLoading } = useReadContract({
  address: CONTRACT_ADDRESSES.ARCG,
  abi: ERC20_ABI,
  functionName: 'balanceOf',
  args: address ? [address] : undefined,
  query: {
    enabled: !!address,
    refetchInterval: 10000, // ഓരോ 2 സെക്കന്റിലും ബാലൻസ് ഓട്ടോ-അപ്‌ഡേറ്റ് ചെയ്യും
  },
});

const arcgBalance = isArcgLoading 
  ? "Loading..." 
  : arcgRaw ? parseFloat(formatUnits(arcgRaw, 18)).toFixed(2) : "0.00"; 

  // 4. LP Token Balance (18 decimals)
  const { data: lpRaw, refetch: refetchLp } = useReadContract({
    address: CONTRACT_ADDRESSES.POOL,
    abi: POOL_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });
  const lpBalance = lpRaw ? parseFloat(formatUnits(lpRaw, 18)).toFixed(4) : "0.0000";

  // 5. Total LP Token Supply
  const { data: lpTotalSupplyRaw, refetch: refetchLpSupply } = useReadContract({
    address: CONTRACT_ADDRESSES.POOL,
    abi: POOL_ABI,
    functionName: 'totalSupply',
  });
  const lpTotalSupply = lpTotalSupplyRaw ? parseFloat(formatUnits(lpTotalSupplyRaw, 18)) : 0;
  // 1. Staking Contract Data
  const { data: stakerData, refetch: refetchStakedBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.STAKING as `0x${string}`,
    abi: STAKING_ABI,
    functionName: 'stakers',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      retry: 2,
      retryDelay: 1000,
      staleTime: 10000,
      refetchInterval: 2000,
    } 
  });

  // ==================== EARNED REWARDS ====================
// Calculate Reward (Recommended)
// ==================== CALCULATE REWARD ====================
const { 
  data: earnedRewardsData,
  refetch: refetchRewards 
} = useReadContract({
  address: CONTRACT_ADDRESSES.STAKING as `0x${string}`,
  abi: STAKING_ABI,
  functionName: 'calculateReward',
  args: address ? [address] : undefined,
  query: {
    enabled: !!address,
    staleTime: 3000,
  }
});

console.log("Calculate Reward Raw:", earnedRewardsData);

// Parsing
const rawEarned = earnedRewardsData ? BigInt(earnedRewardsData as any) : 0n;
const formattedEarnedVXC = parseFloat(formatUnits(rawEarned, 18)).toFixed(18);

console.log("✅ Final Parsed Earned VXC:", formattedEarnedVXC);

  // Safe & Strong Parsing
  let rawStakedBalance = 0n;

  if (stakerData) {
    if (Array.isArray(stakerData)) {
      rawStakedBalance = stakerData[0] ?? 0n;
    } 
    else if (typeof stakerData === 'object') {
      const data = stakerData as any;
      rawStakedBalance = 
        data.stakedAmount ?? 
        data.amount ?? 
        data[0] ?? 
        data._stakedAmount ?? 
        0n;
    } 
    else {
      rawStakedBalance = BigInt(stakerData as any);
    }
  }

  // 6 Decimals for vUSDC
  const stakedBalanceFormatted = parseFloat(formatUnits(rawStakedBalance, 6));

  console.log("✅ Final Parsed Staked Balance:", stakedBalanceFormatted);
  console.log("Stakers Raw Data:", earnedRewardsData); 

  // Exact variable name for UI rendering
  const earnedRewardFormatted = parseFloat(formatUnits(rawEarned, 18)).toFixed(18);

  console.log("✅ Final Parsed Earned VXC:", earnedRewardFormatted);
 // 6. Safe Auto-fetch when Wallet connects or reloads
  useEffect(() => {
    if (!address) return;

    const timer = setTimeout(() => {
      refetchStakedBalance();
      refetchRewards();
    }, 200); 

    return () => clearTimeout(timer);
  }, [address, refetchStakedBalance, refetchRewards]); 

    
  // STAKING WRITE HOOKS & TRANSACTIONS
  // ---------------------------------------------------------------------------
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const { writeContractAsync } = useWriteContract();

  const [isProcessing, setIsProcessing] = useState(false);

// Allowance ചെക്ക് (മറ്റ് useReadContract-കൾക്ക് സമീപം വയ്ക്കുക)
  const { 
  data: allowance, 
  refetch: refetchAllowance,
} = useReadContract({
  address: CONTRACT_ADDRESSES.USDC as `0x${string}`,
  abi: ERC20_ABI,
  functionName: 'allowance',
  args: [address as `0x${string}`, CONTRACT_ADDRESSES.STAKING as `0x${string}`],
  query: { 
    enabled: !!address,
  },
});

  const amountParsed = stakeAmount ? parseUnits(stakeAmount || '0', 6) : 0n;

const needsApproval =
  !!address &&
  amountParsed > 0n &&
  (allowance === undefined || (allowance as bigint) < amountParsed); 


  // ===== Combined Approve + Stake =====
  const handleApproveAndStake = async () => {
    if (!stakeAmount || Number(stakeAmount) <= 0) return;
    setStakeTxHash('');
    setIsProcessing(true);

    try {
      // 1. Approve if required
      if (needsApproval) {
        const approveHash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.USDC as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.STAKING as `0x${string}`, amountParsed],
        });
        console.log('Approve Tx Hash:', approveHash);

        const approveReceipt = await waitForTransactionReceipt(config, { hash: approveHash });
        if (approveReceipt.status !== 'success') {
          throw new Error('Approve failed');
        }
      }

      // 2. Stake logic
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.STAKING as `0x${string}`,
        abi: STAKING_ABI,
        functionName: 'stake',
        args: [amountParsed],
      });

      console.log('Stake Tx Hash:', hash);
setStakeTxHash(hash);

const receipt = await waitForTransactionReceipt(config, { hash });
      if (receipt.status === 'success') {
        await queryClient.invalidateQueries();
        await Promise.all([
          refetchStakedBalance(),
          refetchRewards(),
          refetchAllowance?.(),
        ]);
        setStakeAmount('');
      }
    } catch (err) {
      console.error('Approve & Stake Error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

 // 3. Unstake / Withdraw vUSDC
const handleWithdraw = async () => {
  if (!stakeAmount || isNaN(parseFloat(stakeAmount)) || parseFloat(stakeAmount) <= 0) {
    console.warn('Please enter a valid amount to unstake');
    return;
  }

  try {
    const amountParsed = parseUnits(stakeAmount, 6);

    const tx = await writeContractAsync({
      address: CONTRACT_ADDRESSES.STAKING as `0x${string}`,
      abi: STAKING_ABI,
      functionName: 'unstake', 
      args: [amountParsed],
    });

   console.log('Unstake Tx:', tx);
setStakeTxHash(tx); // 🔴 setTxHash(tx)-ന് പകരം ഇത് നൽകുക
setStakeAmount('');
    refetchStakedBalance();
    refreshAllBalances();
    queryClient.invalidateQueries();
  } catch (err) {
    console.error('Unstake Error:', err);
  }
}; 

  // 3. Claim Rewards (VXC)
  const handleClaim = async () => {
  try {
    const tx = await writeContractAsync({
      address: CONTRACT_ADDRESSES.STAKING,
      abi: STAKING_ABI,
      functionName: 'claimReward', // അല്ലെങ്കിൽ നിങ്ങളുടെ ABI-യിലെ ഫംഗ്ഷൻ പേര്
    });

    console.log('Claim Tx:', tx);
    setStakeTxHash(tx); 

    // 1. റീവാർഡ് ഡാറ്റയും വാലറ്റ് ബാലൻസും റിഫ്രഷ് ചെയ്യുക
    if (refetchRewards) await refetchRewards(); 
    
    // 2. React Query Cache ക്ലിയർ ചെയ്ത് പുതിയ ഡാറ്റ Fetch ചെയ്യുക
    queryClient.invalidateQueries();

  } catch (err) {
    console.error('Claim Error:', err);
  }
}; 
  // 6. Pool Reserves
  const { data: reservesData, refetch: refetchReserves, isLoading: isReservesLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.POOL,
    abi: POOL_ABI,
    functionName: 'getReserves',
    query: {
      refetchInterval: 10000,
    },
  });

  const reserveUsdc = reservesData ? reservesData[0] : 0n;
  const reserveArcg = reservesData ? reservesData[1] : 0n;

  const reserveUsdcFormatted = parseFloat(formatUnits(reserveUsdc, 6)).toFixed(2);
  const reserveArcgFormatted = parseFloat(formatUnits(reserveArcg, 18)).toFixed(2);

  const hasReservesLoaded = !isReservesLoading && reservesData !== undefined;
  const hasLiquidity = hasReservesLoaded && Number(reserveUsdc) > 0 && Number(reserveArcg) > 0;

  // Helper to trigger refetch of all states
  // Helper to trigger refetch of all states
const refreshAllBalances = async () => {
  try {
    await Promise.all([
      refetchGasBalance(),
      refetchErc20Usdc(),
      refetchArcg(),
      refetchLp(),
      refetchReserves(),
      refetchLpSupply()
    ]);
    console.log("✅ All balances refreshed successfully");
  } catch (error) {
    console.error("❌ Refresh error:", error);
  }
};

  useEffect(() => {
  if (isConnected && address) {
    refreshAllBalances();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [address, isConnected]); 

  // ----------------------------------------------------
  // GENERAL WRITE TRANSACTION STATE
  // ----------------------------------------------------
  const { writeContract, data: txHash, error: txError, isPending: isTxPending, reset: resetTx } = useWriteContract();
  const activeTxHash = txHash;
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: activeTxHash });

  // Clear states when tab changes
  useEffect(() => {
    resetTx();
  }, [activeTab]);

  // ----------------------------------------------------
  // TAB 1: SWAP INTERFACE
  // ----------------------------------------------------
  const [swapDirection, setSwapDirection] = useState<'usdc-to-arcg' | 'arcg-to-usdc'>('usdc-to-arcg');
  const [swapInput, setSwapInput] = useState<string>('');
  const [swapOutput, setSwapOutput] = useState<string>('0');
  const [priceImpact, setPriceImpact] = useState<string>('0.00');

  // Calculates swap output locally for instant feedback
  useEffect(() => {
    if (!swapInput || isNaN(parseFloat(swapInput)) || parseFloat(swapInput) <= 0) {
      setSwapOutput('0');
      setPriceImpact('0.00');
      return;
    }

    try {
      const isUsdc = swapDirection === 'usdc-to-arcg';
      const inputDecimals = isUsdc ? 6 : 18;
      const amountIn = parseUnits(swapInput, inputDecimals);
      const rIn = isUsdc ? reserveUsdc : reserveArcg;
      const rOut = isUsdc ? reserveArcg : reserveUsdc;

      if (rIn === 0n || rOut === 0n) {
        setSwapOutput('No Liquidity');
        setPriceImpact('100.00');
        return;
      }

      // x * y = k formula with 0.3% fee
      const amountInWithFee = amountIn * 997n;
      const numerator = amountInWithFee * rOut;
      const denominator = (rIn * 1000n) + amountInWithFee;
      const outAmount = numerator / denominator;

      const outputDecimals = isUsdc ? 18 : 6;
      setSwapOutput(formatUnits(outAmount, outputDecimals));

      // Price Impact Math: (Ideal swap price - Real swap price) / Ideal swap price
      // Ideal Swap Price = reserveOut / reserveIn
      // Real Swap Price = amountOut / amountIn
      const reserveInFloat = parseFloat(formatUnits(rIn, inputDecimals));
      const reserveOutFloat = parseFloat(formatUnits(rOut, outputDecimals));
      const inputFloat = parseFloat(swapInput);
      const outputFloat = parseFloat(formatUnits(outAmount, outputDecimals));

      const idealPrice = reserveOutFloat / reserveInFloat;
      const realPrice = outputFloat / inputFloat;
      const impact = ((idealPrice - realPrice) / idealPrice) * 100;
      setPriceImpact(Math.max(0, impact).toFixed(2));
    } catch (e) {
      console.error("Swap output calculation error:", e);
      setSwapOutput('0');
    }
  }, [swapInput, swapDirection, reserveUsdc, reserveArcg]);

  // Fetch Swap Allowance
  const tokenInAddress = swapDirection === 'usdc-to-arcg' ? CONTRACT_ADDRESSES.USDC : CONTRACT_ADDRESSES.ARCG;
  const tokenInDecimals = swapDirection === 'usdc-to-arcg' ? 6 : 18;

  const { data: swapAllowanceRaw, refetch: refetchSwapAllowance } = useReadContract({
    address: tokenInAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESSES.POOL] : undefined,
  });

  const parsedSwapInput = swapInput && !isNaN(parseFloat(swapInput)) ? parseUnits(swapInput, tokenInDecimals) : 0n;
  const needsSwapApproval = swapAllowanceRaw !== undefined && parsedSwapInput > 0n && swapAllowanceRaw < parsedSwapInput;

  // Execute Token Approval for Swap
  const handleApproveSwap = async () => {
    if (!tokenInAddress || parsedSwapInput === 0n) return;
    resetTx();
    writeContract({
      address: tokenInAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACT_ADDRESSES.POOL, parsedSwapInput],
    });
  };

  // Execute Swap transaction
  const handleSwap = async () => {
    if (parsedSwapInput === 0n) return;
    resetTx();
    
    // Set 0.5% slippage tolerance
    const expectedOutDecimals = swapDirection === 'usdc-to-arcg' ? 18 : 6;
    const expectedOutRaw = parseUnits(swapOutput, expectedOutDecimals);
    const minAmountOut = (expectedOutRaw * 995n) / 1000n; // 99.5%

    writeContract({
      address: CONTRACT_ADDRESSES.POOL,
      abi: POOL_ABI,
      functionName: 'swap',
      args: [tokenInAddress, parsedSwapInput, minAmountOut],
    });
  };

  // Trigger refetches after swap actions
  useEffect(() => {
    if (isTxSuccess) {
      refreshAllBalances();
      refetchSwapAllowance();
    }
  }, [isTxSuccess]);

  // ----------------------------------------------------
  // TAB 2: LIQUIDITY PROVISION
  // ----------------------------------------------------
  const [liqUsdcInput, setLiqUsdcInput] = useState<string>('');
  const [liqArcgInput, setLiqArcgInput] = useState<string>('');
  const [isRemovingLiquidity, setIsRemovingLiquidity] = useState<boolean>(false);
  const [removeLpAmount, setRemoveLpAmount] = useState<string>('');
  // Proportional input helper for adding liquidity
// Proportional input helper for adding liquidity
const handleLiqUsdcChange = (value: string) => {
  setLiqUsdcInput(value);

  // ഇൻപുട്ട് ക്ലിയർ ചെയ്യുകയോ അക്ഷരങ്ങൾ അടിക്കുകയോ ചെയ്താൽ ARCG ഫീൽഡും ക്ലിയർ ചെയ്യുക
  if (value === '' || isNaN(Number(value))) {
    setLiqArcgInput('');
    return;
  }

  // പൂളിൽ റിസർവ് ഉണ്ടെങ്കിൽ ARCG തനിയെ കാൽക്കുലേറ്റ് ചെയ്യും
  if (reserveUsdc > 0n && reserveArcg > 0n) {
    try {
      const usdcIn = parseUnits(value, 6);
      const arcgOptimal = (usdcIn * reserveArcg) / reserveUsdc;
      setLiqArcgInput(formatUnits(arcgOptimal, 18));
    } catch {
      // parseUnits എറർ വന്നാൽ അവഗണിക്കുക
    }
  }
};

const handleLiqArcgChange = (value: string) => {
  setLiqArcgInput(value);

  // ഇൻപുട്ട് ക്ലിയർ ചെയ്യുകയോ അക്ഷരങ്ങൾ അടിക്കുകയോ ചെയ്താൽ vUSDC ഫീൽഡും ക്ലിയർ ചെയ്യുക
  if (value === '' || isNaN(Number(value))) {
    setLiqUsdcInput('');
    return;
  }

  // പൂളിൽ റിസർവ് ഉണ്ടെങ്കിൽ vUSDC തനിയെ കാൽക്കുലേറ്റ് ചെയ്യും
  if (reserveUsdc > 0n && reserveArcg > 0n) {
    try {
      const arcgIn = parseUnits(value, 18);
      const usdcOptimal = (arcgIn * reserveUsdc) / reserveArcg;
      setLiqUsdcInput(formatUnits(usdcOptimal, 6));
    } catch {
      // parseUnits എറർ വന്നാൽ അവഗണിക്കുക
    }
  }
}; 


  // Allowances for adding liquidity
  const { data: liqUsdcAllowanceRaw, refetch: refetchLiqUsdcAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.USDC,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESSES.POOL] : undefined,
  });

  const { data: liqArcgAllowanceRaw, refetch: refetchLiqArcgAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.ARCG,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESSES.POOL] : undefined,
  });

  const parsedLiqUsdc = liqUsdcInput && !isNaN(parseFloat(liqUsdcInput)) ? parseUnits(liqUsdcInput, 6) : 0n;
  const parsedLiqArcg = liqArcgInput && !isNaN(parseFloat(liqArcgInput)) ? parseUnits(liqArcgInput, 18) : 0n;

  const needsLiqUsdcApprove = liqUsdcAllowanceRaw !== undefined && parsedLiqUsdc > 0n && liqUsdcAllowanceRaw < parsedLiqUsdc;
  const needsLiqArcgApprove = liqArcgAllowanceRaw !== undefined && parsedLiqArcg > 0n && liqArcgAllowanceRaw < parsedLiqArcg;
  const calculateExpectedLp = () => {
  const usdc = parseFloat(liqUsdcInput);
  const arcg = parseFloat(liqArcgInput);

  if (!usdc || !arcg || usdc <= 0 || arcg <= 0) return "0.0000";

  // Use the pool values fetched above, converted to their display units.
  const totalLp = lpTotalSupply;
const reserveUsdcValue = reserveUsdc ? parseFloat(formatUnits(reserveUsdc, 6)) : 0;
const reserveArcgValue = reserveArcg ? parseFloat(formatUnits(reserveArcg, 18)) : 0;

  if (totalLp === 0 || reserveUsdcValue === 0 || reserveArcgValue === 0) {
    return Math.sqrt(usdc * arcg).toFixed(4);
  }

  const lpFromUsdc = (usdc * totalLp) / reserveUsdcValue;
  const lpFromArcg = (arcg * totalLp) / reserveArcgValue;

  const result = Math.min(lpFromUsdc, lpFromArcg);
  return isNaN(result) ? "0.0000" : result.toFixed(4);
};
  // Approve USDC for Liquidity
  // Lines 298 - 307: Approve USDC for Liquidity
const handleApproveLiqUsdc = async () => {
  if (parsedLiqUsdc === 0n) return;
  resetTx(); // ശ്രദ്ധിക്കുക: resetTx-ൽ ഇൻപുട്ട് ഫീൽഡുകൾ ക്ലിയർ ചെയ്യുന്ന കോഡ് ഉണ്ടാകരുത്

  writeContract({
    address: CONTRACT_ADDRESSES.USDC, // അല്ലെങ്കിൽ vUSDC address
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [CONTRACT_ADDRESSES.POOL, parsedLiqUsdc],
  });
};

// Lines 310 - 319: Approve ARCG for Liquidity
const handleApproveLiqArcg = async () => {
  if (parsedLiqArcg === 0n) return;
  resetTx();

  writeContract({
    address: CONTRACT_ADDRESSES.ARCG,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [CONTRACT_ADDRESSES.POOL, parsedLiqArcg],
  });
};

// Lines 322 - 332: Add Liquidity execution
const handleAddLiquidity = async () => {
  if (parsedLiqUsdc === 0n || parsedLiqArcg === 0n) return;
  resetTx();

  writeContract({
    address: CONTRACT_ADDRESSES.POOL,
    abi: POOL_ABI,
    functionName: 'addLiquidity',
    args: [parsedLiqUsdc, parsedLiqArcg],
  });
};

  // Remove Liquidity execution
  const handleRemoveLiquidity = async () => {
    if (!removeLpAmount || isNaN(parseFloat(removeLpAmount)) || parseFloat(removeLpAmount) <= 0) return;
    resetTx();
    const parsedLpAmount = parseUnits(removeLpAmount, 18);
    writeContract({
      address: CONTRACT_ADDRESSES.POOL,
      abi: POOL_ABI,
      functionName: 'removeLiquidity',
      args: [parsedLpAmount],
    });
  };

   // Trigger refetches after any successful tx
useEffect(() => {
  if (isTxSuccess) {
    refreshAllBalances();
    refetchStakedBalance(); // <--- Staked Balance റിഫ്രഷ് ചെയ്യാൻ
    refetchRewards();       // <--- Claim Rewards അപ്ഡേറ്റ് ചെയ്യാൻ
    refetchSwapAllowance();
    refetchLiqUsdcAllowance();
    refetchLiqArcgAllowance();

    setTimeout(() => {
      refreshAllBalances();
      refetchStakedBalance();
      refetchRewards();
    }, 800);

    // Clear input fields
    setRemoveLpAmount('');
    setSwapInput('');
    setStakeAmount('');
    setLiqUsdcInput('');
    setLiqArcgInput('');
  }
}, [isTxSuccess]); 
  // ----------------------------------------------------
  // TAB 3: MOCK FAUCET MINTING
  // ----------------------------------------------------
  const handleMintTokens = async () => {  
    resetTx();
    // Mint 100 Mock USDC (6 decimals)
    writeContract({
      address: "0xf8f9E5BA0077a77B07D5c5A35473Da74A09b885f",
      abi: ERC20_ABI,
      functionName: 'mint',
      args: [address!, parseUnits("100", 6)],
    });
  };

  const handleMintArcg = async () => {
    resetTx();
    // Mint 1000 ARCG (18 decimals)
    writeContract({
      address: "0x19a5E533c6c27c382A9dF2d52422D3F085647Ed0",
      abi: ERC20_ABI,
      functionName: 'mint',
      args: [address!, parseUnits("1000", 18)],
    });
  };

  // ----------------------------------------------------
  // WALLET ACTIONS
  // ----------------------------------------------------
  const handleConnectWallet = async () => {
    // Injected wallet provider logic
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      } else {
        alert("Metamask or another Web3 extension is required.");
      }
    } catch (e) {
      console.error("Wallet connection failed", e);
    }
  };

  const handleSwitchNetwork = () => {
    switchChain({ chainId: arcTestnet.id });
  };

  // ----------------------------------------------------
  // UI COPY HELPERS
  // ----------------------------------------------------
  const currentTokenInLabel = swapDirection === 'usdc-to-arcg' ? 'vUSDC' : 'ARCG';
  const currentTokenOutLabel = swapDirection === 'usdc-to-arcg' ? 'ARCG' : 'vUSDC';
  const currentBalanceIn = swapDirection === 'usdc-to-arcg' ? erc20UsdcBalance : arcgBalance;
  const currentBalanceOut = swapDirection === 'usdc-to-arcg' ? arcgBalance : erc20UsdcBalance;

  return (
    <div className="app-container">
      {/* Top Navigation / Header */}
      <header className="header">
        <a href="#" className="logo-container">
          <span className="logo-icon">🔄</span>
          <span className="logo-text">VeloxSwap</span>
        </a>
        
        <div className="header-actions">
          {isConnected && (
            <div className="network-badge">
              <div className={`network-dot ${isWrongNetwork ? 'wrong' : ''}`}></div>
              {isWrongNetwork ? 'Wrong Network' : 'Arc Testnet'}
            </div>
          )}
           {isConnected && (
    <button 
      className="btn-icon-only" 
      onClick={refreshAllBalances}
      title="Refresh All Balances"
      style={{ marginRight: '10px' }}
    >
      <RefreshCw size={18} />
    </button>
  )}

    <WalletConnectButton />      
        </div>
      </header>

      {/* Main content body */}
      <main className="main-content">
        {/* Navigation Tabs */}
        <div className="tabs-container">
          <button 
            className={`tab-btn ${activeTab === 'swap' ? 'active' : ''}`}
            onClick={() => setActiveTab('swap')}
          >
            Swap
          </button>
          <button 
            className={`tab-btn ${activeTab === 'liquidity' ? 'active' : ''}`}
            onClick={() => setActiveTab('liquidity')}
          >
            Liquidity (LP)
          </button>
          <button
  className={`tab-btn ${activeTab === 'stake' ? 'active' : ''}`}
  onClick={() => setActiveTab('stake')}
>
  Stake
</button>
          <button 
            className={`tab-btn ${activeTab === 'faucet' ? 'active' : ''}`}
            onClick={() => setActiveTab('faucet')}
          >
            Faucet
          </button> 
         <button
          className="tab-btn"
          onClick={() => window.open('https://x.com/Scarfacedrop', '_blank')}
        >
          Contact
        </button> 
        </div>

        {/* Global Network Guard Warning */}
        {isWrongNetwork ? (
          <div className="swap-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <AlertCircle size={48} color="var(--color-error)" style={{ marginBottom: '1.5rem' }} />
            <h2 style={{ fontFamily: 'var(--font-outfit)', fontSize: '1.5rem', marginBottom: '0.75rem' }}>Wrong Network</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
              This application only runs on Arc Testnet. Please switch your wallet network to continue trading.
            </p>
            <button className="btn-action" onClick={handleSwitchNetwork}>
              Switch to Arc Testnet
            </button>
          </div>
        ) : !isConnected ? (
          /* Connect Wallet landing state */
          <div className="swap-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <Coins size={48} color="var(--color-primary)" style={{ marginBottom: '1.5rem', animation: 'float 3s ease-in-out infinite' }} />
            <h2 style={{ fontFamily: 'var(--font-outfit)', fontSize: '1.5rem', marginBottom: '0.75rem' }}>Welcome to VeloxSwap</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
              Connect your Ethereum Web3 wallet to start swapping assets instantly with sub-second finality on Arc Testnet.
            </p>
            <button className="btn-action" onClick={handleConnectWallet}>
              Connect Wallet
            </button>
          </div>
        ) : (
          /* Main Trading Interfaces */
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            {/* SWAP TAB */}
            {activeTab === 'swap' && (
              <div className="swap-card">
                <div className="card-title-row">
                  <h2>Swap Tokens</h2>
                  <button className="btn-icon-only" onClick={refreshAllBalances} title="Refresh reserves">
                    <RefreshCw size={16} />
                  </button>
                </div>

                {/* Input Token A */}
                <div className="input-group">
                  <div className="balance-row">
                    <span>From</span>
                    <span>
                      Balance: {currentBalanceIn} {currentTokenInLabel}
                    </span>
                  </div>
                  <div className="input-row">
                    <input 
                      type="text" 
                      className="token-input" 
                      placeholder="0.0" 
                      value={swapInput}
                      onChange={(e) => setSwapInput(e.target.value)}
                    />
                    <div className="token-selector">
                      <span className="token-logo">{swapDirection === 'usdc-to-arcg' ? '💵' : '🪙'}</span>
                      <span>{currentTokenInLabel}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <button 
                      className="btn-max" 
                      onClick={() => setSwapInput(currentBalanceIn)}
                    >
                      Max
                    </button>
                  </div>
                </div>

                {/* Switch Direction Button */}
                <div className="arrow-divider">
                  <button 
                    className="btn-switch-direction" 
                    onClick={() => {
                      setSwapDirection(prev => prev === 'usdc-to-arcg' ? 'arcg-to-usdc' : 'usdc-to-arcg');
                      setSwapInput('');
                      setSwapOutput('0');
                    }}
                  >
                    <ArrowDownUp size={16} />
                  </button>
                </div>

                {/* Output Token B */}
                <div className="input-group" style={{ marginTop: '0.5rem' }}>
                  <div className="balance-row">
                    <span>To (Estimated)</span>
                    <span>
                      Balance: {currentBalanceOut} {currentTokenOutLabel}
                    </span>
                  </div>
                  <div className="input-row">
                    <input 
                      type="text" 
                      className="token-input" 
                      readOnly 
                     value={
          !hasReservesLoaded
            ? 'Loading...'
            : !hasLiquidity
            ? 'No Liquidity'
            : isNaN(parseFloat(swapOutput))
            ? '0.0'
            : swapOutput
        } 
                    />
                    <div className="token-selector">
                      <span className="token-logo">{swapDirection === 'usdc-to-arcg' ? '🪙' : '💵'}</span>
                      <span>{currentTokenOutLabel}</span>
                    </div>
                  </div>
                </div>

                {/* Transaction details breakdown */}
                {parseFloat(swapInput) > 0 && hasLiquidity && ( 
                  <div className="details-container">
                    <div className="detail-item">
                      <span>Rate</span>
                      <span className="detail-value">
                        1 {currentTokenInLabel} = { (parseFloat(swapOutput) / parseFloat(swapInput)).toFixed(4) } {currentTokenOutLabel}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span>Price Impact</span>
                      <span className="detail-value" style={{ color: parseFloat(priceImpact) > 5 ? 'var(--color-warning)' : 'var(--text-primary)' }}>
                        {priceImpact}%
                      </span>
                    </div>
                    <div className="detail-item">
                      <span>Liquidity Provider Fee (0.3%)</span>
                      <span className="detail-value">
                      {(parseFloat(swapInput) * 0.003).toFixed(5)} {currentTokenInLabel}
                     </span>
                    </div>
                  </div>
                )}

                {/* Gas Token Balance Warning */}
                {parseFloat(nativeGasBalance) < 0.1 && (
                  <div className="gas-warning">
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <div>
                      Your Gas Balance is low (<strong>{nativeGasBalance} USDC</strong>). You pay transaction gas fees in native USDC on Arc. Request gas from the <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">Circle Faucet <ExternalLink size={10} style={{ display: 'inline' }} /></a>.
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ marginTop: '1.25rem' }}>
                  {needsSwapApproval ? (
                    <button 
                      className="btn-action" 
                      onClick={handleApproveSwap} 
                      disabled={isTxPending || isTxConfirming}
                    >
                      {isTxPending || isTxConfirming ? (
                        <RefreshCw size={18} className="spin" />
                      ) : null}
                      Approve {currentTokenInLabel}
                    </button>
                  ) : (
                    <button 
                      className="btn-action" 
                      onClick={handleSwap} 
                      disabled={!swapInput || swapOutput === '0' || swapOutput === 'No Liquidity' || isTxPending || isTxConfirming || parseFloat(currentBalanceIn) < parseFloat(swapInput)}
                    >
                      {isTxPending || isTxConfirming ? (
                        <RefreshCw size={18} className="spin" />
                      ) : null}
                      {parseFloat(currentBalanceIn) < parseFloat(swapInput) ? 'Insufficient Balance' : 'Swap Assets'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* LIQUIDITY TAB */}
            {activeTab === 'liquidity' && (
              <div className="swap-card">
                <div className="card-title-row">
                  <h2>Pool Liquidity</h2>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="tab-btn" 
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', background: !isRemovingLiquidity ? 'rgba(255,255,255,0.08)' : 'transparent' }}
                      onClick={() => setIsRemovingLiquidity(false)}
                    >
                      Add
                    </button>
                    <button 
                      className="tab-btn" 
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', background: isRemovingLiquidity ? 'rgba(255,255,255,0.08)' : 'transparent' }}
                      onClick={() => setIsRemovingLiquidity(true)}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {!isRemovingLiquidity ? (
                  /* ADD LIQUIDITY FORM */
                  <div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                      Deposit equal values of vUSDC and ARCG to earn 0.3% fees on swaps.
                    </p>

                    {/* Deposit vUSDC Input */}
                    <div className="input-group">
                      <div className="balance-row">
                        <span>vUSDC Amount (6 Decimals)</span>
                        <span>Balance: {erc20UsdcBalance} vUSDC</span>
                      </div>
                      <div className="input-row">
                      <input 
                        type="text"
                        className="token-input"
                        placeholder="0.0"
                        value={liqUsdcInput} 
                        onChange={(e) => handleLiqUsdcChange(e.target.value)} // 
                       />  
                        <div className="token-selector">💵 vUSDC</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0' }}>
                      <Plus size={16} color="var(--text-secondary)" />
                    </div>

                    {/* Deposit ARCG Input */}
                    <div className="input-group">
                      <div className="balance-row">
                        <span>ARCG Amount (18 Decimals)</span>
                        <span>Balance: {arcgBalance} ARCG</span>
                      </div>
                      <div className="input-row">
                        <input 
                          type="text"
                          className="token-input"
                          placeholder="0.0"
                          value={liqArcgInput} 
                          onChange={(e) => handleLiqArcgChange(e.target.value)} //
                        />
                        <div className="token-selector">🪙 ARCG</div>
                      </div>
                    </div>

                    {liqUsdcInput && liqArcgInput && parseFloat(liqUsdcInput) > 0 && parseFloat(liqArcgInput) > 0 && (
                      <div className="details-container" style={{ marginBottom: '1rem' }}>
                        <div className="detail-item">
                          <span>Estimated LP</span>
                          <span className="detail-value">{calculateExpectedLp()} LP</span> 
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: '1.25rem' }}>
                      {needsLiqUsdcApprove ? (
                        <button className="btn-action" onClick={handleApproveLiqUsdc} disabled={isTxPending || isTxConfirming}>
                          Approve vUSDC
                        </button>
                      ) : needsLiqArcgApprove ? (
                        <button className="btn-action" onClick={handleApproveLiqArcg} disabled={isTxPending || isTxConfirming}>
                          Approve ARCG
                        </button>
                      ) : (
                        <button 
                          className="btn-action" 
                          onClick={handleAddLiquidity} 
                          disabled={!liqUsdcInput || !liqArcgInput || isTxPending || isTxConfirming || parseFloat(erc20UsdcBalance) < parseFloat(liqUsdcInput) || parseFloat(arcgBalance) < parseFloat(liqArcgInput)}
                        >
                          {isTxPending || isTxConfirming ? <RefreshCw size={18} className="spin" /> : <Droplet size={18} />}
                          Add Liquidity
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* REMOVE LIQUIDITY FORM */
                  <div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                      Burn your LP tokens to withdraw your share of vUSDC and ARCG from the pool.
                    </p>

                    <div className="input-group">
                      <div className="balance-row">
                        <span>Burn LP Tokens</span>
                        <span>LP Balance: {lpBalance} ARC-LP</span>
                      </div>
                      <div className="input-row">
                        <input 
                          type="text" 
                          className="token-input" 
                          placeholder="0.0" 
                          value={removeLpAmount}
                          onChange={(e) => setRemoveLpAmount(e.target.value)}
                        />
                        <div className="token-selector">🌀 ARC-LP</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <button className="btn-max" onClick={() => setRemoveLpAmount(lpBalance)}>Max</button>
                      </div>
                    </div>

                    {removeLpAmount && !isNaN(parseFloat(removeLpAmount)) && lpTotalSupply > 0 && (
                      <div className="details-container">
                        <h4 style={{ fontSize: '0.8rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Estimated Returns:</h4>
                        <div className="detail-item">
                          <span>vUSDC</span>
                          <span className="detail-value">
                            {(parseFloat(formatUnits(reserveUsdc, 6)) * (parseFloat(removeLpAmount) / lpTotalSupply)).toFixed(4)} vUSDC
                          </span>
                        </div>
                        <div className="detail-item">
                          <span>ARCG</span>
                          <span className="detail-value">
                            {(parseFloat(formatUnits(reserveArcg, 18)) * (parseFloat(removeLpAmount) / lpTotalSupply)).toFixed(4)} ARCG
                          </span>
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: '1.25rem' }}>
                      <button 
                        className="btn-action" 
                        onClick={handleRemoveLiquidity} 
                        disabled={!removeLpAmount || isTxPending || isTxConfirming || parseFloat(lpBalance) < parseFloat(removeLpAmount)}
                      >
                        {isTxPending || isTxConfirming ? <RefreshCw size={18} className="spin" /> : <Minus size={18} />}
                        Remove Liquidity
                      </button>
                    </div>
                  </div>
                )}

                {/* Pool Status Statistics */}
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', fontFamily: 'var(--font-outfit)' }}>Current Pool Reserves</h3>
                  <div className="lp-grid">
                    <div className="lp-stat-card">
                      <div className="lp-stat-label">vUSDC Reserve</div>
                      <div className="lp-stat-value">{reserveUsdcFormatted}</div>
                    </div>
                    <div className="lp-stat-card">
                      <div className="lp-stat-label">ARCG Reserve</div>
                      <div className="lp-stat-value">{reserveArcgFormatted}</div>
                    </div>
                  </div>
                  <div className="lp-stat-card" style={{ marginTop: '0.75rem' }}>
                    <div className="lp-stat-label">Total LP Shares Issued</div>
                    <div className="lp-stat-value">{lpTotalSupply.toFixed(4)} LP</div>
                  </div>
                </div>

              </div>
            )}
            {/* STAKING TAB */}
        {activeTab === 'stake' && (
        <div className="swap-card">
          <div className="card-title-row" style={{ display: 'block' }}>
            <h2>vUSDC Staking</h2>
            <span style={{ fontSize: '0.85rem', color: '#34d399', marginTop: '4px', display: 'block' }}>
            3% APY Staking Reward • Earn VXC token rewards by staking your vUSDC
          </span> 
          </div>

              {/* Staked Balance & Earned Rewards Displays */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#888' }}>Staked vUSDC</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff', marginTop: '0.2rem' }}>
                    {stakedBalanceFormatted}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#888' }}>Earned VXC</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#10b981', marginTop: '0.2rem' }}>
                    {earnedRewardFormatted}
                  </div>
                </div>
              </div>

              {/* Input Field with Wallet Balance Display */}
              <div className="input-group">
                <div className="balance-row" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '0.4rem' }}>
                  <span style={{ color: '#aaa', fontSize: '0.85rem' }}>Amount</span>
                  <span style={{ color: '#888', fontSize: '0.8rem' }}>
                    Wallet: <strong style={{ color: '#fff' }}>{erc20UsdcBalance || '0.00'} vUSDC</strong>
                  </span>
                </div>
                <div className="input-row"> 
                  <input
                    type="number"
                    className="token-input"
                    placeholder="0.0"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                  />
                  <div className="token-selector">
                    <span className="token-logo">vUSDC</span>
                  </div>
                </div>
              </div>

         {/* Action Buttons: Approve & Stake + Unstake */}
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
  
  {/* Combined Approve & Stake Button */}
  <button
    className="btn-connect"
    style={{
      background: isProcessing
        ? '#6b7280'
        : 'linear-gradient(to right, #8b5cf6, #4f46e5)',
      fontSize: '0.85rem',
      padding: '0.6rem 0.2rem',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      width: '100%',
      opacity: isProcessing ? 0.7 : 1,
      cursor: isProcessing ? 'not-allowed' : 'pointer',
    }}
    onClick={handleApproveAndStake}
    disabled={isProcessing || !stakeAmount || Number(stakeAmount) <= 0}
  >
    {isProcessing
  ? 'Processing...'
  : needsApproval
  ? 'Approve & Stake'
  : 'Stake'}  
  </button>

  {/* Unstake Button */}
  <button
    className="btn-connect"
    style={{
      background: '#ef4444',
      fontSize: '0.85rem',
      padding: '0.6rem 0.2rem',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      width: '100%',
    }}
    onClick={handleWithdraw}
  >
    Unstake
  </button>
</div>

        {/* Claim Rewards Button */}
        <button
          className="btn-connect"
          onClick={handleClaim}
          disabled={!earnedRewardFormatted || Number(earnedRewardFormatted) <= 0}
          style={{
            width: '100%',
            marginTop: '0.75rem',
            background: (!earnedRewardFormatted || Number(earnedRewardFormatted) <= 0) ? '#374151' : '#059669',
            color: (!earnedRewardFormatted || Number(earnedRewardFormatted) <= 0) ? '#9ca3af' : '#ffffff',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            padding: '0.6rem 0.2rem',
            cursor: (!earnedRewardFormatted || Number(earnedRewardFormatted) <= 0) ? 'not-allowed' : 'pointer',
            opacity: (!earnedRewardFormatted || Number(earnedRewardFormatted) <= 0) ? 0.6 : 1
          }}
        >
          Claim VXC Rewards
        </button> 
       {stakeTxHash && (
            <div style={{
              marginTop: '12px',
              padding: '10px 14px',
              backgroundColor: 'rgba(6, 78, 59, 0.25)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '10px',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontWeight: '600', fontSize: '12px' }}>
                <CheckCircle style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                <span>Transaction Success!</span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '10px', color: '#9ca3af', fontWeight: '400' }}>
                Your request was completed with sub-second finality.
              </p>
              <a
                href={`https://testnet.arcscan.app/tx/${stakeTxHash}`} 
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#38bdf8',
                  fontSize: '10px',
                  marginTop: '4px',
                  fontWeight: '500',
                  textDecoration: 'none'
                }}
              >
                View on Explorer <ExternalLink style={{ width: '10px', height: '10px' }} />
              </a>
            </div>
          )} 
      </div>
    )}

    {/* FAUCET TAB */}
    {activeTab === 'faucet' && (
              <div className="swap-card" style={{ textAlign: 'center' }}>
                <Coins size={40} color="var(--color-secondary)" style={{ marginBottom: '1rem' }} />
                <h2>Arc Testnet Faucet</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                  Mint mock vUSDC and ARCG tokens to test swap features instantly.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="lp-stat-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Get 100 vUSDC</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Mints 100 6-decimal vUSDC tokens.</p>
                    </div>
                    <button className="btn-connect" style={{ padding: '0.5rem 1rem' }} onClick={handleMintTokens} disabled={isTxPending || isTxConfirming}>
                      Mint vUSDC 
                    </button>
                  </div>

                  <div className="lp-stat-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Get 1,000 ARCG</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Mints 1,000 18-decimal ARCG tokens.</p>
                    </div>
                    <button className="btn-connect" style={{ padding: '0.5rem 1rem' }} onClick={handleMintArcg} disabled={isTxPending || isTxConfirming}>
                      Mint ARCG
                    </button>
                  </div>
                </div>

                <div className="details-container" style={{ marginTop: '1.5rem', textAlign: 'left' }}>
                  <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Need Native USDC for Gas?</h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    Gas on the Arc ledger is paid in native 18-decimal USDC. If your Gas balance is low, you must request USDC from the official faucet:
                  </p>
                  <a 
                    href="https://faucet.circle.com" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="explorer-link"
                    style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}
                  >
                    Go to faucet.circle.com <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            )}

            {/* TRANSACTIONS STATUS BLOCK */}
            <div style={{ width: '100%', maxWidth: '480px' }}>
              
              {/* Transaction Confirming / Confirming Loading Toast */}
              {(isTxPending || isTxConfirming) && (
                <div className="status-box">
                  <div className="status-header">
                    <RefreshCw className="spin" size={16} color="var(--color-primary)" />
                    <span>Transaction Pending...</span>
                  </div>
                  <div className="status-body">
                    {isTxConfirming ? 'Waiting for block confirmation on Arc Testnet...' : 'Please approve the transaction in your wallet...'}
                    {txHash && (
                      <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="explorer-link">
                        View on Explorer <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Transaction Success Alert */}
              {isTxSuccess && txHash && (
                <div className="status-box" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)' }}>
                  <div className="status-header" style={{ color: 'var(--color-success)' }}>
                    <CheckCircle size={16} />
                    <span>Transaction Success!</span>
                  </div>
                  <div className="status-body">
                    Your request was completed with sub-second finality.
                    <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="explorer-link">
                      View on Explorer <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              )}

              {/* Transaction Fail Alert */}
              {txError && (
                <div className="status-box" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
                  <div className="status-header" style={{ color: 'var(--color-error)' }}>
                    <AlertCircle size={16} />
                    <span>Transaction Failed</span>
                  </div>
                  <div className="status-body">
                    {txError.message.includes('User rejected') ? 'Transaction was rejected by the user.' : txError.message.substring(0, 100) + '...'}
                  </div>
                </div>
              )}
            </div>

            {/* DUAL BALANCE SUMMARY FOOTER CARD */}
            <div className="swap-card" style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(10, 12, 22, 0.4)', borderStyle: 'dashed' }}>
              <h3 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <TrendingUp size={14} /> Arc Wallet Balances
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Native Gas Balance (18 Dec):</span>
                  <span style={{ fontWeight: 600 }}>{nativeGasBalance} USDC</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>ERC-20 vUSDC Token (6 Dec):</span>
                  <span style={{ fontWeight: 600 }}>{erc20UsdcBalance} vUSDC</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>ARCG Token Balance:</span>
                  <span style={{ fontWeight: 600 }}>{arcgBalance} ARCG</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>LP Share Balance:</span>
                  <span style={{ fontWeight: 600 }}>{lpBalance} ARC-LP</span>
                </div>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
);
}

