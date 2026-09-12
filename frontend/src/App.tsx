import { useState, useEffect, useRef } from 'react';
import { 
  useAccount, 
  useReadContract, 
  useWriteContract, 
  useWaitForTransactionReceipt, 
  useSwitchChain, 
  useBalance 
} from 'wagmi';
import { parseUnits, formatUnits, decodeEventLog } from 'viem';
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
  Minus,
  WalletCards,
  Settings,
  ShieldCheck,
  Zap,
  Users,
  Gift,
  Mail,
  ArrowRight,
  ChevronDown,
  MessageCircle,
  Github
} from 'lucide-react';
import { CONTRACT_ADDRESSES } from './contracts/addresses';
import { ERC20_ABI, POOL_ABI, STAKING_ABI, ARC_TOKEN_PAIR_POOL_ABI } from './contracts/abis';
import { arcTestnet } from './chains/arcTestnet';
import { useQueryClient } from '@tanstack/react-query';
import { WalletConnectButton } from './WalletConnectButton';
import { waitForTransactionReceipt } from '@wagmi/core';
import { config } from './main'; 


const OFFICIAL_PAIR_CONFIG = {
  'usdc-eurc': {
    label: 'USDC / EURC',
    pool: CONTRACT_ADDRESSES.USDC_EURC_POOL,
    token0: CONTRACT_ADDRESSES.OFFICIAL_USDC,
    token0Symbol: 'USDC',
    token0Decimals: 6,
    token1: CONTRACT_ADDRESSES.EURC,
    token1Symbol: 'EURC',
    token1Decimals: 6,
  },
  'usdc-cirbtc': {
    label: 'USDC / cirBTC',
    pool: CONTRACT_ADDRESSES.
    CIRBTC_USDC_POOL, 
    token0: CONTRACT_ADDRESSES.OFFICIAL_USDC,
    token0Symbol: 'USDC',
    token0Decimals: 6,
    token1: CONTRACT_ADDRESSES.CIRBTC,
    token1Symbol: 'cirBTC',
    token1Decimals: 8,
  },
} as const;

type OfficialPairKey = keyof typeof OFFICIAL_PAIR_CONFIG;

const OFFICIAL_LP_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'event',
    name: 'LiquidityAdded',
    anonymous: false,
    inputs: [
      { name: 'provider', type: 'address', indexed: true },
      { name: 'amount0', type: 'uint256', indexed: false },
      { name: 'amount1', type: 'uint256', indexed: false },
      { name: 'liquidity', type: 'uint256', indexed: false },
    ],
  },
] as const;

// Direct state getters for the deployed ArcTokenPairPool.
const OFFICIAL_POOL_STATE_ABI = [
  { type: 'function', name: 'reserve0', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'reserve1', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'totalSupplyLP', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
] as const;

export default function App(): JSX.Element {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'home' | 'swap' | 'liquidity' | 'stake' | 'faucet' | 'contact'>('home');
  const [stakeTxHash, setStakeTxHash] = useState<string>('');

  useEffect(() => {
    if (!stakeTxHash) return;
    const timer = setTimeout(() => {
      setStakeTxHash('');
    }, 15000);
    return () => clearTimeout(timer);
  }, [stakeTxHash]); 

  const isWrongNetwork = isConnected && chainId !== arcTestnet.id;

  // Resolve the existing Mock USDC directly from the deployed legacy pool.
  // This prevents a malformed copied address from breaking the old faucet,
  // balance and staking flows.
  const { data: legacyUsdcAddressRaw } = useReadContract({
    address: CONTRACT_ADDRESSES.POOL,
    abi: POOL_ABI,
    functionName: 'usdc',
    query: { enabled: isConnected && !isWrongNetwork, refetchInterval: 30000 },
  });
  const LEGACY_USDC_ADDRESS = (legacyUsdcAddressRaw ?? CONTRACT_ADDRESSES.USDC) as `0x${string}`;

  // ----------------------------------------------------
  // BALANCES FETCHING
  // ----------------------------------------------------
  
  // 1. Native Gas USDC
  const { data: gasBalanceData, refetch: refetchGasBalance } = useBalance({
    address: address,
  });
  const nativeGasBalance = gasBalanceData ? parseFloat(gasBalanceData.formatted).toFixed(4) : "0.0000";

  // 2. ERC-20 USDC Token (6 decimals)
  const { data: erc20UsdcRaw, refetch: refetchErc20Usdc, isLoading: isUsdcLoading } = useReadContract({
    address: LEGACY_USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 30000,
    },
  });
  const erc20UsdcBalance = isUsdcLoading
    ? "Loading..."
    : erc20UsdcRaw ? parseFloat(formatUnits(erc20UsdcRaw, 6)).toFixed(2) : "0.00"; 

  // 3. Mock ARCG Token (18 decimals)
  const { data: arcgRaw, refetch: refetchArcg, isLoading: isArcgLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.ARCG,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 30000,
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
  // Keep the exact on-chain LP balance separately. The UI value above is rounded
  // for display only and must never be used to construct the removal amount.
  const lpBalanceRaw = lpRaw ?? 0n;

  // 5. Total LP Token Supply
  const { data: lpTotalSupplyRaw, refetch: refetchLpSupply } = useReadContract({
    address: CONTRACT_ADDRESSES.POOL,
    abi: POOL_ABI,
    functionName: 'totalSupply',
  });
  const lpTotalSupply = lpTotalSupplyRaw ? parseFloat(formatUnits(lpTotalSupplyRaw, 18)) : 0;

  // Staking Contract Data
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
      refetchInterval: 30000,
    } 
  });

  // Calculate Rewards
  const { data: earnedRewardsData, refetch: refetchRewards } = useReadContract({
    address: CONTRACT_ADDRESSES.STAKING as `0x${string}`,
    abi: STAKING_ABI,
    functionName: 'calculateReward',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      staleTime: 3000,
    }
  });

  const rawEarned = earnedRewardsData ? BigInt(earnedRewardsData as any) : 0n;
  const earnedRewardFormatted = parseFloat(formatUnits(rawEarned, 18)).toFixed(18);

  // Parse Staked Balance safely
  let rawStakedBalance = 0n;
  if (stakerData) {
    if (Array.isArray(stakerData)) {
      rawStakedBalance = stakerData[0] ?? 0n;
    } else if (typeof stakerData === 'object') {
      const data = stakerData as any;
      rawStakedBalance = data.stakedAmount ?? data.amount ?? data[0] ?? data._stakedAmount ?? 0n;
    } else {
      rawStakedBalance = BigInt(stakerData as any);
    }
  }

  const stakedBalanceFormatted = parseFloat(formatUnits(rawStakedBalance, 6));

  useEffect(() => {
    if (!address) return;
    const timer = setTimeout(() => {
      refetchStakedBalance();
      refetchRewards();
    }, 200); 
    return () => clearTimeout(timer);
  }, [address, refetchStakedBalance, refetchRewards]); 

  // ----------------------------------------------------
  // STAKING WRITE HOOKS & TRANSACTIONS
  // ----------------------------------------------------
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const { writeContractAsync } = useWriteContract();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: LEGACY_USDC_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESSES.STAKING as `0x${string}`] : undefined,
    query: { enabled: !!address },
  });

  const amountParsed = (() => {
    if (!stakeAmount || !Number.isFinite(Number(stakeAmount)) || Number(stakeAmount) <= 0) return 0n;
    try {
      return parseUnits(stakeAmount, 6);
    } catch {
      return 0n;
    }
  })();

  const needsApproval =
    !!address &&
    amountParsed > 0n &&
    (allowance === undefined || (allowance as bigint) < amountParsed); 

  const handleApproveAndStake = async () => {
    if (!stakeAmount || Number(stakeAmount) <= 0) return;
    setStakeTxHash('');
    setIsProcessing(true);

    try {
      if (needsApproval) {
        const approveHash = await writeContractAsync({
          address: LEGACY_USDC_ADDRESS as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.STAKING as `0x${string}`, amountParsed],
        });

        const approveReceipt = await waitForTransactionReceipt(config, { hash: approveHash });
        if (approveReceipt.status !== 'success') {
          throw new Error('Approve failed');
        }
      }

      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.STAKING as `0x${string}`,
        abi: STAKING_ABI,
        functionName: 'stake',
        args: [amountParsed],
      });

      setStakeTxHash(hash);

      const receipt = await waitForTransactionReceipt(config, { hash });
      if (receipt.status === 'success') {
        await queryClient.invalidateQueries();
        await Promise.all([
          refetchStakedBalance(),
          refetchRewards(),
          refetchAllowance(),
          refetchErc20Usdc()
        ]);
        setStakeAmount('');
      }
    } catch (err) {
      console.error('Approve & Stake Error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!stakeAmount || isNaN(parseFloat(stakeAmount)) || parseFloat(stakeAmount) <= 0) return;

    setIsUnstaking(true);
    try {
      const amountParsed = parseUnits(stakeAmount, 6);
      const tx = await writeContractAsync({
        address: CONTRACT_ADDRESSES.STAKING as `0x${string}`,
        abi: STAKING_ABI,
        functionName: 'unstake', 
        args: [amountParsed],
      });

      setStakeTxHash(tx);
      setStakeAmount('');
      refetchStakedBalance();
      await refreshAllBalances();
      queryClient.invalidateQueries();
    } catch (err) {
      console.error('Unstake Error:', err);
    } finally {
      setIsUnstaking(false);
    }
  }; 

  const handleClaim = async () => {
    try {
      const tx = await writeContractAsync({
        address: CONTRACT_ADDRESSES.STAKING as `0x${string}`,
        abi: STAKING_ABI,
        functionName: 'claimReward',
      });

      setStakeTxHash(tx); 
      if (refetchRewards) await refetchRewards(); 
      queryClient.invalidateQueries();
    } catch (err) {
      console.error('Claim Error:', err);
    }
  }; 

  // Reserves
  const { data: reservesData, refetch: refetchReserves, isLoading: isReservesLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.POOL,
    abi: POOL_ABI,
    functionName: 'getReserves',
    query: { refetchInterval: 30000 },
  });

  const reserveUsdc = reservesData ? reservesData[0] : 0n;
  const reserveArcg = reservesData ? reservesData[1] : 0n;

  const reserveUsdcFormatted = parseFloat(formatUnits(reserveUsdc, 6)).toFixed(2);
  const reserveArcgFormatted = parseFloat(formatUnits(reserveArcg, 18)).toFixed(2);

  const hasReservesLoaded = !isReservesLoading && reservesData !== undefined;
  const hasLiquidity = hasReservesLoaded && reserveUsdc > 0n && reserveArcg > 0n;

  const refreshAllBalances = async () => {
    try {
      await Promise.all([
        refetchGasBalance(),
        refetchErc20Usdc(),
        refetchArcg(),
        refetchLp(),
        refetchReserves(),
        refetchLpSupply(),
        refetchStakedBalance(),
        refetchRewards(),
        refetchOfficialUsdc(),
        refetchOfficialEurc(),
        refetchOfficialCirbtc(),
        refetchOfficialReserves(),
        refetchOfficialReserve0Direct(),
        refetchOfficialReserve1Direct(),
        refetchOfficialLp(),
        refetchOfficialLpTotal(),
        refetchOfficialLpDecimals()
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
  }, [address, isConnected]); 

  // WRITE TRANSACTIONS
  const { writeContract, data: txHash, error: txError, isPending: isTxPending, reset: resetTx } = useWriteContract();
  const activeTxHash = txHash;
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: activeTxHash });

  // Keep every transaction-success banner visible for exactly 15 seconds.
  // This only controls the banner visibility; transaction state and write logic
  // remain owned by wagmi and are not changed.
  const [showTxSuccess, setShowTxSuccess] = useState(false);

  useEffect(() => {
    if (!isTxSuccess || !txHash) {
      setShowTxSuccess(false);
      return;
    }

    setShowTxSuccess(true);
    const timer = setTimeout(() => {
      setShowTxSuccess(false);
    }, 15000);

    return () => clearTimeout(timer);
  }, [isTxSuccess, txHash]);

  useEffect(() => {
    resetTx();
  }, [activeTab]);

  // SWAP
  const [swapDirection, setSwapDirection] = useState<'usdc-to-arcg' | 'arcg-to-usdc'>('usdc-to-arcg');
  const [swapInput, setSwapInput] = useState<string>('');
  const [swapOutput, setSwapOutput] = useState<string>('0');
  const [priceImpact, setPriceImpact] = useState<string>('0.00');

  // Track which swap transaction is running so an approval success does not
  // clear the user's entered amount before the actual swap is completed.
  const [swapTxAction, setSwapTxAction] = useState<'approve' | 'swap' | ''>('');

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

      const amountInWithFee = amountIn * 997n;
      const numerator = amountInWithFee * rOut;
      const denominator = (rIn * 1000n) + amountInWithFee;
      const outAmount = numerator / denominator;

      const outputDecimals = isUsdc ? 18 : 6;
      setSwapOutput(formatUnits(outAmount, outputDecimals));

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

  const tokenInAddress = swapDirection === 'usdc-to-arcg' ? LEGACY_USDC_ADDRESS : CONTRACT_ADDRESSES.ARCG;
  const tokenInDecimals = swapDirection === 'usdc-to-arcg' ? 6 : 18;

  const { data: swapAllowanceRaw, refetch: refetchSwapAllowance } = useReadContract({
    address: tokenInAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESSES.POOL] : undefined,
  });

  // Always derive the transaction amount from the CURRENT visible input.
  // Do not prefer swapRawInput here because it can become stale when the user
  // edits the amount after pressing Max. A stale raw value can make the wallet
  // submit a different amount than the one shown in the input (e.g. UI shows
  // 99 while the transaction sends 199).
  const parsedSwapInput = (() => {
    if (!swapInput || isNaN(parseFloat(swapInput)) || parseFloat(swapInput) <= 0) return 0n;
    try {
      return parseUnits(swapInput, tokenInDecimals);
    } catch {
      return 0n;
    }
  })();

  // Use the exact current on-chain token balance for swap validation.
  // Never allow an approval transaction when the wallet cannot cover the
  // entered amount. The UI balance is formatted/rounded, so raw bigint data
  // is used for the actual comparison.
  const currentSwapBalanceRaw =
    swapDirection === 'usdc-to-arcg'
      ? erc20UsdcRaw
      : arcgRaw;

  const hasEnoughSwapBalance =
    currentSwapBalanceRaw !== undefined &&
    parsedSwapInput <= (currentSwapBalanceRaw as bigint);

  const needsSwapApproval =
    parsedSwapInput > 0n &&
    (swapAllowanceRaw === undefined || swapAllowanceRaw < parsedSwapInput);

  const handleApproveSwap = async () => {
    if (
      !tokenInAddress ||
      parsedSwapInput === 0n ||
      !hasEnoughSwapBalance
    ) return;
    setSwapTxAction('approve');
    resetTx();
    writeContract({
      address: tokenInAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACT_ADDRESSES.POOL, parsedSwapInput],
    });
  };

  const handleSwap = async () => {
    if (parsedSwapInput === 0n || !hasEnoughSwapBalance) return;
    setSwapTxAction('swap');
    resetTx();
    
    const expectedOutDecimals = swapDirection === 'usdc-to-arcg' ? 18 : 6;
    const expectedOutRaw = parseUnits(swapOutput, expectedOutDecimals);
    const minAmountOut = (expectedOutRaw * 995n) / 1000n;

    writeContract({
      address: CONTRACT_ADDRESSES.POOL,
      abi: POOL_ABI,
      functionName: 'swap',
      args: [tokenInAddress, parsedSwapInput, minAmountOut],
    });
  };

  // LIQUIDITY
  const [liqUsdcInput, setLiqUsdcInput] = useState<string>('');
  const [liqArcgInput, setLiqArcgInput] = useState<string>('');
  const [isRemovingLiquidity, setIsRemovingLiquidity] = useState<boolean>(false);
  const [removeLpAmount, setRemoveLpAmount] = useState<string>('');

  // Track which liquidity transaction is running so an approval success
  // does not clear the user's liquidity inputs before Add Liquidity.
  const [liquidityTxAction, setLiquidityTxAction] = useState<
    'approve-usdc' | 'approve-arcg' | 'add' | 'remove' | ''
  >('');

  const handleLiqUsdcChange = (value: string) => {
    setLiqUsdcInput(value);
    if (value === '' || isNaN(Number(value))) {
      setLiqArcgInput('');
      return;
    }
    if (reserveUsdc > 0n && reserveArcg > 0n) {
      try {
        const usdcIn = parseUnits(value, 6);
        const arcgOptimal = (usdcIn * reserveArcg) / reserveUsdc;
        setLiqArcgInput(formatUnits(arcgOptimal, 18));
      } catch {}
    }
  };

  const handleLiqArcgChange = (value: string) => {
    setLiqArcgInput(value);
    if (value === '' || isNaN(Number(value))) {
      setLiqUsdcInput('');
      return;
    }
    if (reserveUsdc > 0n && reserveArcg > 0n) {
      try {
        const arcgIn = parseUnits(value, 18);
        const usdcOptimal = (arcgIn * reserveUsdc) / reserveArcg;
        setLiqUsdcInput(formatUnits(usdcOptimal, 6));
      } catch {}
    }
  }; 

  const { data: liqUsdcAllowanceRaw, refetch: refetchLiqUsdcAllowance } = useReadContract({
    address: LEGACY_USDC_ADDRESS,
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

  // Parse liquidity amounts safely. Invalid/over-precision input should
  // never crash the component during render.
  const parsedLiqUsdc = (() => {
    if (!liqUsdcInput || isNaN(parseFloat(liqUsdcInput))) return 0n;
    try {
      return parseUnits(liqUsdcInput, 6);
    } catch {
      return 0n;
    }
  })();

  const parsedLiqArcg = (() => {
    if (!liqArcgInput || isNaN(parseFloat(liqArcgInput))) return 0n;
    try {
      return parseUnits(liqArcgInput, 18);
    } catch {
      return 0n;
    }
  })();

  const needsLiqUsdcApprove =
    parsedLiqUsdc > 0n &&
    (liqUsdcAllowanceRaw === undefined || liqUsdcAllowanceRaw < parsedLiqUsdc);

  const needsLiqArcgApprove =
    parsedLiqArcg > 0n &&
    (liqArcgAllowanceRaw === undefined || liqArcgAllowanceRaw < parsedLiqArcg);

  // Use raw token balances for validation. The displayed balances are rounded,
  // so comparing against the formatted strings can incorrectly disable/enable
  // the button at the exact wallet balance.
  const hasEnoughLiqUsdc =
    erc20UsdcRaw !== undefined && parsedLiqUsdc <= (erc20UsdcRaw as bigint);

  const hasEnoughLiqArcg =
    arcgRaw !== undefined && parsedLiqArcg <= (arcgRaw as bigint);

  // Add Liquidity is only allowed when BOTH token balances are available.
  // Keep this based on the exact raw on-chain balances so a zero ARCG
  // balance can never make the Add Liquidity action appear/callable.
  const canAddLiquidity =
    parsedLiqUsdc > 0n &&
    parsedLiqArcg > 0n &&
    hasEnoughLiqUsdc &&
    hasEnoughLiqArcg;

  const handleMaxLiqUsdc = () => {
    if (erc20UsdcRaw === undefined || arcgRaw === undefined) return;

    let usdcAmount = BigInt(erc20UsdcRaw as any);
    let arcgAmount = 0n;

    if (reserveUsdc > 0n && reserveArcg > 0n) {
      arcgAmount = (usdcAmount * reserveArcg) / reserveUsdc;

      // If the matching ARCG amount is larger than the wallet balance,
      // reduce the USDC side so the pair remains valid and spendable.
      if (arcgAmount > BigInt(arcgRaw as any)) {
        arcgAmount = BigInt(arcgRaw as any);
        usdcAmount = (arcgAmount * reserveUsdc) / reserveArcg;
      }
    } else {
      // For an empty/new pool there is no existing ratio to calculate.
      arcgAmount = BigInt(arcgRaw as any);
    }

    setLiqUsdcInput(formatUnits(usdcAmount, 6));
    setLiqArcgInput(formatUnits(arcgAmount, 18));
  };

  const handleMaxLiqArcg = () => {
    if (erc20UsdcRaw === undefined || arcgRaw === undefined) return;

    let arcgAmount = BigInt(arcgRaw as any);
    let usdcAmount = 0n;

    if (reserveUsdc > 0n && reserveArcg > 0n) {
      usdcAmount = (arcgAmount * reserveUsdc) / reserveArcg;

      // If the matching USDC amount is larger than the wallet balance,
      // reduce the ARCG side so the pair remains valid and spendable.
      if (usdcAmount > BigInt(erc20UsdcRaw as any)) {
        usdcAmount = BigInt(erc20UsdcRaw as any);
        arcgAmount = (usdcAmount * reserveArcg) / reserveUsdc;
      }
    } else {
      // For an empty/new pool there is no existing ratio to calculate.
      usdcAmount = BigInt(erc20UsdcRaw as any);
    }

    setLiqUsdcInput(formatUnits(usdcAmount, 6));
    setLiqArcgInput(formatUnits(arcgAmount, 18));
  };

  const calculateExpectedLp = () => {
    const usdc = parseFloat(liqUsdcInput);
    const arcg = parseFloat(liqArcgInput);

    if (!usdc || !arcg || usdc <= 0 || arcg <= 0) return "0.0000";

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

  const handleApproveLiqUsdc = async () => {
    if (parsedLiqUsdc === 0n || !hasEnoughLiqUsdc || !hasEnoughLiqArcg) return;
    setLiquidityTxAction('approve-usdc');
    resetTx();
    writeContract({
      address: LEGACY_USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACT_ADDRESSES.POOL, parsedLiqUsdc],
    });
  };

  const handleApproveLiqArcg = async () => {
    if (parsedLiqArcg === 0n || !hasEnoughLiqUsdc || !hasEnoughLiqArcg) return;
    setLiquidityTxAction('approve-arcg');
    resetTx();
    writeContract({
      address: CONTRACT_ADDRESSES.ARCG,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACT_ADDRESSES.POOL, parsedLiqArcg],
    });
  };

  const handleAddLiquidity = async () => {
    if (
      parsedLiqUsdc === 0n ||
      parsedLiqArcg === 0n ||
      !hasEnoughLiqUsdc ||
      !hasEnoughLiqArcg
    ) return;

    setLiquidityTxAction('add');
    resetTx();
    writeContract({
      address: CONTRACT_ADDRESSES.POOL,
      abi: POOL_ABI,
      functionName: 'addLiquidity',
      args: [parsedLiqUsdc, parsedLiqArcg],
    });
  };

  const handleRemoveLiquidity = async () => {
    if (!removeLpAmount || isNaN(parseFloat(removeLpAmount)) || parseFloat(removeLpAmount) <= 0) return;

    let parsedLpAmount: bigint;
    try {
      parsedLpAmount = parseUnits(removeLpAmount, 18);
    } catch {
      return;
    }

    // Never send more LP than the wallet actually owns. The displayed LP
    // balance is rounded, so using it directly can create a tiny over-balance
    // amount and make the transaction revert.
    if (lpBalanceRaw === 0n) return;

    // When the user enters the entire displayed balance manually, use one wei
    // less than the raw balance. This handles both rounded UI values and pool
    // implementations that reject an exact balance boundary. The difference
    // is 0.000000000000000001 LP and is invisible at the displayed precision.
    if (parsedLpAmount >= lpBalanceRaw) {
      parsedLpAmount = lpBalanceRaw > 1n ? lpBalanceRaw - 1n : lpBalanceRaw;
    }

    setLiquidityTxAction('remove');
    resetTx();
    writeContract({
      address: CONTRACT_ADDRESSES.POOL,
      abi: POOL_ABI,
      functionName: 'removeLiquidity',
      args: [parsedLpAmount],
    });
  };

  useEffect(() => {
    if (isTxSuccess) {
      refreshAllBalances();
      refetchStakedBalance();
      refetchRewards();
      refetchSwapAllowance();
      refetchLiqUsdcAllowance();
      refetchLiqArcgAllowance();

      setTimeout(() => {
        refreshAllBalances();
        refetchStakedBalance();
        refetchRewards();
      }, 800);

      setRemoveLpAmount('');

      // IMPORTANT: Keep the swap amount after approval succeeds.
      // Clear it only after the actual swap transaction succeeds.
      if (swapTxAction === 'swap') {
        setSwapInput('');
      }

      setStakeAmount('');

      // IMPORTANT: Approval transactions must keep both liquidity inputs.
      // The user still needs the amounts to submit Add Liquidity after the
      // approval confirmation. Only clear liquidity inputs after the actual
      // add/remove liquidity transaction succeeds.
      if (liquidityTxAction === 'add') {
        setLiqUsdcInput('');
        setLiqArcgInput('');
      } else if (liquidityTxAction === 'remove') {
        setRemoveLpAmount('');
      }

      setLiquidityTxAction('');
      setSwapTxAction('');
    }
  }, [isTxSuccess, liquidityTxAction, swapTxAction]); 


  // ============================================================
  // OFFICIAL ARC TOKEN PAIRS
  // ============================================================

  const [officialPair, setOfficialPair] = useState<OfficialPairKey>('usdc-eurc');
  const [officialSwapDirection, setOfficialSwapDirection] = useState<'0-to-1' | '1-to-0'>('0-to-1');
  const [officialSwapInput, setOfficialSwapInput] = useState('');
  const [officialSwapOutput, setOfficialSwapOutput] = useState('0');
  const [officialPriceImpact, setOfficialPriceImpact] = useState('0.00');
  const [officialLiqInput0, setOfficialLiqInput0] = useState('');
  const [officialLiqInput1, setOfficialLiqInput1] = useState('');
  const [officialRemoveLpAmount, setOfficialRemoveLpAmount] = useState('');
  const [isOfficialRemovingLiquidity, setIsOfficialRemovingLiquidity] = useState(false);
  const [officialSwapTxAction, setOfficialSwapTxAction] = useState<'approve' | 'swap' | ''>('');
  // A successful swap approval should immediately expose the Swap action even
  // before the allowance RPC read catches up.
  const [officialSwapApprovalSatisfied, setOfficialSwapApprovalSatisfied] = useState(false);
  const [officialSwapApprovedAmountRaw, setOfficialSwapApprovedAmountRaw] = useState<bigint>(0n);
  const officialSwapApprovalSubmittedAmountRef = useRef<bigint | null>(null);
  const [officialSwapMaxSelected, setOfficialSwapMaxSelected] = useState(false);
  const [officialLiquidityTxAction, setOfficialLiquidityTxAction] = useState<'approve-0' | 'approve-1' | 'add' | 'remove' | ''>('');
  // A successful approval receipt is authoritative for the next step even if
  // the allowance read has not propagated to the UI yet.
  const [officialApprovalSatisfied, setOfficialApprovalSatisfied] = useState<'0' | '1' | 'both' | ''>('');
  const [officialLiqMax0Selected, setOfficialLiqMax0Selected] = useState(false);
  const [officialLiqMax1Selected, setOfficialLiqMax1Selected] = useState(false);
  const [officialMaxRaw0, setOfficialMaxRaw0] = useState<bigint | null>(null);
  const [officialMaxRaw1, setOfficialMaxRaw1] = useState<bigint | null>(null);
  // Live BTC/USD market price used only when the official USDC/cirBTC pool
  // has no reserves yet. Once the pool has reserves, the AMM reserve ratio
  // remains the source of truth for liquidity/swap pricing.
  const [liveBtcUsdPrice, setLiveBtcUsdPrice] = useState<number | null>(null);
  // Temporary post-transaction balance adjustments. These are only used until
  // the corresponding ERC-20 balance read catches up with the confirmed block.
  // This is especially useful for the official cirBTC pool where the balance
  // RPC can lag behind the successful add-liquidity receipt.
  const [officialBalanceAdjustments, setOfficialBalanceAdjustments] = useState<Record<string, bigint>>({});
  const officialRemoveBalanceBeforeRef = useRef<Record<string, bigint | undefined>>({});
  const officialRemoveExpectedBalanceRef = useRef<Record<string, bigint | undefined>>({});
  const officialSwapBalanceBeforeRef = useRef<Record<string, bigint | undefined>>({});
  const officialSwapSpentExpectedBalanceRef = useRef<Record<string, bigint | undefined>>({});
  const officialSwapReceivedExpectedBalanceRef = useRef<Record<string, bigint | undefined>>({});

  const officialConfig = OFFICIAL_PAIR_CONFIG[officialPair];
  const officialSwapTokenIn = officialSwapDirection === '0-to-1' ? officialConfig.token0 : officialConfig.token1;
  const officialSwapTokenOut = officialSwapDirection === '0-to-1' ? officialConfig.token1 : officialConfig.token0;
  const officialSwapTokenInDecimals = officialSwapDirection === '0-to-1' ? officialConfig.token0Decimals : officialConfig.token1Decimals;
  const officialSwapTokenOutDecimals = officialSwapDirection === '0-to-1' ? officialConfig.token1Decimals : officialConfig.token0Decimals;
  const officialSwapTokenInSymbol = officialSwapDirection === '0-to-1' ? officialConfig.token0Symbol : officialConfig.token1Symbol;
  const officialSwapTokenOutSymbol = officialSwapDirection === '0-to-1' ? officialConfig.token1Symbol : officialConfig.token0Symbol;

  // Select a token directly from the From/To token button. Official pools are
  // direct USDC pairs, so selecting EURC/cirBTC automatically selects
  // the matching USDC pair.
  const handleOfficialTokenPick = (side: 'from' | 'to', symbol: string) => {
    const pairBySymbol: Record<string, OfficialPairKey> = {
      EURC: 'usdc-eurc',
      cirBTC: 'usdc-cirbtc',
    };

    if (symbol === 'USDC') {
      setOfficialSwapDirection(side === 'from' ? '0-to-1' : '1-to-0');
    } else {
      const nextPair = pairBySymbol[symbol];
      if (!nextPair) return;
      setOfficialPair(nextPair);
      setOfficialSwapDirection(side === 'from' ? '1-to-0' : '0-to-1');
    }

    setOfficialSwapApprovalSatisfied(false);
    setOfficialSwapApprovedAmountRaw(0n);
    officialSwapApprovalSubmittedAmountRef.current = null;
    setOfficialSwapMaxSelected(false);
    setOfficialSwapInput('');
    setOfficialSwapOutput('0');
    setOfficialPriceImpact('0.00');
  };

  useEffect(() => {
    let cancelled = false;

    const loadBtcUsdPrice = async () => {
      try {
        const response = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot', {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('BTC price request failed');
        const json = await response.json();
        const price = Number(json?.data?.amount);
        if (!cancelled && Number.isFinite(price) && price > 0) {
          setLiveBtcUsdPrice(price);
        }
      } catch {
        // Keep the last good price. If there is none, an empty USDC/cirBTC
        // pool will not fabricate a ratio.
      }
    };

    loadBtcUsdPrice();
    const timer = setInterval(loadBtcUsdPrice, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const { data: officialUsdcRaw, refetch: refetchOfficialUsdc } = useReadContract({
    address: CONTRACT_ADDRESSES.OFFICIAL_USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 30000, staleTime: 0, refetchOnWindowFocus: false },
  });

  const { data: officialEurcRaw, refetch: refetchOfficialEurc } = useReadContract({
    address: CONTRACT_ADDRESSES.EURC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 30000, staleTime: 0, refetchOnWindowFocus: false },
  });

  const { data: officialCirbtcRaw, refetch: refetchOfficialCirbtc } = useReadContract({
    address: CONTRACT_ADDRESSES.CIRBTC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 30000, staleTime: 0, refetchOnWindowFocus: false },
  });

  const officialBalanceFor = (token: `0x${string}`, decimals: number) => {
    const raw = token.toLowerCase() === CONTRACT_ADDRESSES.OFFICIAL_USDC.toLowerCase()
      ? officialUsdcRaw
      : token.toLowerCase() === CONTRACT_ADDRESSES.EURC.toLowerCase()
      ? officialEurcRaw
      : officialCirbtcRaw;
    if (raw === undefined) return '0.00';
    const adjustment = officialBalanceAdjustments[token.toLowerCase()] ?? 0n;
    const adjustedRaw = raw > adjustment ? raw - adjustment : 0n;
    return parseFloat(formatUnits(adjustedRaw, decimals)).toFixed(decimals === 8 ? 8 : 2);
  };

  const getAdjustedOfficialBalanceRaw = (token: `0x${string}`, raw: bigint | undefined) => {
    if (raw === undefined) return undefined;
    const adjustment = officialBalanceAdjustments[token.toLowerCase()] ?? 0n;
    return raw > adjustment ? raw - adjustment : 0n;
  };

  const officialSwapBalanceRaw = officialSwapTokenIn.toLowerCase() === CONTRACT_ADDRESSES.OFFICIAL_USDC.toLowerCase()
    ? getAdjustedOfficialBalanceRaw(CONTRACT_ADDRESSES.OFFICIAL_USDC, officialUsdcRaw as bigint | undefined)
    : officialSwapTokenIn.toLowerCase() === CONTRACT_ADDRESSES.EURC.toLowerCase()
    ? getAdjustedOfficialBalanceRaw(CONTRACT_ADDRESSES.EURC, officialEurcRaw as bigint | undefined)
    : getAdjustedOfficialBalanceRaw(CONTRACT_ADDRESSES.CIRBTC, officialCirbtcRaw as bigint | undefined);

  const officialSwapOutputBalanceRaw = officialSwapTokenOut.toLowerCase() === CONTRACT_ADDRESSES.OFFICIAL_USDC.toLowerCase()
    ? getAdjustedOfficialBalanceRaw(CONTRACT_ADDRESSES.OFFICIAL_USDC, officialUsdcRaw as bigint | undefined)
    : officialSwapTokenOut.toLowerCase() === CONTRACT_ADDRESSES.EURC.toLowerCase()
    ? getAdjustedOfficialBalanceRaw(CONTRACT_ADDRESSES.EURC, officialEurcRaw as bigint | undefined)
    : getAdjustedOfficialBalanceRaw(CONTRACT_ADDRESSES.CIRBTC, officialCirbtcRaw as bigint | undefined);

  const { data: officialReservesData, refetch: refetchOfficialReserves, isLoading: isOfficialReservesLoading } = useReadContract({
    address: officialConfig.pool,
    abi: ARC_TOKEN_PAIR_POOL_ABI,
    functionName: 'getReserves',
    query: { refetchInterval: 30000, staleTime: 0, refetchOnWindowFocus: false },
  });

  // Direct public-state reads are a second path for the same deployed pool.
  const { data: officialReserve0Direct, refetch: refetchOfficialReserve0Direct } = useReadContract({
    address: officialConfig.pool,
    abi: OFFICIAL_POOL_STATE_ABI,
    functionName: 'reserve0',
    query: { refetchInterval: 30000, staleTime: 0, refetchOnWindowFocus: false },
  });
  const { data: officialReserve1Direct, refetch: refetchOfficialReserve1Direct } = useReadContract({
    address: officialConfig.pool,
    abi: OFFICIAL_POOL_STATE_ABI,
    functionName: 'reserve1',
    query: { refetchInterval: 30000, staleTime: 0, refetchOnWindowFocus: false },
  });

  const officialReserve0FromGetReserves = officialReservesData ? officialReservesData[0] : 0n;
  const officialReserve1FromGetReserves = officialReservesData ? officialReservesData[1] : 0n;
  const officialReserve0 = officialReserve0FromGetReserves > 0n
    ? officialReserve0FromGetReserves
    : (officialReserve0Direct ?? 0n) > 0n
    ? (officialReserve0Direct as bigint)
    : 0n;
  const officialReserve1 = officialReserve1FromGetReserves > 0n
    ? officialReserve1FromGetReserves
    : (officialReserve1Direct ?? 0n) > 0n
    ? (officialReserve1Direct as bigint)
    : 0n;
  const officialReserveIn = officialSwapDirection === '0-to-1' ? officialReserve0 : officialReserve1;
  const officialReserveOut = officialSwapDirection === '0-to-1' ? officialReserve1 : officialReserve0;
  const officialHasLiquidity = officialReserve0 > 0n && officialReserve1 > 0n;

  const { data: officialLpRaw, refetch: refetchOfficialLp } = useReadContract({
    address: officialConfig.pool,
    abi: OFFICIAL_LP_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 30000, staleTime: 0, refetchOnWindowFocus: false },
  });

  const { data: officialLpTotalRaw, refetch: refetchOfficialLpTotal } = useReadContract({
    address: officialConfig.pool,
    abi: OFFICIAL_LP_ABI,
    functionName: 'totalSupply',
    query: { refetchInterval: 30000, staleTime: 0, refetchOnWindowFocus: false },
  });

  // Read the deployed pool's LP-token decimals instead of assuming 18.
  const { data: officialLpDecimalsRaw, refetch: refetchOfficialLpDecimals } = useReadContract({
    address: officialConfig.pool,
    abi: OFFICIAL_LP_ABI,
    functionName: 'decimals',
    query: { enabled: !!officialConfig.pool, staleTime: 300000 },
  });

  const officialLpDecimals = officialLpDecimalsRaw !== undefined
    ? Number(officialLpDecimalsRaw)
    : 18;

  // LP balance is always the deployed pool's real ERC-20 balance.
  // Never manufacture an LP position from a receipt or submitted amounts.
  const officialLpBalanceRaw = officialLpRaw ?? 0n;

  // LP amounts can be extremely small for a fresh USDC/cirBTC position
  // because cirBTC uses 8 decimals and the LP token uses its own decimals.
  // Do not convert the LP value through Number()/parseFloat(): that can make
  // a real non-zero LP balance display as 0.0000 and make Remove look empty.
  const formatOfficialLpDisplay = (raw: bigint) => {
    if (raw <= 0n) return '0.0000';
    const exact = formatUnits(raw, officialLpDecimals);
    const numeric = Number(exact);
    if (Number.isFinite(numeric) && numeric >= 0.0001) return numeric.toFixed(4);
    // Preserve tiny but real LP balances instead of rounding them to zero.
    return exact.replace(/\.?0+$/, '');
  };

  const officialLpBalance = formatOfficialLpDisplay(officialLpBalanceRaw);
  const officialLpTotalSupplyRaw = officialLpTotalRaw ?? 0n;
  const officialLpTotalSupply = Number(formatUnits(officialLpTotalSupplyRaw, officialLpDecimals));
  const officialLpTotalSupplyDisplay = formatOfficialLpDisplay(officialLpTotalSupplyRaw);

  const officialSwapParsedInput = (() => {
    if (!officialSwapInput || !Number.isFinite(Number(officialSwapInput)) || Number(officialSwapInput) <= 0) return 0n;
    try { return parseUnits(officialSwapInput, officialSwapTokenInDecimals); } catch { return 0n; }
  })();

  // MAX may display the rounded wallet amount (for example 10.00 when the
  // exact ERC-20 balance is 9.999998). The transaction always uses the exact
  // on-chain balance, while manually typed values still obey the real balance.
  // When MAX is selected, always use the exact wallet balance for the
  // transaction. The displayed value may be rounded for readability.
  const officialSwapEffectiveInput = officialSwapMaxSelected && officialSwapBalanceRaw !== undefined
    ? (officialSwapBalanceRaw as bigint)
    : officialSwapParsedInput;

  useEffect(() => {
    if (!officialSwapInput || officialSwapEffectiveInput <= 0n || !officialHasLiquidity) {
      setOfficialSwapOutput(officialSwapInput && officialSwapParsedInput > 0n ? 'Pool Empty' : '0');
      setOfficialPriceImpact(officialHasLiquidity ? '0.00' : '100.00');
      return;
    }
    try {
      const amountInWithFee = officialSwapEffectiveInput * 997n;
      const numerator = amountInWithFee * officialReserveOut;
      const denominator = officialReserveIn * 1000n + amountInWithFee;
      const out = denominator > 0n ? numerator / denominator : 0n;
      setOfficialSwapOutput(formatUnits(out, officialSwapTokenOutDecimals));

      const reserveInFloat = parseFloat(formatUnits(officialReserveIn, officialSwapTokenInDecimals));
      const reserveOutFloat = parseFloat(formatUnits(officialReserveOut, officialSwapTokenOutDecimals));
      const inputFloat = parseFloat(formatUnits(officialSwapEffectiveInput, officialSwapTokenInDecimals));
      const outputFloat = parseFloat(formatUnits(out, officialSwapTokenOutDecimals));
      if (reserveInFloat > 0 && reserveOutFloat > 0 && inputFloat > 0) {
        const idealPrice = reserveOutFloat / reserveInFloat;
        const realPrice = outputFloat / inputFloat;
        setOfficialPriceImpact(Math.max(0, ((idealPrice - realPrice) / idealPrice) * 100).toFixed(2));
      }
    } catch {
      setOfficialSwapOutput('0');
      setOfficialPriceImpact('0.00');
    }
  }, [officialSwapInput, officialSwapEffectiveInput, officialHasLiquidity, officialReserveIn, officialReserveOut, officialSwapTokenInDecimals, officialSwapTokenOutDecimals]);

  const { data: officialSwapAllowanceRaw, refetch: refetchOfficialSwapAllowance } = useReadContract({
    address: officialSwapTokenIn,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, officialConfig.pool] : undefined,
    query: { enabled: !!address, refetchInterval: 30000, staleTime: 0, refetchOnWindowFocus: false },
  });

  const officialHasEnoughSwapBalance = officialSwapBalanceRaw !== undefined && (officialSwapMaxSelected ? officialSwapEffectiveInput > 0n : officialSwapParsedInput <= (officialSwapBalanceRaw as bigint));
  // The Swap action becomes available only after the approval transaction
  // itself has a confirmed successful receipt, or an already-existing on-chain
  // allowance is sufficient. Do not unlock Swap merely because the approval
  // transaction was submitted/pending.
  const officialApprovalConfirmedForCurrentInput =
    officialSwapApprovalSatisfied &&
    officialSwapApprovedAmountRaw >= officialSwapEffectiveInput;
  const officialOnChainAllowanceConfirmed =
    officialSwapAllowanceRaw !== undefined &&
    officialSwapAllowanceRaw >= officialSwapEffectiveInput;
  const officialSwapReady =
    officialSwapEffectiveInput > 0n &&
    (officialApprovalConfirmedForCurrentInput || officialOnChainAllowanceConfirmed);
  const officialNeedsSwapApproval =
    officialSwapEffectiveInput > 0n &&
    !officialSwapReady;

  const handleOfficialApproveSwap = () => {
    if (officialSwapEffectiveInput <= 0n || !officialHasEnoughSwapBalance) return;
    // Keep Swap locked until this approval gets a successful on-chain receipt.
    setOfficialSwapApprovalSatisfied(false);
    setOfficialSwapApprovedAmountRaw(0n);
    officialSwapApprovalSubmittedAmountRef.current = officialSwapEffectiveInput;
    setOfficialSwapTxAction('approve');
    resetTx();
    writeContract({
      address: officialSwapTokenIn,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [officialConfig.pool, officialSwapEffectiveInput],
    });
  };

  const handleOfficialSwap = () => {
    if (officialSwapEffectiveInput <= 0n || !officialHasEnoughSwapBalance || !officialHasLiquidity) return;
    const outputRaw = parseUnits(officialSwapOutput, officialSwapTokenOutDecimals);
    const minAmountOut = (outputRaw * 995n) / 1000n;
    officialSwapBalanceBeforeRef.current = {
      [officialSwapTokenIn.toLowerCase()]: officialSwapBalanceRaw,
      [officialSwapTokenOut.toLowerCase()]: officialSwapOutputBalanceRaw,
    };
    delete officialSwapSpentExpectedBalanceRef.current[officialSwapTokenIn.toLowerCase()];
    delete officialSwapReceivedExpectedBalanceRef.current[officialSwapTokenOut.toLowerCase()];
    setOfficialSwapTxAction('swap');
    resetTx();
    writeContract({
      address: officialConfig.pool,
      abi: ARC_TOKEN_PAIR_POOL_ABI,
      functionName: 'swap',
      args: [officialSwapTokenIn, officialSwapEffectiveInput, minAmountOut],
    });
  };

  const officialLiqParsed0 = (() => {
    if (!officialLiqInput0 || !Number.isFinite(Number(officialLiqInput0)) || Number(officialLiqInput0) <= 0) return 0n;
    try { return parseUnits(officialLiqInput0, officialConfig.token0Decimals); } catch { return 0n; }
  })();

  const officialLiqParsed1 = (() => {
    if (!officialLiqInput1 || !Number.isFinite(Number(officialLiqInput1)) || Number(officialLiqInput1) <= 0) return 0n;
    try { return parseUnits(officialLiqInput1, officialConfig.token1Decimals); } catch { return 0n; }
  })();

  const officialBalance0Raw = officialConfig.token0.toLowerCase() === CONTRACT_ADDRESSES.OFFICIAL_USDC.toLowerCase()
    ? getAdjustedOfficialBalanceRaw(CONTRACT_ADDRESSES.OFFICIAL_USDC, officialUsdcRaw as bigint | undefined)
    : officialConfig.token0.toLowerCase() === CONTRACT_ADDRESSES.EURC.toLowerCase()
    ? getAdjustedOfficialBalanceRaw(CONTRACT_ADDRESSES.EURC, officialEurcRaw as bigint | undefined)
    : getAdjustedOfficialBalanceRaw(CONTRACT_ADDRESSES.CIRBTC, officialCirbtcRaw as bigint | undefined);
  const officialBalance1Raw = officialConfig.token1.toLowerCase() === CONTRACT_ADDRESSES.OFFICIAL_USDC.toLowerCase()
    ? getAdjustedOfficialBalanceRaw(CONTRACT_ADDRESSES.OFFICIAL_USDC, officialUsdcRaw as bigint | undefined)
    : officialConfig.token1.toLowerCase() === CONTRACT_ADDRESSES.EURC.toLowerCase()
    ? getAdjustedOfficialBalanceRaw(CONTRACT_ADDRESSES.EURC, officialEurcRaw as bigint | undefined)
    : getAdjustedOfficialBalanceRaw(CONTRACT_ADDRESSES.CIRBTC, officialCirbtcRaw as bigint | undefined);

  const { data: officialLiqAllowance0, refetch: refetchOfficialLiqAllowance0 } = useReadContract({
    address: officialConfig.token0,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, officialConfig.pool] : undefined,
    query: { enabled: !!address, refetchInterval: 30000, staleTime: 0, refetchOnWindowFocus: false },
  });

  const { data: officialLiqAllowance1, refetch: refetchOfficialLiqAllowance1 } = useReadContract({
    address: officialConfig.token1,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, officialConfig.pool] : undefined,
    query: { enabled: !!address, refetchInterval: 30000, staleTime: 0, refetchOnWindowFocus: false },
  });

  // Only allow a tiny base-unit boundary difference caused by the wallet's
  // displayed/rounded balance. Never apply a percentage haircut.
  const OFFICIAL_LIQ_TOLERANCE_UNITS = 2n;

  const hasOfficialLiqBalance = (amount: bigint, balance: bigint | undefined) => {
    if (balance === undefined) return false;
    if (amount <= balance) return true;
    return amount - balance <= OFFICIAL_LIQ_TOLERANCE_UNITS;
  };

  const officialSafeLiqAmount0 = officialBalance0Raw !== undefined && officialLiqParsed0 > (officialBalance0Raw as bigint)
    && officialLiqParsed0 - (officialBalance0Raw as bigint) <= OFFICIAL_LIQ_TOLERANCE_UNITS
    ? (officialBalance0Raw as bigint)
    : officialLiqParsed0;
  const officialSafeLiqAmount1 = officialBalance1Raw !== undefined && officialLiqParsed1 > (officialBalance1Raw as bigint)
    && officialLiqParsed1 - (officialBalance1Raw as bigint) <= OFFICIAL_LIQ_TOLERANCE_UNITS
    ? (officialBalance1Raw as bigint)
    : officialLiqParsed1;

  const officialHasEnoughLiq0 = officialLiqMax0Selected && officialMaxRaw0 !== null
    ? officialMaxRaw0 > 0n
    : hasOfficialLiqBalance(officialLiqParsed0, officialBalance0Raw as bigint | undefined);
  const officialHasEnoughLiq1 = officialLiqMax1Selected && officialMaxRaw1 !== null
    ? officialMaxRaw1 > 0n
    : hasOfficialLiqBalance(officialLiqParsed1, officialBalance1Raw as bigint | undefined);

  const officialEffectiveLiqAmount0 = officialLiqMax0Selected && officialMaxRaw0 !== null ? officialMaxRaw0 : officialSafeLiqAmount0;
  const officialEffectiveLiqAmount1 = officialLiqMax1Selected && officialMaxRaw1 !== null ? officialMaxRaw1 : officialSafeLiqAmount1;

  const officialNeedsLiqApprove0 =
    officialLiqParsed0 > 0n &&
    !officialApprovalSatisfied.includes('0') &&
    (officialLiqAllowance0 === undefined || officialLiqAllowance0 < officialEffectiveLiqAmount0);

  const officialNeedsLiqApprove1 =
    officialLiqParsed1 > 0n &&
    !officialApprovalSatisfied.includes('1') &&
    (officialLiqAllowance1 === undefined || officialLiqAllowance1 < officialEffectiveLiqAmount1);

  const officialCanAddLiquidity = officialLiqParsed0 > 0n && officialLiqParsed1 > 0n && officialHasEnoughLiq0 && officialHasEnoughLiq1;


  const calculateEmptyOfficialLiqAmount1FromUsdc = (amount0: bigint) => {
    if (officialPair === 'usdc-eurc') return amount0;
    if (liveBtcUsdPrice === null || !Number.isFinite(liveBtcUsdPrice) || liveBtcUsdPrice <= 0) return null;
    // USDC has 6 decimals and cirBTC has 8 decimals. Convert the live BTC/USD
    // price into exact base units without using the old hardcoded 1:10,000 ratio.
    const priceUsdScaled = BigInt(Math.round(liveBtcUsdPrice * 100000000));
    if (priceUsdScaled <= 0n) return null;
    return amount0 * 10000000000n / priceUsdScaled;
  };

  const calculateEmptyOfficialLiqAmount0FromCirbtc = (amount1: bigint) => {
    if (officialPair === 'usdc-eurc') return amount1;
    if (liveBtcUsdPrice === null || !Number.isFinite(liveBtcUsdPrice) || liveBtcUsdPrice <= 0) return null;
    const priceUsdScaled = BigInt(Math.round(liveBtcUsdPrice * 100000000));
    if (priceUsdScaled <= 0n) return null;
    return amount1 * priceUsdScaled / 10000000000n;
  };

  const handleOfficialLiq0Change = (value: string) => {
    setOfficialApprovalSatisfied('');
    setOfficialLiqMax0Selected(false);
    setOfficialLiqMax1Selected(false);
    setOfficialMaxRaw0(null);
    setOfficialMaxRaw1(null);
    setOfficialLiqInput0(value);

    // When the user clears the first amount, clear the calculated
    // second amount too. Otherwise the old calculated value remains visible.
    if (!value || !Number.isFinite(Number(value))) {
      setOfficialLiqInput1('');
      return;
    }

    try {
      const amount0 = parseUnits(value, officialConfig.token0Decimals);
      let amount1: bigint | null;
      if (officialReserve0 > 0n && officialReserve1 > 0n) {
        amount1 = amount0 * (officialReserve1 as bigint) / (officialReserve0 as bigint);
      } else {
        amount1 = calculateEmptyOfficialLiqAmount1FromUsdc(amount0);
      }
      if (amount1 === null) {
        setOfficialLiqInput1('');
        return;
      }
      setOfficialLiqInput1(formatUnits(amount1, officialConfig.token1Decimals));
    } catch {
      setOfficialLiqInput1('');
    }
  };

  const handleOfficialLiq1Change = (value: string) => {
    setOfficialApprovalSatisfied('');
    setOfficialLiqMax0Selected(false);
    setOfficialLiqMax1Selected(false);
    setOfficialMaxRaw0(null);
    setOfficialMaxRaw1(null);
    setOfficialLiqInput1(value);

    // Same behavior in the opposite direction: clearing the second
    // amount must also clear the first calculated amount.
    if (!value || !Number.isFinite(Number(value))) {
      setOfficialLiqInput0('');
      return;
    }

    try {
      const amount1 = parseUnits(value, officialConfig.token1Decimals);
      let amount0: bigint | null;
      if (officialReserve0 > 0n && officialReserve1 > 0n) {
        amount0 = amount1 * (officialReserve0 as bigint) / (officialReserve1 as bigint);
      } else {
        amount0 = calculateEmptyOfficialLiqAmount0FromCirbtc(amount1);
      }
      if (amount0 === null) {
        setOfficialLiqInput0('');
        return;
      }
      setOfficialLiqInput0(formatUnits(amount0, officialConfig.token0Decimals));
    } catch {
      setOfficialLiqInput0('');
    }
  };

  const calculateOfficialMaxAmounts = () => {
    if (officialBalance0Raw === undefined || officialBalance1Raw === undefined) return null;

    const balance0 = officialBalance0Raw as bigint;
    const balance1 = officialBalance1Raw as bigint;

    if (officialReserve0 > 0n && officialReserve1 > 0n) {
      let amount0 = balance0;
      let amount1 = amount0 * officialReserve1 / officialReserve0;
      if (amount1 > balance1) {
        amount1 = balance1;
        amount0 = amount1 * officialReserve0 / officialReserve1;
      }
      return { amount0, amount1 };
    }

    // An empty pool has no AMM price. For USDC/cirBTC, use the live BTC/USD
    // market price so the first liquidity position is initialized at market
    // value. For USDC/EURC, keep the existing 1:1 stablecoin initialization.
    let amount0 = balance0;
    let amount1 = calculateEmptyOfficialLiqAmount1FromUsdc(amount0);
    if (amount1 === null) return null;
    if (amount1 > balance1) {
      amount1 = balance1;
      const recalculatedAmount0 = officialPair === 'usdc-cirbtc'
        ? calculateEmptyOfficialLiqAmount0FromCirbtc(amount1)
        : amount1;
      if (recalculatedAmount0 === null) return null;
      amount0 = recalculatedAmount0;
    }
    return { amount0, amount1 };
  };

  const formatOfficialLiqMaxDisplay = (amount: bigint, symbol: string, decimals: number) => {
    const value = Number(formatUnits(amount, decimals));
    // MAX must never visually exceed the actual wallet balance. EURC is a
    // 6-decimal token, so floor its 2-decimal display instead of rounding up
    // (e.g. 9.984998 must remain 9.98, not 9.99). The stored raw MAX amount
    // remains exact and is what the transaction uses on-chain.
    return symbol === 'EURC'
      ? (Math.floor((value + Number.EPSILON) * 100) / 100).toFixed(2)
      : value.toFixed(decimals === 8 ? 8 : 2);
  };

  const handleMaxOfficialLiq0 = () => {
    const amounts = calculateOfficialMaxAmounts();
    if (!amounts) return;
    setOfficialApprovalSatisfied('');
    setOfficialLiqMax0Selected(true);
    setOfficialLiqMax1Selected(true);
    setOfficialMaxRaw0(amounts.amount0);
    setOfficialMaxRaw1(amounts.amount1);
    setOfficialLiqInput0(formatOfficialLiqMaxDisplay(amounts.amount0, officialConfig.token0Symbol, officialConfig.token0Decimals));
    setOfficialLiqInput1(formatOfficialLiqMaxDisplay(amounts.amount1, officialConfig.token1Symbol, officialConfig.token1Decimals));
  };

  const handleMaxOfficialLiq1 = () => {
    const amounts = calculateOfficialMaxAmounts();
    if (!amounts) return;
    setOfficialApprovalSatisfied('');
    setOfficialLiqMax0Selected(true);
    setOfficialLiqMax1Selected(true);
    setOfficialMaxRaw0(amounts.amount0);
    setOfficialMaxRaw1(amounts.amount1);
    setOfficialLiqInput0(formatOfficialLiqMaxDisplay(amounts.amount0, officialConfig.token0Symbol, officialConfig.token0Decimals));
    setOfficialLiqInput1(formatOfficialLiqMaxDisplay(amounts.amount1, officialConfig.token1Symbol, officialConfig.token1Decimals));
  };

  const handleOfficialApproveLiq0 = () => {
    if (!officialCanAddLiquidity) return;
    setOfficialLiquidityTxAction('approve-0');
    resetTx();
    writeContract({
      address: officialConfig.token0,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [officialConfig.pool, officialEffectiveLiqAmount0],
      ...(officialPair === 'usdc-cirbtc' ? { gas: 100_000n } : {}),
    });
  };

  const handleOfficialApproveLiq1 = () => {
    if (!officialCanAddLiquidity) return;
    setOfficialLiquidityTxAction('approve-1');
    resetTx();
    writeContract({
      address: officialConfig.token1,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [officialConfig.pool, officialEffectiveLiqAmount1],
      ...(officialPair === 'usdc-cirbtc' ? { gas: 100_000n } : {}),
    });
  };

  const handleOfficialAddLiquidity = () => {
    if (!officialCanAddLiquidity) return;
    setOfficialLiquidityTxAction('add');
    resetTx();
    writeContract({
      address: officialConfig.pool,
      abi: ARC_TOKEN_PAIR_POOL_ABI,
      functionName: 'addLiquidity',
      args: [officialEffectiveLiqAmount0, officialEffectiveLiqAmount1],
      ...(officialPair === 'usdc-cirbtc' ? { gas: 3_000_000n } : {}),
    });
  };

  const officialRemoveParsed = (() => {
    if (!officialRemoveLpAmount || !Number.isFinite(Number(officialRemoveLpAmount)) || Number(officialRemoveLpAmount) <= 0) return 0n;
    try { return parseUnits(officialRemoveLpAmount, officialLpDecimals); } catch { return 0n; }
  })();

  const handleOfficialRemoveLiquidity = () => {
    if (officialRemoveParsed <= 0n || officialLpBalanceRaw <= 0n) return;
    const amount = officialRemoveParsed;
    officialRemoveBalanceBeforeRef.current = {
      [officialConfig.token0.toLowerCase()]: officialBalance0Raw,
      [officialConfig.token1.toLowerCase()]: officialBalance1Raw,
    };
    setOfficialLiquidityTxAction('remove');
    resetTx();
    writeContract({
      address: officialConfig.pool,
      abi: ARC_TOKEN_PAIR_POOL_ABI,
      functionName: 'removeLiquidity',
      args: [amount],
      ...(officialPair === 'usdc-cirbtc' ? { gas: 1_000_000n } : {}),
    });
  };

  // Drop temporary balance adjustments as soon as the fresh ERC-20 read
  // reaches the exact post-transaction balance (or lower).
  useEffect(() => {
    setOfficialBalanceAdjustments(prev => {
      if (Object.keys(prev).length === 0) return prev;
      const next = { ...prev };
      const rawByToken: Record<string, bigint | undefined> = {
        [CONTRACT_ADDRESSES.OFFICIAL_USDC.toLowerCase()]: officialUsdcRaw as bigint | undefined,
        [CONTRACT_ADDRESSES.EURC.toLowerCase()]: officialEurcRaw as bigint | undefined,
        [CONTRACT_ADDRESSES.CIRBTC.toLowerCase()]: officialCirbtcRaw as bigint | undefined,
      };
      let changed = false;
      for (const [token] of Object.entries(prev)) {
        const raw = rawByToken[token];
        const adjustment = prev[token] ?? 0n;
        const removeExpected = officialRemoveExpectedBalanceRef.current[token];
        const swapSpentExpected = officialSwapSpentExpectedBalanceRef.current[token];
        const swapReceivedExpected = officialSwapReceivedExpectedBalanceRef.current[token];
        if (raw !== undefined && adjustment < 0n && removeExpected !== undefined && raw >= removeExpected) {
          delete next[token];
          changed = true;
        } else if (raw !== undefined && adjustment < 0n && swapReceivedExpected !== undefined && raw >= swapReceivedExpected) {
          delete next[token];
          delete officialSwapReceivedExpectedBalanceRef.current[token];
          changed = true;
        } else if (raw !== undefined && adjustment >= 0n && swapSpentExpected !== undefined && raw <= swapSpentExpected) {
          delete next[token];
          delete officialSwapSpentExpectedBalanceRef.current[token];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [officialUsdcRaw, officialEurcRaw, officialCirbtcRaw]);

  const processedOfficialSuccessHash = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!isTxSuccess || !txHash || processedOfficialSuccessHash.current === txHash) return;
    processedOfficialSuccessHash.current = txHash;

    if (officialSwapTxAction === 'swap') {
      setOfficialSwapInput('');
      setOfficialSwapMaxSelected(false);
      setOfficialSwapApprovalSatisfied(false);
      setOfficialSwapApprovedAmountRaw(0n);
      officialSwapApprovalSubmittedAmountRef.current = null;

      // A confirmed swap can be followed by a short RPC balance lag. Parse the
      // successful receipt and temporarily reconcile the wallet balances from
      // the exact ERC-20 Transfer logs, without changing the transaction.
      void (async () => {
        try {
          const receipt = await waitForTransactionReceipt(config, { hash: txHash });
          const poolKey = officialConfig.pool.toLowerCase();
          const tokenInKey = officialSwapTokenIn.toLowerCase();
          const tokenOutKey = officialSwapTokenOut.toLowerCase();
          const walletTopic = address ? `0x${address.toLowerCase().replace(/^0x/, '').padStart(64, '0')}` : '';
          const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952a7f163c4a11628f55a9df523b3ef' as `0x${string}`;
          let spentIn = 0n;
          let receivedOut = 0n;

          for (const log of receipt.logs) {
            if (log.topics[0]?.toLowerCase() !== transferTopic || typeof log.data !== 'string') continue;
            const logAddress = log.address.toLowerCase();
            if (logAddress !== tokenInKey && logAddress !== tokenOutKey) continue;
            try {
              const fromTopic = log.topics[1]?.toLowerCase();
              const toTopic = log.topics[2]?.toLowerCase();
              const value = BigInt(log.data);
              if (logAddress === tokenInKey && fromTopic === walletTopic && toTopic === poolKey) {
                spentIn += value;
              } else if (logAddress === tokenOutKey && fromTopic === poolKey && toTopic === walletTopic) {
                receivedOut += value;
              }
            } catch {}
          }

          if (spentIn === 0n && receivedOut === 0n) return;

          const beforeIn = officialSwapBalanceBeforeRef.current[tokenInKey];
          const beforeOut = officialSwapBalanceBeforeRef.current[tokenOutKey];

          // Do one targeted post-receipt read and use that result instead of the
          // possibly stale values captured when this effect started. This keeps
          // the wallet display correct even when Arc RPC balanceOf lags behind
          // the confirmed Transfer logs.
          const [freshInResult, freshOutResult] = await Promise.all([
            tokenInKey === CONTRACT_ADDRESSES.OFFICIAL_USDC.toLowerCase()
              ? refetchOfficialUsdc()
              : tokenInKey === CONTRACT_ADDRESSES.EURC.toLowerCase()
              ? refetchOfficialEurc()
              : refetchOfficialCirbtc(),
            tokenOutKey === CONTRACT_ADDRESSES.OFFICIAL_USDC.toLowerCase()
              ? refetchOfficialUsdc()
              : tokenOutKey === CONTRACT_ADDRESSES.EURC.toLowerCase()
              ? refetchOfficialEurc()
              : refetchOfficialCirbtc(),
          ]);

          const currentIn = freshInResult.data as bigint | undefined;
          const currentOut = freshOutResult.data as bigint | undefined;

          setOfficialBalanceAdjustments(prev => {
            const next = { ...prev };

            // Input token: subtract exactly what the receipt proves was sent.
            // Only keep the temporary adjustment if the fresh RPC read has not
            // reflected that deduction yet.
            if (spentIn > 0n && beforeIn !== undefined && currentIn !== undefined && currentIn > beforeIn - spentIn) {
              next[tokenInKey] = spentIn;
              officialSwapSpentExpectedBalanceRef.current[tokenInKey] = beforeIn - spentIn;
            } else if (spentIn > 0n) {
              delete next[tokenInKey];
              delete officialSwapSpentExpectedBalanceRef.current[tokenInKey];
            }

            // Output token: add exactly what the receipt proves was received.
            // The negative adjustment is display-only and disappears as soon as
            // balanceOf reaches the expected post-swap balance.
            if (receivedOut > 0n && beforeOut !== undefined && currentOut !== undefined && currentOut < beforeOut + receivedOut) {
              next[tokenOutKey] = -receivedOut;
              officialSwapReceivedExpectedBalanceRef.current[tokenOutKey] = beforeOut + receivedOut;
            } else if (receivedOut > 0n) {
              delete next[tokenOutKey];
              delete officialSwapReceivedExpectedBalanceRef.current[tokenOutKey];
            }

            return next;
          });
        } catch {
          // Normal ERC-20 polling remains the source of truth if receipt
          // parsing is unavailable.
        }
      })();
    }
    if (officialLiquidityTxAction === 'add') {
      void (async () => {
        try {
          const receipt = await waitForTransactionReceipt(config, { hash: txHash });
          if (receipt.status !== 'success') {
            console.error('USDC/cirBTC addLiquidity reverted:', txHash);
            setShowTxSuccess(false);
            return;
          }

          const poolKey = officialConfig.pool.toLowerCase();
          const token0Key = officialConfig.token0.toLowerCase();
          const token1Key = officialConfig.token1.toLowerCase();
          const walletTopic = address ? `0x${address.toLowerCase().replace(/^0x/, '').padStart(64, '0')}` : '';
          const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952a7f163c4a11628f55a9df523b3ef';
          const zeroTopic = `0x${'0'.repeat(64)}`;
          let received0 = 0n;
          let received1 = 0n;
          let mintedLp = 0n;
          let liquidityEventFound = false;

          for (const log of receipt.logs) {
            if (log.topics[0]?.toLowerCase() !== transferTopic || typeof log.data !== 'string') continue;
            const logAddress = log.address.toLowerCase();
            try {
              const fromTopic = log.topics[1]?.toLowerCase();
              const toTopic = log.topics[2]?.toLowerCase();
              const value = BigInt(log.data);
              if (logAddress === token0Key && fromTopic === walletTopic && toTopic === poolKey) received0 += value;
              if (logAddress === token1Key && fromTopic === walletTopic && toTopic === poolKey) received1 += value;
              if (logAddress === poolKey && fromTopic === zeroTopic && toTopic === walletTopic) mintedLp += value;
            } catch {}
          }

          for (const log of receipt.logs) {
            if (log.address.toLowerCase() !== poolKey) continue;
            try {
              const decoded = decodeEventLog({ abi: OFFICIAL_LP_ABI, data: log.data, topics: log.topics });
              if (decoded.eventName === 'LiquidityAdded') {
                const provider = decoded.args.provider as `0x${string}`;
                if (address && provider.toLowerCase() === address.toLowerCase()) {
                  liquidityEventFound = (decoded.args.liquidity as bigint) > 0n;
                  if (liquidityEventFound && mintedLp === 0n) mintedLp = decoded.args.liquidity as bigint;
                  break;
                }
              }
            } catch {}
          }

          // A genuine add must prove all three on-chain effects in the receipt:
          // both tokens moved wallet -> pool and LP was minted wallet-side.
          if (received0 === 0n || received1 === 0n || mintedLp === 0n || !liquidityEventFound) {
            console.error('USDC/cirBTC addLiquidity receipt did not prove token deposits + LP mint:', { txHash, received0, received1, mintedLp, liquidityEventFound });
            setShowTxSuccess(false);
            return;
          }

          setOfficialLiqInput0('');
          setOfficialLiqInput1('');
          setOfficialLiqMax0Selected(false);
          setOfficialLiqMax1Selected(false);
          setOfficialMaxRaw0(null);
          setOfficialMaxRaw1(null);

          // Only real on-chain reads are used after the receipt. No receipt-derived
          // LP/reserve/wallet fallback is stored in React state.
          const refreshOfficialLiquidityState = async () => {
            for (const delay of [0, 500, 1200, 2500, 5000]) {
              if (delay) await new Promise(resolve => setTimeout(resolve, delay));
              await Promise.all([
                refetchOfficialUsdc(),
                refetchOfficialEurc(),
                refetchOfficialCirbtc(),
                refetchOfficialReserves(),
                refetchOfficialReserve0Direct(),
                refetchOfficialReserve1Direct(),
                refetchOfficialLp(),
                refetchOfficialLpTotal(),
                refetchOfficialLpDecimals(),
                refetchOfficialLiqAllowance0(),
                refetchOfficialLiqAllowance1(),
              ]);
            }
          };
          void refreshOfficialLiquidityState();
        } catch (error) {
          console.error('USDC/cirBTC addLiquidity verification failed:', error);
          setShowTxSuccess(false);
        }
      })();
    }
    if (officialLiquidityTxAction === 'remove') {
      void (async () => {
        try {
          const receipt = await waitForTransactionReceipt(config, { hash: txHash });
          if (receipt.status !== 'success') {
            console.error('USDC/cirBTC removeLiquidity reverted:', txHash);
            setShowTxSuccess(false);
            return;
          }

          const poolKey = officialConfig.pool.toLowerCase();
          const token0Key = officialConfig.token0.toLowerCase();
          const token1Key = officialConfig.token1.toLowerCase();
          const walletTopic = address ? `0x${address.toLowerCase().replace(/^0x/, '').padStart(64, '0')}` : '';
          const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952a7f163c4a11628f55a9df523b3ef';
          let returned0 = 0n;
          let returned1 = 0n;
          let burnedLp = 0n;

          for (const log of receipt.logs) {
            if (log.topics[0]?.toLowerCase() !== transferTopic || typeof log.data !== 'string') continue;
            const logAddress = log.address.toLowerCase();
            try {
              const fromTopic = log.topics[1]?.toLowerCase();
              const toTopic = log.topics[2]?.toLowerCase();
              const value = BigInt(log.data);
              if (logAddress === token0Key && fromTopic === poolKey && toTopic === walletTopic) returned0 += value;
              if (logAddress === token1Key && fromTopic === poolKey && toTopic === walletTopic) returned1 += value;
              if (logAddress === poolKey && fromTopic === walletTopic && toTopic === `0x${'0'.repeat(64)}`) burnedLp += value;
            } catch {}
          }

          // A genuine remove must prove the LP burn and both token withdrawals.
          if (returned0 === 0n || returned1 === 0n || burnedLp === 0n) {
            console.error('USDC/cirBTC removeLiquidity receipt did not prove LP burn + token withdrawals:', { txHash, returned0, returned1, burnedLp });
            setShowTxSuccess(false);
            return;
          }

          setOfficialRemoveLpAmount('');
          setOfficialBalanceAdjustments(prev => {
            const next = { ...prev };
            delete next[token0Key];
            delete next[token1Key];
            return next;
          });

          await Promise.all([
            refetchOfficialUsdc(),
            refetchOfficialEurc(),
            refetchOfficialCirbtc(),
            refetchOfficialReserves(),
            refetchOfficialReserve0Direct(),
            refetchOfficialReserve1Direct(),
            refetchOfficialLp(),
            refetchOfficialLpTotal(),
            refetchOfficialLpDecimals(),
          ]);
        } catch (error) {
          console.error('USDC/cirBTC removeLiquidity verification failed:', error);
          setShowTxSuccess(false);
        }
      })();
    }

    // Refresh only the official queries that are already mounted, once after
    // the confirmed block. The previous burst of immediate + delayed refetches
    // could overload Arc RPC and make the wallet's eth_getTransactionCount
    // request hit the provider rate limit.
    const refreshOfficialState = async () => {
      await Promise.all([
        refetchOfficialUsdc(),
        refetchOfficialEurc(),
        refetchOfficialCirbtc(),
        refetchOfficialReserves(),
        refetchOfficialLp(),
        refetchOfficialLpTotal(),
        refetchOfficialReserve0Direct(),
        refetchOfficialReserve1Direct(),
        refetchOfficialLpDecimals(),
        refetchOfficialSwapAllowance(),
        refetchOfficialLiqAllowance0(),
        refetchOfficialLiqAllowance1(),
      ]);
    };

    // Wait briefly for the confirmed block to be indexed, then do one targeted
    // refresh instead of refetching every active query in the whole app.
    setTimeout(() => { void refreshOfficialState(); }, 1500);

    if (officialSwapTxAction === 'approve') {
      // Only unlock Swap after this exact approval transaction is confirmed on-chain.
      setOfficialSwapApprovalSatisfied(true);
      setOfficialSwapApprovedAmountRaw(officialSwapApprovalSubmittedAmountRef.current ?? 0n);
      officialSwapApprovalSubmittedAmountRef.current = null;
    }

    if (officialLiquidityTxAction === 'approve-0') {
      setOfficialApprovalSatisfied(prev => prev === '1' ? 'both' : '0');
    } else if (officialLiquidityTxAction === 'approve-1') {
      setOfficialApprovalSatisfied(prev => prev === '0' ? 'both' : '1');
    } else if (officialLiquidityTxAction === 'add' || officialLiquidityTxAction === 'remove') {
      setOfficialApprovalSatisfied('');
    }

    setOfficialSwapTxAction('');
    setOfficialLiquidityTxAction('');
  }, [isTxSuccess, officialSwapTxAction, officialLiquidityTxAction]);

  // FAUCET
  const handleMintTokens = async () => {  
    resetTx();
    writeContract({
      address: LEGACY_USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'mint',
      args: [address!, parseUnits("100", 6)],
    });
  };

  const handleMintArcg = async () => {
    resetTx();
    writeContract({
      address: CONTRACT_ADDRESSES.ARCG,
      abi: ERC20_ABI,
      functionName: 'mint',
      args: [address!, parseUnits("1000", 18)],
    });
  };

  const handleConnectWallet = async () => {
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

  const [showSettings, setShowSettings] = useState(false);
  const [officialMode, setOfficialMode] = useState(true);

  const removeLpParsed = (() => {
    if (!removeLpAmount || !Number.isFinite(Number(removeLpAmount)) || Number(removeLpAmount) <= 0) return 0n;
    try {
      return parseUnits(removeLpAmount, 18);
    } catch {
      return 0n;
    }
  })();

  const canRemoveLiquidity =
    removeLpParsed > 0n &&
    lpBalanceRaw > 0n &&
    removeLpParsed <= lpBalanceRaw &&
    !isTxPending &&
    !isTxConfirming;

  const stakeInputHasEnoughBalance =
    amountParsed > 0n &&
    erc20UsdcRaw !== undefined &&
    amountParsed <= (erc20UsdcRaw as bigint);

  const currentTokenInLabel = swapDirection === 'usdc-to-arcg' ? 'vUsdc' : 'ARCG';
  const currentTokenOutLabel = swapDirection === 'usdc-to-arcg' ? 'ARCG' : 'vUsdc';
  const currentBalanceIn = swapDirection === 'usdc-to-arcg' ? erc20UsdcBalance : arcgBalance;
  const currentBalanceOut = swapDirection === 'usdc-to-arcg' ? arcgBalance : erc20UsdcBalance;

  const goTo = (tab: 'home' | 'swap' | 'liquidity' | 'stake' | 'faucet' | 'contact') => {
    setActiveTab(tab);
    if (tab !== 'swap') setShowSettings(false);
  };

  const TokenLogo = ({ token }: { token: 'usdc' | 'arcg' | 'lp' }) => ( 
    <span className={`token-logo token-${token}`}>
      {token === 'usdc' ? '$' : token === 'arcg' ? '◆' : '◈'}
    </span>
  );


  const renderOfficialSwapCard = (compact = false) => (
    <div className={`swap-card ${compact ? 'swap-card-compact' : ''}`}>
      <div className="card-title-row">
        <div>
          <div className="eyebrow">OFFICIAL ARC TOKENS</div>
          <h2>{compact ? 'Official Swap' : 'Official Token Swap'}</h2>
        </div>
      </div>

      <div className="token-box">
        <div className="balance-row">
          <span>From</span>
          <span>Balance: {officialBalanceFor(officialSwapTokenIn, officialSwapTokenInDecimals)} {officialSwapTokenInSymbol}</span>
        </div>
        <div className="input-row">
          <input type="text" inputMode="decimal" className="token-input" placeholder="0.0" value={officialSwapInput} onChange={(e) => { setOfficialSwapApprovalSatisfied(false); setOfficialSwapApprovedAmountRaw(0n); setOfficialSwapMaxSelected(false); setOfficialSwapInput(e.target.value); }} />
          <div className="token-selector token-selector-select">
            <TokenLogo token={officialSwapTokenInSymbol === 'USDC' ? 'usdc' : 'lp'} />
            <select className="token-select" value={officialSwapTokenInSymbol} onChange={(e) => handleOfficialTokenPick('from', e.target.value)} aria-label="Select from token">
              <option value="USDC">USDC</option>
              <option value="EURC">EURC</option>
              <option value="cirBTC">cirBTC</option>
            </select>
            <ChevronDown className="token-select-arrow" size={16} aria-hidden="true" />
          </div>
        </div>
        <div className="input-footer">
          <button className="btn-max" onClick={() => {
            if (officialSwapBalanceRaw === undefined) return;
            // MAX displays the wallet balance using the normal token
            // precision. Do not round EURC upward: a wallet balance such as
            // 9.98... must never become 9.99. The exact raw balance is still
            // used for the transaction through officialSwapEffectiveInput.
            const raw = officialSwapBalanceRaw as bigint;
            const displayValue = Number(formatUnits(raw, officialSwapTokenInDecimals));
            // MAX must never display an amount greater than the wallet balance.
            // For 6-decimal tokens, floor to the displayed 2-decimal precision
            // instead of using toFixed(), which can round 9.98... up to 9.99.
            const display = officialSwapTokenInDecimals === 8
              ? displayValue.toFixed(8)
              : (Math.floor((displayValue + Number.EPSILON) * 100) / 100).toFixed(2);
            setOfficialSwapApprovalSatisfied(false);
            setOfficialSwapMaxSelected(true);
            setOfficialSwapInput(display);
          }}>Max</button>
        </div>
        {officialSwapMaxSelected && officialSwapTokenIn.toLowerCase() === CONTRACT_ADDRESSES.OFFICIAL_USDC.toLowerCase() && (
          <div className="gas-warning">
            <AlertCircle size={16} />
            <span>Full USDC balance cannot cover gas. Keep some USDC for gas.</span>
          </div>
        )}
      </div>

      <div className="swap-arrow-wrap">
        <button className="btn-switch-direction" onClick={() => { setOfficialSwapApprovalSatisfied(false); setOfficialSwapApprovedAmountRaw(0n); setOfficialSwapDirection(v => v === '0-to-1' ? '1-to-0' : '0-to-1'); setOfficialSwapInput(''); setOfficialSwapOutput('0'); }} title="Switch tokens" aria-label="Switch tokens">
          <ArrowDownUp size={18} />
        </button>
      </div>

      <div className="token-box">
        <div className="balance-row">
          <span>To</span>
          <span>Balance: {officialBalanceFor(officialSwapTokenOut, officialSwapTokenOutDecimals)} {officialSwapTokenOutSymbol}</span>
        </div>
        <div className="input-row">
          <input type="text" className="token-input" readOnly value={isOfficialReservesLoading ? 'Loading...' : !officialHasLiquidity ? 'Pool Empty' : officialSwapOutput} />
          <div className="token-selector token-selector-select">
            <TokenLogo token={officialSwapTokenOutSymbol === 'USDC' ? 'usdc' : 'lp'} />
            <select className="token-select" value={officialSwapTokenOutSymbol} onChange={(e) => handleOfficialTokenPick('to', e.target.value)} aria-label="Select to token">
              <option value="USDC">USDC</option>
              <option value="EURC">EURC</option>
              <option value="cirBTC">cirBTC</option>
            </select>
            <ChevronDown className="token-select-arrow" size={16} aria-hidden="true" />
          </div>
        </div>
      </div>

      {parseFloat(officialSwapInput) > 0 && officialHasLiquidity && parseFloat(officialSwapOutput) > 0 && (
        <div className="details-container">
          <div className="detail-item"><span>Rate</span><span className="detail-value">1 {officialSwapTokenInSymbol} = {(parseFloat(officialSwapOutput) / parseFloat(officialSwapInput)).toFixed(6)} {officialSwapTokenOutSymbol}</span></div>
          <div className="detail-item"><span>Price Impact</span><span className="detail-value">{officialPriceImpact}%</span></div>
          <div className="detail-item"><span>Liquidity Provider Fee</span><span className="detail-value">{(parseFloat(officialSwapInput) * 0.003).toFixed(6)} {officialSwapTokenInSymbol}</span></div>
        </div>
      )}

      {!isOfficialReservesLoading && !officialHasLiquidity && (
        <button className="text-link-button" style={{ width: '100%', marginBottom: 10 }} onClick={() => goTo('liquidity')}>
          Pool is empty — Add Liquidity <ArrowRight size={15} />
        </button>
      )}

      <button className="btn-action" onClick={officialNeedsSwapApproval ? handleOfficialApproveSwap : handleOfficialSwap} disabled={isTxPending || isTxConfirming || officialSwapEffectiveInput === 0n || !officialHasEnoughSwapBalance || officialSwapOutput === '0' || officialSwapOutput === 'Pool Empty'}>
        {isTxPending || isTxConfirming ? <RefreshCw size={18} className="spin" /> : <ArrowRight size={18} />}
        {!officialHasEnoughSwapBalance ? 'Insufficient Balance' : officialNeedsSwapApproval ? `Approve ${officialSwapTokenInSymbol}` : 'Swap Assets'}
      </button>

      {compact && <button className="text-link-button" onClick={() => goTo('swap')}>Open full swap <ArrowRight size={15} /></button>}
    </div>
  );

  const renderSwapCard = (compact = false) => (
    <div className={`card-mode-shell ${compact ? 'compact-mode-shell' : 'swap-mode-shell'}`}>
      <div className="mode-toggle-row">
        <div className="segmented-control">
          <button className={officialMode ? 'selected' : ''} onClick={() => setOfficialMode(true)}>Official</button>
          <button className={!officialMode ? 'selected' : ''} onClick={() => setOfficialMode(false)}>Mock / ARCG</button>
        </div>
      </div>
      {officialMode ? renderOfficialSwapCard(compact) : renderLegacySwapCard(compact)}
    </div>
  );

  const renderOfficialLiquidityCard = () => (
    <div className="swap-card wide-card">
      <div className="card-title-row">
        <div><div className="eyebrow">OFFICIAL LIQUIDITY</div><h2>{officialConfig.label}</h2></div>
        <div className="token-selector token-selector-select" style={{ minWidth: 155 }}>
          <select className="token-select" value={officialPair} onChange={(e) => { setOfficialPair(e.target.value as OfficialPairKey); setOfficialApprovalSatisfied(''); setOfficialLiqMax0Selected(false); setOfficialLiqMax1Selected(false); setOfficialMaxRaw0(null); setOfficialMaxRaw1(null); setOfficialLiqInput0(''); setOfficialLiqInput1(''); }} style={{ width: '100%', background: 'transparent', border: 0, outline: 0, fontWeight: 700 }}>
            <option value="usdc-eurc">USDC / EURC</option>
            <option value="usdc-cirbtc">USDC / cirBTC</option>
          </select>
          <ChevronDown className="token-select-arrow" size={16} aria-hidden="true" />
        </div>
      </div>

      <div className="segmented-control" style={{ width: 'fit-content', marginBottom: 14 }}>
        <button className={!isOfficialRemovingLiquidity ? 'selected' : ''} onClick={() => setIsOfficialRemovingLiquidity(false)}>Add</button>
        <button className={isOfficialRemovingLiquidity ? 'selected' : ''} onClick={() => setIsOfficialRemovingLiquidity(true)}>Remove</button>
      </div>

      {!isOfficialRemovingLiquidity ? <>
        <p className="card-description">Provide liquidity to the official Arc Testnet token pair and earn 0.3% swap fees.</p>
        <div className="token-box">
          <div className="balance-row"><span>{officialConfig.token0Symbol}</span><span>Balance: {officialBalanceFor(officialConfig.token0, officialConfig.token0Decimals)}</span></div>
          <div className="input-row"><input type="text" inputMode="decimal" className="token-input" placeholder="0.0" value={officialLiqInput0} onChange={(e) => handleOfficialLiq0Change(e.target.value)} /><div className="token-selector"><span>{officialConfig.token0Symbol}</span></div></div>
          <div className="input-footer"><button className="btn-max" onClick={handleMaxOfficialLiq0}>Max</button></div>
        </div>
        <div className="plus-divider"><Plus size={16} /></div>
        <div className="token-box">
          <div className="balance-row"><span>{officialConfig.token1Symbol}</span><span>Balance: {officialBalanceFor(officialConfig.token1, officialConfig.token1Decimals)}</span></div>
          <div className="input-row"><input type="text" inputMode="decimal" className="token-input" placeholder="0.0" value={officialLiqInput1} onChange={(e) => handleOfficialLiq1Change(e.target.value)} /><div className="token-selector"><span>{officialConfig.token1Symbol}</span></div></div>
          <div className="input-footer"><button className="btn-max" onClick={handleMaxOfficialLiq1}>Max</button></div>
        </div>
        <button className="btn-action" onClick={officialNeedsLiqApprove0 ? handleOfficialApproveLiq0 : officialNeedsLiqApprove1 ? handleOfficialApproveLiq1 : handleOfficialAddLiquidity} disabled={isTxPending || isTxConfirming || !officialCanAddLiquidity}>
          {isTxPending || isTxConfirming ? <RefreshCw size={18} className="spin" /> : <Droplet size={18} />}
          {!officialHasEnoughLiq0 || !officialHasEnoughLiq1 ? 'Insufficient Balance' : officialNeedsLiqApprove0 ? `Approve ${officialConfig.token0Symbol}` : officialNeedsLiqApprove1 ? `Approve ${officialConfig.token1Symbol}` : 'Add Liquidity'}
        </button>
      </> : <>
        <p className="card-description">Burn your LP tokens to withdraw your share of {officialConfig.token0Symbol} and {officialConfig.token1Symbol}.</p>
        <div className="token-box">
          <div className="balance-row"><span>Burn LP Tokens</span><span>LP Balance: {officialLpBalance} ARC-LP</span></div>
          <div className="input-row"><input type="text" inputMode="decimal" className="token-input" placeholder="0.0" value={officialRemoveLpAmount} onChange={(e) => setOfficialRemoveLpAmount(e.target.value)} /><div className="token-selector"><span>ARC-LP</span></div></div>
          <div className="input-footer"><button className="btn-max" onClick={() => { if (officialLpBalanceRaw <= 0n) return setOfficialRemoveLpAmount(''); setOfficialRemoveLpAmount(formatUnits(officialLpBalanceRaw, officialLpDecimals)); }}>Max</button></div>
        </div>
        {officialRemoveParsed > 0n && officialLpTotalSupply > 0 && officialRemoveParsed <= officialLpBalanceRaw && (
          <div className="details-container">
            <div className="detail-title">Estimated Returns</div>
            <div className="detail-item"><span>{officialConfig.token0Symbol}</span><span className="detail-value">{(parseFloat(formatUnits(officialReserve0, officialConfig.token0Decimals)) * (parseFloat(officialRemoveLpAmount) / officialLpTotalSupply)).toFixed(4)}</span></div>
            <div className="detail-item"><span>{officialConfig.token1Symbol}</span><span className="detail-value">{(parseFloat(formatUnits(officialReserve1, officialConfig.token1Decimals)) * (parseFloat(officialRemoveLpAmount) / officialLpTotalSupply)).toFixed(officialConfig.token1Decimals === 8 ? 8 : 4)}</span></div>
          </div>
        )}
        <button className="btn-action" onClick={handleOfficialRemoveLiquidity} disabled={isTxPending || isTxConfirming || officialRemoveParsed <= 0n || officialRemoveParsed > officialLpBalanceRaw || officialLpBalanceRaw <= 0n}>
          {isTxPending || isTxConfirming ? <RefreshCw size={18} className="spin" /> : <Minus size={18} />} Remove Liquidity
        </button>
      </>}

      <div className="pool-stats">
        <div className="pool-stat"><span>{officialConfig.token0Symbol} Reserve</span><strong>{parseFloat(formatUnits(officialReserve0, officialConfig.token0Decimals)).toFixed(2)}</strong></div>
        <div className="pool-stat"><span>{officialConfig.token1Symbol} Reserve</span><strong>{parseFloat(formatUnits(officialReserve1, officialConfig.token1Decimals)).toFixed(officialConfig.token1Decimals === 8 ? 8 : 2)}</strong></div>
        <div className="pool-stat full"><span>Total LP Shares</span><strong>{officialLpTotalSupplyDisplay} LP</strong></div>
      </div>
    </div>
  );

  const renderLiquidityCard = () => (
    <div className="card-mode-shell liquidity-mode-shell">
      <div className="mode-toggle-row">
        <div className="segmented-control">
          <button className={officialMode ? 'selected' : ''} onClick={() => setOfficialMode(true)}>Official</button>
          <button className={!officialMode ? 'selected' : ''} onClick={() => setOfficialMode(false)}>Mock / ARCG</button>
        </div>
      </div>
      {officialMode ? renderOfficialLiquidityCard() : renderLegacyLiquidityCard()}
    </div>
  );

  const renderLegacySwapCard = (compact = false) => (
    <div className={`swap-card ${compact ? 'swap-card-compact' : ''}`}>
      <div className="card-title-row">
        <div>
          <div className="eyebrow">TRADE</div>
          <h2>{compact ? 'Swap' : 'Swap Tokens'}</h2>
        </div>
        <button
          className="btn-icon-only"
          onClick={() => setShowSettings(v => !v)}
          title="Swap settings"
          aria-label="Swap settings"
        >
          <Settings size={18} />
        </button>
      </div>

      {showSettings && (
        <div className="settings-popover">
          <div><span>Liquidity fee</span><strong>0.30%</strong></div>
          <div><span>Slippage tolerance</span><strong>0.50%</strong></div>
          <div><span>Network</span><strong>Arc Testnet</strong></div>
        </div>
      )}

      <div className="token-box">
        <div className="balance-row">
          <span>From</span>
          <span>Balance: {currentBalanceIn} {currentTokenInLabel}</span>
        </div>
        <div className="input-row">
          <input
            type="text"
            inputMode="decimal"
            className="token-input"
            placeholder="0.0"
            value={swapInput}
            onChange={(e) => setSwapInput(e.target.value)}
            aria-label="Swap amount"
          />
          <div className="token-selector">
            <TokenLogo token={swapDirection === 'usdc-to-arcg' ? 'usdc' : 'arcg'} />
            <span>{currentTokenInLabel}</span>
            <ChevronDown size={16} />
          </div>
        </div>
        <div className="input-footer">
          <button
            className="btn-max"
            onClick={() => {
              const rawBal = swapDirection === 'usdc-to-arcg' ? erc20UsdcRaw : arcgRaw;
              if (rawBal === undefined) return;
              const formatted = formatUnits(BigInt(rawBal as any), tokenInDecimals);
              const parts = formatted.split('.');
              const truncated = parts[1]
                ? `${parts[0]}.${parts[1].slice(0, 6)}`
                : parts[0];
              setSwapInput(truncated);
            }}
          >
            Max
          </button>
        </div>
      </div>

      <div className="swap-arrow-wrap">
        <button
          className="btn-switch-direction"
          onClick={() => {
            setSwapDirection(prev => prev === 'usdc-to-arcg' ? 'arcg-to-usdc' : 'usdc-to-arcg');
            setSwapInput('');
            setSwapOutput('0');
            setPriceImpact('0.00');
          }}
          title="Switch tokens"
          aria-label="Switch tokens"
        >
          <ArrowDownUp size={18} />
        </button>
      </div>

      <div className="token-box">
        <div className="balance-row">
          <span>To</span>
          <span>Balance: {currentBalanceOut} {currentTokenOutLabel}</span>
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
            aria-label="Estimated output"
          />
          <div className="token-selector">
            <TokenLogo token={swapDirection === 'usdc-to-arcg' ? 'arcg' : 'usdc'} />
            <span>{currentTokenOutLabel}</span>
            <ChevronDown size={16} />
          </div>
        </div>
      </div>

      {parseFloat(swapInput) > 0 && hasLiquidity && parseFloat(swapOutput) > 0 && (
        <div className="details-container">
          <div className="detail-item">
            <span>Rate</span>
            <span className="detail-value">
              1 {currentTokenInLabel} = {(parseFloat(swapOutput) / parseFloat(swapInput)).toFixed(4)} {currentTokenOutLabel}
            </span>
          </div>
          <div className="detail-item">
            <span>Price Impact</span>
            <span className="detail-value">{priceImpact}%</span>
          </div>
          <div className="detail-item">
            <span>Liquidity Provider Fee</span>
            <span className="detail-value">
              {(parseFloat(swapInput) * 0.003).toFixed(5)} {currentTokenInLabel}
            </span>
          </div>
        </div>
      )}

      {parseFloat(nativeGasBalance) < 0.1 && (
        <div className="gas-warning">
          <AlertCircle size={16} />
          <span>
            Low native USDC for gas. Use the <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">Circle Faucet</a>.
          </span>
        </div>
      )}

      <button
        className="btn-action"
        onClick={needsSwapApproval ? handleApproveSwap : handleSwap}
        disabled={
          isTxPending ||
          isTxConfirming ||
          !parsedSwapInput ||
          !hasEnoughSwapBalance ||
          swapOutput === '0' ||
          swapOutput === 'No Liquidity'
        }
      >
        {isTxPending || isTxConfirming ? <RefreshCw size={18} className="spin" /> : <ArrowRight size={18} />}
        {!hasEnoughSwapBalance
          ? 'Insufficient Balance'
          : needsSwapApproval
          ? `Approve ${currentTokenInLabel}`
          : 'Swap Assets'}
      </button>

      {compact && (
        <button className="text-link-button" onClick={() => goTo('swap')}>
          Open full swap <ArrowRight size={15} />
        </button>
      )}
    </div>
  );

  const renderLegacyLiquidityCard = () => (
    <div className="swap-card wide-card">
      <div className="card-title-row">
        <div>
          <div className="eyebrow">LIQUIDITY</div>
          <h2>Pool Liquidity</h2>
        </div>
        <div className="segmented-control">
          <button className={!isRemovingLiquidity ? 'selected' : ''} onClick={() => setIsRemovingLiquidity(false)}>Add</button>
          <button className={isRemovingLiquidity ? 'selected' : ''} onClick={() => setIsRemovingLiquidity(true)}>Remove</button>
        </div>
      </div>

      {!isRemovingLiquidity ? (
        <>
          <p className="card-description">
            Deposit equal values of vUsdc and ARCG to provide liquidity and earn 0.3% swap fees.
          </p>

          <div className="token-box">
            <div className="balance-row">
              <span>vUsdc</span>
              <span>Balance: {erc20UsdcBalance}</span>
            </div>
            <div className="input-row">
              <input
                type="text"
                inputMode="decimal"
                className="token-input"
                placeholder="0.0"
                value={liqUsdcInput}
                onChange={(e) => handleLiqUsdcChange(e.target.value)}
              />
              <div className="token-selector"><TokenLogo token="usdc" /><span>vUsdc</span></div>
            </div>
            <div className="input-footer"><button className="btn-max" onClick={handleMaxLiqUsdc}>Max</button></div>
          </div>

          <div className="plus-divider"><Plus size={16} /></div>

          <div className="token-box">
            <div className="balance-row">
              <span>ARCG</span>
              <span>Balance: {arcgBalance}</span>
            </div>
            <div className="input-row">
              <input
                type="text"
                inputMode="decimal"
                className="token-input"
                placeholder="0.0"
                value={liqArcgInput}
                onChange={(e) => handleLiqArcgChange(e.target.value)}
              />
              <div className="token-selector"><TokenLogo token="arcg" /><span>ARCG</span></div>
            </div>
            <div className="input-footer"><button className="btn-max" onClick={handleMaxLiqArcg}>Max</button></div>
          </div>

          {liqUsdcInput && liqArcgInput && parseFloat(liqUsdcInput) > 0 && parseFloat(liqArcgInput) > 0 && (
            <div className="details-container">
              <div className="detail-item">
                <span>Estimated LP</span>
                <span className="detail-value">{calculateExpectedLp()} LP</span>
              </div>
            </div>
          )}

          <button
            className="btn-action"
            onClick={
              needsLiqUsdcApprove
                ? handleApproveLiqUsdc
                : needsLiqArcgApprove
                ? handleApproveLiqArcg
                : handleAddLiquidity
            }
            disabled={
              isTxPending ||
              isTxConfirming ||
              !canAddLiquidity
            }
          >
            {isTxPending || isTxConfirming ? <RefreshCw size={18} className="spin" /> : <Droplet size={18} />}
            {!hasEnoughLiqUsdc || !hasEnoughLiqArcg
              ? 'Insufficient Balance'
              : needsLiqUsdcApprove
              ? 'Approve vUsdc'
              : needsLiqArcgApprove
              ? 'Approve ARCG'
              : 'Add Liquidity'}
          </button>
        </>
      ) : (
        <>
          <p className="card-description">
            Burn your LP tokens to withdraw your share of vUsdc and ARCG from the pool.
          </p>

          <div className="token-box">
            <div className="balance-row">
              <span>Burn LP Tokens</span>
              <span>LP Balance: {lpBalance} ARC-LP</span>
            </div>
            <div className="input-row">
              <input
                type="text"
                inputMode="decimal"
                className="token-input"
                placeholder="0.0"
                value={removeLpAmount}
                onChange={(e) => setRemoveLpAmount(e.target.value)}
                aria-label="LP amount to remove"
              />
              <div className="token-selector"><TokenLogo token="lp" /><span>ARC-LP</span></div>
            </div>
            <div className="input-footer">
              <button
                className="btn-max"
                onClick={() => {
                  if (lpBalanceRaw <= 0n) {
                    setRemoveLpAmount('');
                    return;
                  }
                  const maxRemovable = lpBalanceRaw > 1n ? lpBalanceRaw - 1n : lpBalanceRaw;
                  setRemoveLpAmount(formatUnits(maxRemovable, 18));
                }}
              >
                Max
              </button>
            </div>
          </div>

          {removeLpParsed > 0n && lpTotalSupply > 0 && removeLpParsed <= lpBalanceRaw && (
            <div className="details-container">
              <div className="detail-title">Estimated Returns</div>
              <div className="detail-item">
                <span>vUsdc</span>
                <span className="detail-value">
                  {(parseFloat(formatUnits(reserveUsdc, 6)) * (parseFloat(removeLpAmount) / lpTotalSupply)).toFixed(4)}
                </span>
              </div>
              <div className="detail-item">
                <span>ARCG</span>
                <span className="detail-value">
                  {(parseFloat(formatUnits(reserveArcg, 18)) * (parseFloat(removeLpAmount) / lpTotalSupply)).toFixed(4)}
                </span>
              </div>
            </div>
          )}

          <button
            className="btn-action"
            onClick={handleRemoveLiquidity}
            disabled={!canRemoveLiquidity}
          >
            {isTxPending || isTxConfirming ? <RefreshCw size={18} className="spin" /> : <Minus size={18} />}
            {removeLpAmount && removeLpParsed === 0n ? 'Enter an amount greater than 0' : 'Remove Liquidity'}
          </button>

          <div className="zero-safe-note">
            <CheckCircle size={14} />
            <span>Zero or invalid LP amounts cannot start a transaction.</span>
          </div>
        </>
      )}

      <div className="pool-stats">
        <div className="pool-stat">
          <span>vUsdc Reserve</span>
          <strong>{reserveUsdcFormatted}</strong>
        </div>
        <div className="pool-stat">
          <span>ARCG Reserve</span>
          <strong>{reserveArcgFormatted}</strong>
        </div>
        <div className="pool-stat full">
          <span>Total LP Shares</span>
          <strong>{lpTotalSupply.toFixed(4)} LP</strong>
        </div>
      </div>
    </div>
  );

  const renderStakeCard = () => (
    <div className="swap-card wide-card">
      <div className="card-title-row">
        <div>
          <div className="eyebrow">EARN</div>
          <h2>vUsdc Staking</h2>
          <p className="accent-copy">3% APY • Earn VXC token rewards</p>
        </div>
        <div className="feature-icon green"><TrendingUp size={20} /></div>
      </div>

      <div className="stake-stats">
        <div><span>Staked vUsdc</span><strong>{stakedBalanceFormatted.toFixed(4)}</strong></div>
        <div><span>Earned VXC</span><strong>{earnedRewardFormatted}</strong></div>
      </div>

      <div className="token-box">
        <div className="balance-row">
          <span>Amount</span>
          <span>Wallet: {erc20UsdcBalance} vUsdc</span>
        </div>
        <div className="input-row">
          <input
            type="text"
            inputMode="decimal"
            className="token-input"
            placeholder="0.0"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
          />
          <div className="token-selector"><TokenLogo token="usdc" /><span>vUsdc</span></div>
        </div>
        <div className="input-footer">
          <button
            className="btn-max"
            onClick={() => {
              if (erc20UsdcRaw === undefined) return;
              setStakeAmount(formatUnits(BigInt(erc20UsdcRaw as any), 6));
            }}
          >
            Max
          </button>
        </div>
      </div>

      <div className="two-buttons">
        <button
          className="btn-connect"
          onClick={handleApproveAndStake}
          disabled={isProcessing || !stakeInputHasEnoughBalance}
        >
          {isProcessing ? <RefreshCw size={16} className="spin" /> : null}
          {!stakeAmount ? 'Enter Amount' : !stakeInputHasEnoughBalance ? 'Insufficient Balance' : 'Approve & Stake'}
        </button>
        <button
          className="btn-danger"
          onClick={handleWithdraw}
          disabled={isUnstaking || amountParsed === 0n || amountParsed > rawStakedBalance}
        >
          {isUnstaking ? <RefreshCw size={16} className="spin" /> : null}
          {amountParsed > rawStakedBalance && amountParsed > 0n ? 'Insufficient Staked' : 'Unstake'}
        </button>
      </div>

      <button
        className="btn-reward"
        onClick={handleClaim}
        disabled={!earnedRewardFormatted || Number(earnedRewardFormatted) <= 0}
      >
        <Gift size={17} />
        Claim VXC Rewards
      </button>

      {stakeTxHash && (
        <div className="success-panel">
          <div><CheckCircle size={15} /> Transaction Success!</div>
          <span>Your request was completed with sub-second finality.</span>
          <a href={`https://testnet.arcscan.app/tx/${stakeTxHash}`} target="_blank" rel="noopener noreferrer">
            View on Explorer <ExternalLink size={11} />
          </a>
        </div>
      )}
    </div>
  );

  const renderFaucetCard = () => (
    <div className="swap-card wide-card">
      <div className="card-title-row">
        <div>
          <div className="eyebrow">TESTNET</div>
          <h2>Arc Testnet Faucet</h2>
        </div>
        <div className="feature-icon purple"><Gift size={20} /></div>
      </div>
      <p className="card-description">
        Mint mock vUsdc and ARCG tokens to test every VeloxSwap feature.
      </p>

      <div className="faucet-list">
        <div className="faucet-row">
          <div className="faucet-token">
            <TokenLogo token="usdc" />
            <div><strong>100 vUsdc</strong><span>6-decimal test token</span></div>
          </div>
          <button className="btn-connect" onClick={handleMintTokens} disabled={isTxPending || isTxConfirming}>
            <Gift size={16} /> Mint vUsdc
          </button>
        </div>
        <div className="faucet-row">
          <div className="faucet-token">
            <TokenLogo token="arcg" />
            <div><strong>1,000 ARCG</strong><span>18-decimal test token</span></div>
          </div>
          <button className="btn-connect" onClick={handleMintArcg} disabled={isTxPending || isTxConfirming}>
            <Gift size={16} /> Mint ARCG
          </button>
        </div>
      </div>

      <div className="info-panel">
        <AlertCircle size={17} />
        <div>
          <strong>Need native USDC for gas?</strong>
          <p>Arc Testnet transaction fees are paid with native USDC.</p>
          <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">
            Open Circle Faucet <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );

  const renderContactCard = () => (
    <div className="swap-card wide-card contact-card">
      <div className="card-title-row">
        <div>
          <div className="eyebrow">COMMUNITY</div>
          <h2>Contact VeloxSwap</h2>
        </div>
        <div className="feature-icon pink"><Mail size={20} /></div>
      </div>
      <p className="card-description">
        Have feedback, a bug report, or an idea? Connect with the VeloxSwap community.
      </p>

      <div className="contact-grid">
        <a className="contact-link" href="https://x.com/Scarfacedrop" target="_blank" rel="noopener noreferrer">
          <MessageCircle size={20} /><div><strong>X / Twitter</strong><span>@Scarfacedrop</span></div><ArrowRight size={16} />
        </a>
        <a className="contact-link" href="https://github.com/prafoos" target="_blank" rel="noopener noreferrer">
          <Github size={20} /><div><strong>GitHub</strong><span>github.com/prafoos</span></div><ArrowRight size={16} />
        </a>
      </div>

      <div className="community-note">
        <Users size={18} />
        <span>VeloxSwap is community driven. Your feedback helps improve the testnet experience.</span>
      </div>
    </div>
  );

  const renderStatus = () => (
    <div className="status-stack">
      {(isTxPending || isTxConfirming) && (
        <div className="status-box">
          <div className="status-header"><RefreshCw className="spin" size={16} /><span>Transaction Pending…</span></div>
          <div className="status-body">
            {isTxConfirming ? 'Waiting for block confirmation on Arc Testnet…' : 'Please approve the transaction in your wallet…'}
            {txHash && (
              <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
                View on Explorer <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      )}

      {showTxSuccess && isTxSuccess && txHash && (
        <div className="status-box success">
          <div className="status-header"><CheckCircle size={16} /><span>Transaction Success!</span></div>
          <div className="status-body">
            Your request was completed with sub-second finality.
            <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
              View on Explorer <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}

      {txError && (
        <div className="status-box error">
          <div className="status-header"><AlertCircle size={16} /><span>Transaction Failed</span></div>
          <div className="status-body">
            {txError.message.includes('User rejected')
              ? 'Transaction was rejected by the user.'
              : `${txError.message.substring(0, 140)}…`}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="app-container velox-app">
      <style>{`
        :root {
          --vx-bg: #030816;
          --vx-bg-2: #071126;
          --vx-card: rgba(10, 17, 36, .78);
          --vx-card-strong: rgba(12, 20, 43, .94);
          --vx-border: rgba(139, 92, 246, .22);
          --vx-border-light: rgba(148, 163, 184, .14);
          --vx-text: #f8fafc;
          --vx-muted: #aab5cf;
          --vx-primary: #4f6cff;
          --vx-purple: #a855f7;
          --vx-green: #24d3a1;
        }

        html,
        body,
        #root {
          min-height: 100%;
          margin: 0;
        }

        body {
          min-height: 100vh;
        }

        .velox-app {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          color: var(--vx-text);
          background:
            radial-gradient(circle at 72% 28%, rgba(61, 73, 255, .13), transparent 28%),
            radial-gradient(circle at 25% 52%, rgba(121, 52, 255, .10), transparent 30%),
            linear-gradient(135deg, #020713 0%, #071126 48%, #030714 100%);
          overflow-x: hidden;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .velox-app * { box-sizing: border-box; }

        .velox-app a { color: inherit; }

        .vx-header {
          position: sticky;
          top: 0;
          z-index: 30;
          height: 82px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 0 4.5%;
          background: rgba(3, 8, 22, .82);
          border-bottom: 1px solid rgba(148,163,184,.12);
          backdrop-filter: blur(20px);
        }

        .vx-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          min-width: 220px;
        }

        .vx-brand-mark {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          font-size: 27px;
          font-weight: 900;
          color: white;
          border-radius: 12px;
          background: linear-gradient(145deg, #3b82f6, #7c3aed 62%, #c026d3);
          box-shadow: 0 12px 32px rgba(79,70,229,.34);
          transform: skew(-7deg);
        }

        .vx-brand-name {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -.7px;
        }

        .vx-brand-name span {
          background: linear-gradient(90deg, #398bff, #a855f7);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .vx-nav {
          position: absolute;
          left: 50%;
          top: 0;
          transform: translateX(-50%);
          height: 82px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 34px;
          flex: none;
          width: max-content;
          max-width: calc(100% - 520px);
        }

        .vx-nav button {
          position: relative;
          border: 0;
          background: transparent;
          color: #d3d9ea;
          font-size: 15px;
          padding: 28px 4px 25px;
          cursor: pointer;
        }

        .vx-nav button:hover, .vx-nav button.active { color: white; }

        .vx-nav button.active::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 17px;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(90deg, #4f6cff, #a855f7);
        }

        .vx-header-actions {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          flex-shrink: 0;
          min-height: 48px;
          height: 48px;
          flex-wrap: nowrap;
          white-space: nowrap;
          width: max-content;
          max-width: max-content;
        }

        .vx-header-actions > * {
          flex-shrink: 0;
          align-self: center;
          margin-top: 0;
          margin-bottom: 0;
        }

        .network-select {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 150px;
          justify-content: center;
          height: 48px;
          padding: 0 15px;
          color: #e7ebf7;
          background: rgba(10, 17, 36, .72);
          border: 1px solid rgba(148,163,184,.22);
          border-radius: 12px;
          cursor: pointer;
        }

        .network-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #19d6a0;
          box-shadow: 0 0 14px rgba(25,214,160,.65);
        }

        .network-dot.wrong { background: #fb7185; box-shadow: 0 0 14px rgba(251,113,133,.55); }

        .vx-wallet-button {
          width: 188px;
          min-width: 188px;
          max-width: 188px;
          height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          align-self: center;
          flex: 0 0 188px;
          margin: 0;
          padding: 0 18px;
          border: 0;
          border-radius: 12px;
          color: white;
          font-size: 15px;
          font-weight: 700;
          line-height: 1;
          white-space: nowrap;
          vertical-align: middle;
          position: relative;
          top: 0;
          background: linear-gradient(100deg, #3868ff, #a43ef0);
          box-shadow: 0 12px 30px rgba(92,68,255,.28);
          cursor: pointer;
        }

        /* Keep the network selector and wallet control on the exact same row.
           The wallet component is external, so target its root element as well
           as the .vx-wallet-button class without changing its functionality. */
        .vx-header-actions > :last-child {
          width: 188px !important;
          min-width: 188px !important;
          max-width: 188px !important;
          height: 48px !important;
          flex: 0 0 188px !important;
          align-self: center !important;
          margin: 0 !important;
          box-sizing: border-box;
        }

        .vx-header-actions > :last-child .vx-wallet-button {
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          height: 48px !important;
          margin: 0 !important;
          box-sizing: border-box;
        }

        .vx-wallet-button:hover { filter: brightness(1.08); transform: translateY(-1px); }

        .vx-main {
          width: min(1400px, 91%);
          margin: 0 auto;
          min-height: 0;
          flex: 1 0 auto;
        }

        .hero {
          position: relative;
          display: grid;
          grid-template-columns: 1.08fr .92fr;
          gap: 64px;
          align-items: center;
          min-height: 560px;
          padding: 58px 20px 32px;
        }

        .hero::after {
          content: "";
          position: absolute;
          left: -5%;
          right: 43%;
          bottom: 0;
          height: 210px;
          background: radial-gradient(ellipse at 55% 45%, rgba(67,83,255,.24), transparent 67%);
          filter: blur(18px);
          pointer-events: none;
        }

        .hero-copy { position: relative; z-index: 2; }

        .hero-kicker, .eyebrow {
          color: #9c6dff;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .hero-title {
          max-width: 700px;
          margin: 14px 0 18px;
          font-size: clamp(48px, 5vw, 72px);
          line-height: .99;
          letter-spacing: -3px;
          font-weight: 850;
        }

        .gradient-title {
          background: linear-gradient(90deg, #3c91ff 0%, #6c5cf7 45%, #c24cff 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .hero-description {
          max-width: 610px;
          color: #b9c3db;
          font-size: 18px;
          line-height: 1.7;
          margin: 0 0 30px;
        }

        .hero-features {
          display: flex;
          flex-wrap: wrap;
          gap: 30px;
          color: #e2e7f2;
        }

        .hero-feature {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
        }

        .hero-feature svg { color: #6383ff; }

        .hero-swap { position: relative; z-index: 4; }

        .glow-orb {
          position: absolute;
          width: 420px;
          height: 280px;
          right: -120px;
          top: 65px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(77,83,255,.25), transparent 68%);
          filter: blur(8px);
          pointer-events: none;
        }

        .feature-cards {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
          padding: 18px 0 34px;
        }

        .feature-card {
          min-height: 255px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          border-radius: 15px;
          border: 1px solid rgba(148,163,184,.13);
          background: linear-gradient(150deg, rgba(17,28,57,.8), rgba(7,12,28,.9));
          box-shadow: inset 0 1px 0 rgba(255,255,255,.025);
        }

        .feature-card:hover {
          transform: translateY(-3px);
          border-color: rgba(139,92,246,.35);
        }

        .feature-card h3 { margin: 17px 0 6px; font-size: 23px; }
        .feature-card p { margin: 0; color: var(--vx-muted); font-size: 14px; line-height: 1.55; }
        .feature-card button { margin-top: auto; }

        .feature-icon {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(75,91,255,.16);
          color: #65a2ff;
          box-shadow: 0 0 30px rgba(74,91,255,.13);
        }

        .feature-icon.green { color: #31ddb0; background: rgba(16,185,129,.14); }
        .feature-icon.purple { color: #b16bff; background: rgba(168,85,247,.15); }
        .feature-icon.pink { color: #f472d0; background: rgba(236,72,153,.14); }

        .feature-card.liquidity { border-color: rgba(56,189,248,.12); }
        .feature-card.stake { border-color: rgba(245,158,11,.12); }
        .feature-card.faucet { border-color: rgba(16,185,129,.12); }
        .feature-card.contact { border-color: rgba(217,70,239,.12); }

        .outline-btn, .text-link-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 44px;
          padding: 0 18px;
          border-radius: 10px;
          border: 1px solid rgba(83,112,255,.72);
          color: #edf1ff;
          background: rgba(12,21,48,.4);
          cursor: pointer;
        }

        .outline-btn:hover, .text-link-button:hover { background: rgba(65,80,255,.12); }

        .page-area {
          min-height: 560px;
          padding: 58px 0 28px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
        }

        .swap-card {
          position: relative;
          width: min(100%, 660px);
          padding: 24px;
          border-radius: 17px;
          border: 1px solid rgba(148,163,184,.15);
          background:
            linear-gradient(145deg, rgba(13,22,45,.92), rgba(7,13,29,.94));
          box-shadow: 0 25px 80px rgba(0,0,0,.26), inset 0 1px 0 rgba(255,255,255,.025);
          backdrop-filter: blur(18px);
        }

        .wide-card { width: min(100%, 720px); }
        .swap-card-compact { width: min(100%, 620px); }
        .swap-card h2 { margin: 5px 0 0; font-size: 25px; letter-spacing: -.5px; }

        .card-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 18px;
        }

        .card-description {
          color: var(--vx-muted);
          font-size: 14px;
          line-height: 1.6;
          margin: -2px 0 20px;
        }

        .accent-copy { margin: 7px 0 0; color: #37d6ab; font-size: 13px; }

        .btn-icon-only {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(148,163,184,.17);
          color: #a9b6d5;
          background: rgba(12,20,42,.68);
          border-radius: 50%;
          cursor: pointer;
        }

        .btn-icon-only:hover { color: white; border-color: rgba(116,92,255,.45); }

        .settings-popover {
          position: absolute;
          right: 24px;
          top: 72px;
          z-index: 10;
          width: 240px;
          padding: 13px;
          border: 1px solid rgba(148,163,184,.16);
          border-radius: 12px;
          background: #0b1328;
          box-shadow: 0 18px 45px rgba(0,0,0,.35);
        }

        .settings-popover div {
          display: flex;
          justify-content: space-between;
          padding: 8px 4px;
          font-size: 12px;
          color: #9da9c4;
        }

        .settings-popover strong { color: #eef2ff; }

        .token-box {
          padding: 17px 18px 12px;
          border-radius: 14px;
          border: 1px solid rgba(148,163,184,.13);
          background: rgba(6,13,30,.55);
        }

        .balance-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          color: #8793ae;
          font-size: 12px;
          margin-bottom: 8px;
        }

        .input-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .token-input {
          min-width: 0;
          flex: 1;
          border: 0;
          outline: 0;
          color: white;
          background: transparent;
          font-size: 30px;
          font-weight: 500;
          letter-spacing: -.7px;
        }

        .token-input::placeholder { color: #303b55; }

        .token-selector {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 128px;
          justify-content: center;
          padding: 8px 10px;
          border-radius: 12px;
          color: #f4f6ff;
          font-weight: 700;
          background: rgba(24,34,61,.78);
        }

        .card-mode-shell {
          width: min(100%, 660px);
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: stretch;
        }

        .swap-mode-shell { width: min(100%, 660px); }
        .compact-mode-shell { width: min(100%, 620px); }
        .liquidity-mode-shell { width: min(100%, 720px); }

        /* Keep the mode switch and its card on exactly the same left/right edges. */
        .card-mode-shell > .mode-toggle-row,
        .card-mode-shell > .swap-card {
          width: 100%;
          max-width: none;
          box-sizing: border-box;
        }

        .card-mode-shell > .swap-card.wide-card {
          width: 100%;
        }

        .mode-toggle-row {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          box-sizing: border-box;
          margin-bottom: 14px;
        }

        .mode-toggle-row .segmented-control {
          flex-shrink: 0;
        }

        .token-selector-select {
          position: relative;
          cursor: pointer;
          padding-right: 12px;
        }

        .token-select {
          appearance: none;
          -webkit-appearance: none;
          border: 0;
          outline: 0;
          background: transparent;
          color: #f4f6ff;
          font: inherit;
          font-weight: 700;
          min-width: 70px;
          padding-right: 20px;
          cursor: pointer;
        }

        .token-select,
        .token-selector select { color-scheme: dark; }

        .token-select option,
        .token-selector select option {
          color: #f4f6ff !important;
          background-color: #18223d !important;
        }

        .token-select option:checked,
        .token-selector select option:checked {
          color: #ffffff !important;
          background-color: #4c74ff !important;
        }

        .token-select-arrow {
          position: absolute;
          right: 9px;
          top: 50%;
          transform: translateY(-50%);
          color: #dbe3ff;
          pointer-events: none;
        }

        .token-logo {
          width: 34px;
          height: 34px;
          display: inline-grid;
          place-items: center;
          flex: 0 0 34px;
          border-radius: 50%;
          color: white;
          font-size: 15px;
          font-weight: 900;
          background: linear-gradient(145deg, #4c74ff, #7f46ff);
          box-shadow: 0 7px 20px rgba(76,116,255,.24);
        }

        .token-usdc { background: linear-gradient(145deg, #3c7cff, #6a58e8); }
        .token-arcg { background: linear-gradient(145deg, #18b99b, #36dcb3); }
        .token-lp { background: linear-gradient(145deg, #8b5cf6, #ec4899); }

        .input-footer { display: flex; justify-content: flex-end; margin-top: 7px; }

        .btn-max {
          border: 0;
          color: #7e95ff;
          background: transparent;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
        }

        .btn-max:hover { color: white; }

        .swap-arrow-wrap {
          height: 42px;
          display: flex;
          justify-content: center;
          align-items: center;
          margin: -1px 0;
          position: relative;
          z-index: 2;
        }

        .btn-switch-direction {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          border: 1px solid rgba(104,121,255,.28);
          color: #7890ff;
          background: #0a1329;
          cursor: pointer;
          box-shadow: 0 5px 22px rgba(0,0,0,.25);
        }

        .btn-switch-direction:hover { color: white; transform: rotate(180deg); }

        .details-container {
          margin-top: 12px;
          padding: 11px 13px;
          border-radius: 11px;
          border: 1px solid rgba(148,163,184,.09);
          background: rgba(255,255,255,.025);
        }

        .detail-title {
          color: #dce2f1;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .detail-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 5px 0;
          color: #7f8ba7;
          font-size: 12px;
        }

        .detail-value { color: #e5e9f5; text-align: right; }

        .gas-warning {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          margin-top: 12px;
          padding: 11px 12px;
          border: 1px solid rgba(245,158,11,.17);
          border-radius: 10px;
          color: #c7cddd;
          background: rgba(245,158,11,.055);
          font-size: 11px;
          line-height: 1.5;
        }

        .gas-warning svg { color: #fbbf24; flex: 0 0 auto; }
        .gas-warning a { color: #9ab0ff; text-decoration: none; }

        .btn-action, .btn-connect, .btn-reward, .btn-danger {
          min-height: 50px;
          width: 100%;
          margin-top: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 0;
          border-radius: 11px;
          color: white;
          font-weight: 750;
          font-size: 14px;
          cursor: pointer;
          background: linear-gradient(100deg, #3568ff, #a544ee);
          box-shadow: 0 12px 28px rgba(83,75,255,.19);
        }

        .btn-action:hover:not(:disabled), .btn-connect:hover:not(:disabled), .btn-reward:hover:not(:disabled) {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }

        .btn-action:disabled, .btn-connect:disabled, .btn-reward:disabled, .btn-danger:disabled {
          cursor: not-allowed;
          opacity: .52;
          filter: grayscale(.15);
          box-shadow: none;
        }

        .btn-connect { background: linear-gradient(100deg, #4b62ff, #9650ed); }
        .btn-reward { background: linear-gradient(100deg, #0ca77d, #18c69a); }
        .btn-danger { background: linear-gradient(100deg, #ef4444, #be3152); }

        .text-link-button {
          width: 100%;
          margin-top: 10px;
          background: transparent;
          border-color: transparent;
          color: #93a4ff;
        }

        .segmented-control {
          display: flex;
          padding: 3px;
          border-radius: 9px;
          background: rgba(255,255,255,.035);
          border: 1px solid rgba(148,163,184,.12);
        }

        .segmented-control button {
          padding: 7px 12px;
          border: 0;
          border-radius: 7px;
          color: #8994ac;
          background: transparent;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
        }

        .segmented-control button.selected { color: white; background: rgba(99,102,241,.22); }

        .plus-divider { display: flex; justify-content: center; align-items: center; height: 30px; color: #65718b; }

        .pool-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin-top: 22px;
          padding-top: 17px;
          border-top: 1px solid var(--vx-border-light);
        }

        .pool-stat {
          padding: 12px;
          border: 1px solid rgba(148,163,184,.09);
          border-radius: 11px;
          background: rgba(255,255,255,.025);
        }

        .pool-stat.full { grid-column: 1 / -1; }
        .pool-stat span { display: block; color: #7e89a2; font-size: 11px; margin-bottom: 5px; }
        .pool-stat strong { font-size: 16px; }

        /* ============================================================
           STABLE DESKTOP CARD HEIGHTS
           Layout only — keeps cards from growing when conditional
           details (Rate / Price Impact / LP Fee) appear.
           No React/business logic is changed.
           ============================================================ */
        @media (min-width: 821px) {
          /* Full Swap: reserve space for the swap details permanently. */
          .swap-mode-shell > .swap-card {
            height: 590px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .swap-mode-shell > .swap-card .details-container {
            flex: 0 0 84px;
            box-sizing: border-box;
          }

          .swap-mode-shell > .swap-card > .btn-action {
            margin-top: auto;
          }

          /* Official/Mock liquidity: keep the main card visually
             compact and stable instead of letting content determine height. */
          .liquidity-mode-shell > .swap-card {
            /* Keep the normal card compact, but allow it to grow when the
               conditional Estimated LP section appears. This prevents the
               pool statistics / Total LP Shares row from being clipped. */
            min-height: 590px;
            height: auto;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            overflow: visible;
          }

          .liquidity-mode-shell > .swap-card .pool-stats {
            margin-top: auto;
          }
        }

        .stake-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 13px;
        }

        .stake-stats > div {
          padding: 14px;
          border-radius: 11px;
          border: 1px solid rgba(148,163,184,.10);
          background: rgba(255,255,255,.035);
        }

        .stake-stats span { display: block; color: #7d89a2; font-size: 11px; margin-bottom: 6px; }
        .stake-stats strong { font-size: 17px; }

        .two-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
        }

        .two-buttons .btn-connect, .two-buttons .btn-danger { margin-top: 12px; }

        .success-panel {
          margin-top: 13px;
          padding: 12px;
          border: 1px solid rgba(16,185,129,.28);
          border-radius: 10px;
          background: rgba(6,78,59,.18);
        }

        .success-panel div { display: flex; gap: 7px; align-items: center; color: #42e0b1; font-weight: 700; font-size: 12px; }
        .success-panel span { display: block; color: #8995ae; font-size: 10px; margin: 5px 0; }
        .success-panel a { display: inline-flex; align-items: center; gap: 4px; color: #7eb8ff; font-size: 10px; text-decoration: none; }

        .zero-safe-note {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 6px;
          color: #65718a;
          font-size: 10px;
          margin-top: 9px;
        }

        .zero-safe-note svg { color: #32cfa5; }

        .faucet-list { display: flex; flex-direction: column; gap: 10px; }

        .faucet-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px;
          border-radius: 12px;
          border: 1px solid rgba(148,163,184,.11);
          background: rgba(255,255,255,.025);
        }

        .faucet-row .btn-connect { width: auto; min-width: 150px; margin: 0; padding: 0 15px; }

        .faucet-token { display: flex; align-items: center; gap: 10px; }
        .faucet-token strong { display: block; font-size: 14px; }
        .faucet-token span { display: block; margin-top: 3px; color: #7f8ba4; font-size: 11px; }

        .info-panel, .community-note {
          display: flex;
          gap: 10px;
          margin-top: 14px;
          padding: 13px;
          border-radius: 11px;
          border: 1px solid rgba(96,165,250,.12);
          background: rgba(59,130,246,.045);
          color: #a7b2ca;
          font-size: 11px;
          line-height: 1.55;
        }

        .info-panel > svg, .community-note > svg { color: #7ea6ff; flex: 0 0 auto; }
        .info-panel strong { color: #e6eafa; }
        .info-panel p { margin: 4px 0; }
        .info-panel a { display: inline-flex; align-items: center; gap: 4px; color: #91a8ff; text-decoration: none; }

        .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

        .contact-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px;
          border: 1px solid rgba(148,163,184,.11);
          border-radius: 12px;
          text-decoration: none;
          background: rgba(255,255,255,.025);
        }

        .contact-link:hover { border-color: rgba(168,85,247,.34); background: rgba(168,85,247,.05); }
        .contact-link > svg:first-child { color: #b879ff; }
        .contact-link div { flex: 1; }
        .contact-link strong { display: block; font-size: 13px; }
        .contact-link span { display: block; color: #7d89a3; font-size: 11px; margin-top: 3px; }

        /* Transaction status belongs directly under the active main card.
           Center it in the same content area on every tab. */
        .status-stack {
          width: min(100%, 720px);
          margin: 12px auto 0;
          align-self: center;
        }

        /* On Home, the transaction banner belongs directly below the hero copy
           and stays centered under the heading/description area. */
        .hero-copy > .status-stack {
          width: min(100%, 620px);
          margin: 24px 0 0;
          align-self: flex-start;
        }

        .status-box {
          padding: 13px 15px;
          border: 1px solid rgba(90,108,255,.22);
          border-radius: 11px;
          background: rgba(34,48,98,.16);
        }

        .status-box.success { border-color: rgba(16,185,129,.28); background: rgba(16,185,129,.05); }
        .status-box.error { border-color: rgba(239,68,68,.28); background: rgba(239,68,68,.05); }
        .status-header { display: flex; align-items: center; gap: 7px; color: #90a2ff; font-size: 12px; font-weight: 700; }
        .status-box.success .status-header { color: #34d399; }
        .status-box.error .status-header { color: #fb7185; }
        .status-body { color: #8b97af; font-size: 11px; line-height: 1.5; margin-top: 6px; }
        .status-body a { display: inline-flex; align-items: center; gap: 4px; margin-left: 7px; color: #86a8ff; text-decoration: none; }

        .balance-dashboard {
          width: min(100%, 660px);
          margin: 0 auto 34px;
          padding: 16px;
          border-radius: 14px;
          border: 1px dashed rgba(148,163,184,.15);
          background: rgba(5,10,23,.45);
        }

        .balance-dashboard h3 { display: flex; align-items: center; gap: 7px; margin: 0 0 10px; font-size: 13px; color: #b9c3d9; }
        .balance-lines { display: grid; gap: 7px; }
        .balance-lines div { display: flex; justify-content: space-between; gap: 12px; font-size: 11px; }
        .balance-lines span { color: #77839e; }
        .balance-lines strong { color: #e3e8f4; }

        .app-footer {
          flex-shrink: 0;
          margin-top: 15px;
          border-top: 1px solid rgba(148,163,184,.11);
          padding: 28px 4.5%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          color: #77839d;
        }

        .footer-brand { display: flex; align-items: center; gap: 10px; }
        .footer-brand .vx-brand-mark { width: 34px; height: 34px; font-size: 21px; }
        .footer-brand strong { color: #f2f4fb; font-size: 16px; }
        .footer-brand span { margin-left: 8px; font-size: 11px; }
        .footer-socials { display: flex; align-items: center; gap: 14px; }
        .footer-socials a { color: #8f9ab4; }
        .footer-socials a:hover { color: white; }
        .footer-copy { font-size: 11px; }

        .welcome-card, .wrong-network {
          width: min(100%, 620px);
          text-align: center;
          padding: 42px 30px;
        }

        .welcome-icon {
          width: 64px;
          height: 64px;
          display: grid;
          place-items: center;
          margin: 0 auto 16px;
          border-radius: 18px;
          color: white;
          background: linear-gradient(145deg, #4c6fff, #9c3cf3);
          box-shadow: 0 15px 40px rgba(96,77,255,.24);
        }

        .welcome-card h2, .wrong-network h2 { margin: 0 0 9px; font-size: 27px; }
        .welcome-card p, .wrong-network p { color: #9ca8c1; font-size: 13px; line-height: 1.65; margin: 0 auto 20px; max-width: 470px; }

        .wrong-network .welcome-icon { background: rgba(239,68,68,.13); color: #fb7185; box-shadow: none; }

        .mini-network {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #aab5cd;
          font-size: 12px;
          margin-top: 10px;
        }

        .spin { animation: vxspin .9s linear infinite; }
        @keyframes vxspin { to { transform: rotate(360deg); } }

        @media (max-width: 1100px) {
          .vx-nav { gap: 18px; }
          .vx-brand { min-width: auto; }
          .feature-cards { grid-template-columns: repeat(3, 1fr); }
          .hero { grid-template-columns: 1fr; gap: 25px; }
          .hero-copy { text-align: center; }
          .hero-description { margin-left: auto; margin-right: auto; }
          .hero-features { justify-content: center; }
          .hero-swap { width: min(100%, 660px); margin: 0 auto; }
          .glow-orb { display: none; }
        }

        @media (max-width: 820px) {
          .swap-mode-shell > .swap-card,
          .liquidity-mode-shell > .swap-card {
            height: auto;
            min-height: 0;
            overflow: visible;
          }

          .vx-header { height: auto; min-height: 74px; padding: 12px 4%; flex-wrap: wrap; }
          .vx-nav {
            position: static;
            transform: none;
            height: auto;
            order: 3;
            flex-basis: 100%;
            width: auto;
            max-width: none;
            overflow-x: auto;
            justify-content: flex-start;
          }
          .vx-nav button { padding: 10px 4px 14px; white-space: nowrap; }
          .vx-nav button.active::after { bottom: 5px; }
          .vx-header-actions { margin-left: auto; }
          .network-select { min-width: 112px; }
          .vx-wallet-button { min-width: 145px; }
          .hero { padding-top: 46px; min-height: 600px; }
          .page-area { min-height: 560px; }
          .hero-title { font-size: 47px; letter-spacing: -2px; }
          .feature-cards { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 560px) {
          .vx-header-actions .network-select { display: none; }
          .vx-wallet-button { min-width: 132px; font-size: 13px; }
          .vx-brand-name { font-size: 20px; }
          .vx-brand-mark { width: 37px; height: 37px; }
          .hero-title { font-size: 39px; }
          .hero-description { font-size: 15px; }
          .hero-features { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
          .feature-cards { grid-template-columns: 1fr; }
          .feature-card { min-height: 190px; }
          .swap-card { padding: 18px; border-radius: 14px; }
          .page-area { min-height: 520px; padding-top: 38px; }
          .token-input { font-size: 25px; }
          .token-selector { min-width: 112px; }
          .two-buttons, .contact-grid { grid-template-columns: 1fr; }
          .faucet-row { align-items: flex-start; flex-direction: column; }
          .faucet-row .btn-connect { width: 100%; }
          .pool-stats { grid-template-columns: 1fr; }
          .pool-stat.full { grid-column: auto; }
          .app-footer { flex-direction: column; text-align: center; }
          .footer-brand { flex-direction: column; }
          .footer-brand span { margin: 0; }
        }
      `}</style>

      <header className="vx-header">
        <button className="vx-brand" onClick={() => goTo('home')} aria-label="VeloxSwap Home">
          <span className="vx-brand-mark">V</span>
          <span className="vx-brand-name">Velox<span>Swap</span></span>
        </button>

        <nav className="vx-nav" aria-label="Main navigation">
          <button className={activeTab === 'home' ? 'active' : ''} onClick={() => goTo('home')}>Home</button>
          <button className={activeTab === 'swap' ? 'active' : ''} onClick={() => goTo('swap')}>Swap</button>
          <button className={activeTab === 'liquidity' ? 'active' : ''} onClick={() => goTo('liquidity')}>Liquidity</button>
          <button className={activeTab === 'stake' ? 'active' : ''} onClick={() => goTo('stake')}>Stake</button>
          <button className={activeTab === 'faucet' ? 'active' : ''} onClick={() => goTo('faucet')}>Faucet</button>
          <button className={activeTab === 'contact' ? 'active' : ''} onClick={() => goTo('contact')}>Contact</button>
        </nav>

        <div className="vx-header-actions">
          <button
            className="network-select"
            onClick={isWrongNetwork ? handleSwitchNetwork : undefined}
            title={isWrongNetwork ? 'Switch to Arc Testnet' : 'Current network'}
          >
            <span className={`network-dot ${isWrongNetwork ? 'wrong' : ''}`} />
            <span>{isWrongNetwork ? 'Wrong Network' : 'Arc Testnet'}</span>
            <ChevronDown size={15} />
          </button>

          <WalletConnectButton />
        </div>
      </header>

      <main className="vx-main">
        {activeTab === 'home' && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="hero-kicker">DECENTRALIZED EXCHANGE</div>
                <h1 className="hero-title">
                  Trade. Earn.<br />
                  <span className="gradient-title">Grow Together.</span>
                </h1>
                <p className="hero-description">
                  VeloxSwap is a decentralized exchange to trade, provide liquidity,
                  stake and explore the ecosystem with low fees and full transparency.
                </p>
                <div className="hero-features">
                  <div className="hero-feature"><ShieldCheck size={22} /> Secure</div>
                  <div className="hero-feature"><Zap size={22} /> Low Fees</div>
                  <div className="hero-feature"><Users size={22} /> Community Driven</div>
                </div>

                {isConnected && !isWrongNetwork && renderStatus()}
              </div>

              <div className="hero-swap">
                <div className="glow-orb" />
                {isWrongNetwork ? (
                  <div className="swap-card wrong-network">
                    <div className="welcome-icon"><AlertCircle size={28} /></div>
                    <h2>Wrong Network</h2>
                    <p>This application runs on Arc Testnet. Switch your wallet network to continue.</p>
                    <button className="btn-action" onClick={handleSwitchNetwork}>Switch to Arc Testnet</button>
                  </div>
                ) : !isConnected ? (
                  <div className="swap-card welcome-card">
                    <div className="welcome-icon"><WalletCards size={29} /></div>
                    <h2>Welcome to VeloxSwap</h2>
                    <p>Connect your Web3 wallet to start swapping, providing liquidity, staking and claiming test tokens.</p>
                    <button className="btn-action" onClick={handleConnectWallet}>Connect Wallet <ArrowRight size={17} /></button>
                    <div className="mini-network"><span className="network-dot" /> Arc Testnet</div>
                  </div>
                ) : renderSwapCard(true)}
              </div>
            </section>

            <section className="feature-cards">
              <div className="feature-card">
                <div className="feature-icon"><ArrowDownUp size={23} /></div>
                <h3>Swap</h3>
                <p>Instantly swap tokens with the best available pool rate.</p>
                <button className="outline-btn" onClick={() => goTo('swap')}>Swap Now <ArrowRight size={16} /></button>
              </div>

              <div className="feature-card liquidity">
                <div className="feature-icon"><Droplet size={23} /></div>
                <h3>Liquidity</h3>
                <p>Provide liquidity and earn a share of trading fees.</p>
                <button className="outline-btn" onClick={() => goTo('liquidity')}>Add Liquidity <ArrowRight size={16} /></button>
              </div>

              <div className="feature-card stake">
                <div className="feature-icon green"><Coins size={23} /></div>
                <h3>Stake</h3>
                <p>Stake your vUsdc and earn VXC rewards over time.</p>
                <button className="outline-btn" onClick={() => goTo('stake')}>Start Staking <ArrowRight size={16} /></button>
              </div>

              <div className="feature-card faucet">
                <div className="feature-icon green"><Gift size={23} /></div>
                <h3>Faucet</h3>
                <p>Get free test tokens to explore VeloxSwap on testnet.</p>
                <button className="outline-btn" onClick={() => goTo('faucet')}>Get Tokens <ArrowRight size={16} /></button>
              </div>

              <div className="feature-card contact">
                <div className="feature-icon pink"><Mail size={23} /></div>
                <h3>Contact</h3>
                <p>Get in touch with the team or send feedback and ideas.</p>
                <button className="outline-btn" onClick={() => goTo('contact')}>Contact Us <ArrowRight size={16} /></button>
              </div>
            </section>
          </>
        )}

        {activeTab !== 'home' && (
          <section className="page-area">
            {isWrongNetwork ? (
              <div className="swap-card wrong-network">
                <div className="welcome-icon"><AlertCircle size={28} /></div>
                <h2>Wrong Network</h2>
                <p>This application only runs on Arc Testnet. Switch your wallet network to continue.</p>
                <button className="btn-action" onClick={handleSwitchNetwork}>Switch to Arc Testnet</button>
              </div>
            ) : !isConnected ? (
              <div className="swap-card welcome-card">
                <div className="welcome-icon"><WalletCards size={29} /></div>
                <h2>Connect Your Wallet</h2>
                <p>Connect your Web3 wallet to use {activeTab === 'contact' ? 'the VeloxSwap ecosystem' : `${activeTab} features`}.</p>
                <button className="btn-action" onClick={handleConnectWallet}>Connect Wallet <ArrowRight size={17} /></button>
              </div>
            ) : (
              <>
                {activeTab === 'swap' && renderSwapCard(false)}
                {activeTab === 'liquidity' && renderLiquidityCard()}
                {activeTab === 'stake' && renderStakeCard()}
                {activeTab === 'faucet' && renderFaucetCard()}
                {activeTab === 'contact' && renderContactCard()}
              </>
            )}
          </section>
        )}

        {isConnected && !isWrongNetwork && activeTab !== 'contact' && activeTab !== 'home' && renderStatus()}

        {isConnected && !isWrongNetwork && activeTab !== 'contact' && activeTab !== 'home' && (
          <div className="balance-dashboard">
            <h3><TrendingUp size={15} /> Arc Wallet Balances</h3>
            <div className="balance-lines">
              <div><span>Native Gas Balance</span><strong>{nativeGasBalance} USDC</strong></div>
              <div><span>ERC-20 vUsdc</span><strong>{erc20UsdcBalance} vUsdc</strong></div>
              <div><span>ARCG</span><strong>{arcgBalance} ARCG</strong></div>
              <div><span>Official USDC</span><strong>{officialBalanceFor(CONTRACT_ADDRESSES.OFFICIAL_USDC, 6)} USDC</strong></div>
              <div><span>EURC</span><strong>{officialBalanceFor(CONTRACT_ADDRESSES.EURC, 6)} EURC</strong></div>
              <div><span>cirBTC</span><strong>{officialBalanceFor(CONTRACT_ADDRESSES.CIRBTC, 8)} cirBTC</strong></div>
              <div><span>LP Share</span><strong>{lpBalance} ARC-LP</strong></div>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-brand">
          <span className="vx-brand-mark">V</span>
          <div>
            <strong>Velox<span style={{ color: '#9b59ff' }}>Swap</span></strong>
            <span>Trade • Earn • Build Together</span>
          </div>
        </div>

        <div className="footer-socials">
          <a href="https://x.com/Scarfacedrop" target="_blank" rel="noopener noreferrer" aria-label="X"><MessageCircle size={17} /></a>
          <a href="https://github.com/prafoos" target="_blank" rel="noopener noreferrer" aria-label="GitHub"><Github size={17} /></a>
        </div>

        <div className="footer-copy">© 2026 VeloxSwap. All rights reserved.</div>
      </footer>
    </div>
  );
}

