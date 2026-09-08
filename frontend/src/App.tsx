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

  const [activeTab, setActiveTab] = useState<'swap' | 'liquidity' | 'stake' | 'faucet'>('swap');
  const [stakeTxHash, setStakeTxHash] = useState<string>('');

  useEffect(() => {
    if (!stakeTxHash) return;
    const timer = setTimeout(() => {
      setStakeTxHash('');
    }, 10000);
    return () => clearTimeout(timer);
  }, [stakeTxHash]); 

  const isWrongNetwork = isConnected && chainId !== arcTestnet.id;

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
  const { data: arcgRaw, refetch: refetchArcg, isLoading: isArcgLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.ARCG,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10000,
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
      refetchInterval: 2000,
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
    address: CONTRACT_ADDRESSES.USDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESSES.STAKING as `0x${string}`] : undefined,
    query: { enabled: !!address },
  });

  const amountParsed = stakeAmount && !isNaN(parseFloat(stakeAmount)) ? parseUnits(stakeAmount, 6) : 0n;

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
          address: CONTRACT_ADDRESSES.USDC as `0x${string}`,
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
    query: { refetchInterval: 10000 },
  });

  const reserveUsdc = reservesData ? reservesData[0] : 0n;
  const reserveArcg = reservesData ? reservesData[1] : 0n;

  const reserveUsdcFormatted = parseFloat(formatUnits(reserveUsdc, 6)).toFixed(2);
  const reserveArcgFormatted = parseFloat(formatUnits(reserveArcg, 18)).toFixed(2);

  const hasReservesLoaded = !isReservesLoading && reservesData !== undefined;
  const hasLiquidity = hasReservesLoaded && Number(reserveUsdc) > 0 && Number(reserveArcg) > 0;

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
        refetchRewards()
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

  useEffect(() => {
    resetTx();
  }, [activeTab]);

  // SWAP
  const [swapDirection, setSwapDirection] = useState<'usdc-to-arcg' | 'arcg-to-usdc'>('usdc-to-arcg');
  const [swapInput, setSwapInput] = useState<string>('');
  const [swapRawInput, setSwapRawInput] = useState<bigint | null>(null);
  const [swapOutput, setSwapOutput] = useState<string>('0');
  const [priceImpact, setPriceImpact] = useState<string>('0.00');

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

  const tokenInAddress = swapDirection === 'usdc-to-arcg' ? CONTRACT_ADDRESSES.USDC : CONTRACT_ADDRESSES.ARCG;
  const tokenInDecimals = swapDirection === 'usdc-to-arcg' ? 6 : 18;

  const { data: swapAllowanceRaw, refetch: refetchSwapAllowance } = useReadContract({
    address: tokenInAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESSES.POOL] : undefined,
  });

  const parsedSwapInput = swapRawInput ?? (swapInput && !isNaN(parseFloat(swapInput)) ? parseUnits(swapInput, tokenInDecimals) : 0n);
  const needsSwapApproval = swapAllowanceRaw !== undefined && parsedSwapInput > 0n && swapAllowanceRaw < parsedSwapInput;

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

  const handleSwap = async () => {
    if (parsedSwapInput === 0n) return;
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
    if (parsedLiqUsdc === 0n) return;
    resetTx();
    writeContract({
      address: CONTRACT_ADDRESSES.USDC,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACT_ADDRESSES.POOL, parsedLiqUsdc],
    });
  };

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
      setSwapInput('');
      setStakeAmount('');
      setSwapRawInput(null); 
      setLiqUsdcInput('');
      setLiqArcgInput('');
    }
  }, [isTxSuccess]); 

  // FAUCET
  const handleMintTokens = async () => {  
    resetTx();
    writeContract({
      address: CONTRACT_ADDRESSES.USDC,
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

  const currentTokenInLabel = swapDirection === 'usdc-to-arcg' ? 'vUSDC' : 'ARCG';
  const currentTokenOutLabel = swapDirection === 'usdc-to-arcg' ? 'ARCG' : 'vUSDC';
  const currentBalanceIn = swapDirection === 'usdc-to-arcg' ? erc20UsdcBalance : arcgBalance;
  const currentBalanceOut = swapDirection === 'usdc-to-arcg' ? arcgBalance : erc20UsdcBalance;

  return (
    <div className="app-container">
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

      <main className="main-content">
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
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            {activeTab === 'swap' && (
              <div className="swap-card">
                <div className="card-title-row">
                  <h2>Swap Tokens</h2>
                  <button className="btn-icon-only" onClick={refreshAllBalances} title="Refresh reserves">
                    <RefreshCw size={16} />
                  </button>
                </div>

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
                      onChange={(e) => {
                        const val = e.target.value;
                        setSwapInput(val);
                        try {
                          setSwapRawInput(val ? parseUnits(val, tokenInDecimals) : null);
                        } catch {
                          setSwapRawInput(null);
                        }
                      }}
                    />
                    <div className="token-selector">
                      <span className="token-logo">{swapDirection === 'usdc-to-arcg' ? '💵' : '🪙'}</span>
                      <span>{currentTokenInLabel}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <button 
                      className="btn-max" 
                      onClick={() => {
                        const rawBal = swapDirection === 'usdc-to-arcg' ? erc20UsdcRaw : arcgRaw;
                        if (!rawBal) return;

                        setSwapRawInput(BigInt(rawBal as any));
                        const formatted = formatUnits(BigInt(rawBal as any), tokenInDecimals);
                        const parts = formatted.split('.');
                        const truncated = parts[1] ? `${parts[0]}.${parts[1].slice(0, 4)}` : parts[0];
                        setSwapInput(truncated);
                      }}
                    >
                      Max
                    </button>
                  </div>
                </div>

                <div className="arrow-divider">
                  <button 
                    className="btn-switch-direction" 
                    onClick={() => {
                      setSwapDirection(prev => prev === 'usdc-to-arcg' ? 'arcg-to-usdc' : 'usdc-to-arcg');
                      setSwapInput('');
                      setSwapRawInput(null);
                      setSwapOutput('0');
                    }}
                  >
                    <ArrowDownUp size={16} />
                  </button>
                </div>

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

                {/* Gas Warning Container */}
                {parseFloat(nativeGasBalance) < 0.1 && (
                  <div className="gas-warning">
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <div>
                      Your Gas Balance is low (<strong>{nativeGasBalance} USDC</strong>). You pay transaction gas fees in native USDC on Arc. Request gas from the <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">Circle Faucet <ExternalLink size={10} style={{ display: 'inline' }} /></a>.
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '1.25rem' }}>
                  {needsSwapApproval ? (
                    <button 
                      className="btn-action" 
                      onClick={handleApproveSwap} 
                      disabled={isTxPending || isTxConfirming}
                    >
                      {isTxPending || isTxConfirming ? <RefreshCw size={18} className="spin" /> : null}
                      Approve {currentTokenInLabel}
                    </button>
                  ) : (
                    <button 
                      className="btn-action" 
                      onClick={handleSwap} 
                      disabled={!swapInput || swapOutput === '0' || swapOutput === 'No Liquidity' || isTxPending || isTxConfirming || parseFloat(currentBalanceIn) < parseFloat(swapInput)}
                    >
                      {isTxPending || isTxConfirming ? <RefreshCw size={18} className="spin" /> : null}
                      {parseFloat(currentBalanceIn) < parseFloat(swapInput) ? 'Insufficient Balance' : 'Swap Assets'}
                    </button>
                  )}
                </div>
              </div>
            )}

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
                  <div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                      Deposit equal values of vUSDC and ARCG to earn 0.3% fees on swaps.
                    </p>

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
                          onChange={(e) => handleLiqUsdcChange(e.target.value)} 
                        />  
                        <div className="token-selector">💵 vUSDC</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0' }}>
                      <Plus size={16} color="var(--text-secondary)" />
                    </div>

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
                          onChange={(e) => handleLiqArcgChange(e.target.value)}
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

            {activeTab === 'stake' && (
              <div className="swap-card">
                <div className="card-title-row" style={{ display: 'block' }}>
                  <h2>vUSDC Staking</h2>
                  <span style={{ fontSize: '0.85rem', color: '#34d399', marginTop: '4px', display: 'block' }}>
                    3% APY Staking Reward • Earn VXC token rewards by staking your vUSDC
                  </span> 
                </div>

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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    className="btn-connect"
                    onClick={handleApproveAndStake}
                    disabled={
                      isProcessing ||
                      !stakeAmount ||
                      Number(stakeAmount) <= 0 ||
                      Number(stakeAmount) > Number(erc20UsdcBalance === 'Loading...' ? 0 : erc20UsdcBalance)
                    }
                    style={{
                      background:
                        Number(stakeAmount) > Number(erc20UsdcBalance === 'Loading...' ? 0 : erc20UsdcBalance)
                          ? 'rgb(75, 85, 99)'
                          : isProcessing
                          ? '#6b7280'
                          : '#8b5cf6',
                      fontSize: '0.85rem',
                      padding: '0.6rem 0.2rem',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      textAlign: 'center',
                      width: '100%',
                      cursor:
                        Number(stakeAmount) > Number(erc20UsdcBalance === 'Loading...' ? 0 : erc20UsdcBalance) || isProcessing
                          ? 'not-allowed'
                          : 'pointer',
                      opacity:
                        Number(stakeAmount) > Number(erc20UsdcBalance === 'Loading...' ? 0 : erc20UsdcBalance) || isProcessing
                          ? 0.6
                          : 1,
                    }}
                  >
                    {isProcessing
                      ? 'Processing...'
                      : Number(stakeAmount) > Number(erc20UsdcBalance === 'Loading...' ? 0 : erc20UsdcBalance)
                      ? 'Insufficient Balance'
                      : 'Approve & Stake'}
                  </button>

                  <button
                    className="btn-connect"
                    onClick={handleWithdraw}
                    disabled={
                      isUnstaking || 
                      !stakeAmount || 
                      Number(stakeAmount) <= 0 || 
                      Number(stakeAmount) > Number(stakedBalanceFormatted)
                    }
                    style={{
                      background: (Number(stakeAmount) > Number(stakedBalanceFormatted)) 
                        ? 'rgb(75, 85, 99)' 
                        : '#ef4444',
                      fontSize: '0.85rem',
                      padding: '0.6rem 0.2rem',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      textAlign: 'center',
                      width: '100%',
                      cursor: (Number(stakeAmount) > Number(stakedBalanceFormatted) || isUnstaking) 
                        ? 'not-allowed' 
                        : 'pointer',
                      opacity: (Number(stakeAmount) > Number(stakedBalanceFormatted) || isUnstaking) 
                        ? 0.6 
                        : 1,
                    }}
                  >
                    {isUnstaking 
                      ? 'Processing...' 
                      : (Number(stakeAmount) > Number(stakedBalanceFormatted)) 
                        ? 'Insufficient Balance' 
                        : 'Unstake'}
                  </button>
                </div>

                <div style={{ width: '100%', marginTop: '0.75rem' }}>
                  <button
                    className="btn-connect"
                    onClick={handleClaim}
                    disabled={!earnedRewardFormatted || Number(earnedRewardFormatted) <= 0}
                    style={{
                      width: '100%',
                      background: Number(earnedRewardFormatted) <= 0 ? 'rgb(75, 85, 99)' : '#10b981',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      textAlign: 'center',
                      padding: '0.6rem 0.2rem',
                      fontSize: '0.85rem',
                      cursor: Number(earnedRewardFormatted) <= 0 ? 'not-allowed' : 'pointer',
                      opacity: Number(earnedRewardFormatted) <= 0 ? 0.6 : 1,
                    }}
                  >
                    Claim VXC Rewards
                  </button>
                </div> 

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