import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { arcTestnet } from './chains/arcTestnet';
import { createConfig, http, WagmiProvider } from 'wagmi';
import {
  metaMask,
  injected,
  walletConnect,
} from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;

const optionalWalletConnect = walletConnectProjectId
  ? [
      walletConnect({
        projectId: walletConnectProjectId,
        showQrModal: true,
      }),
    ]
  : [];

export const config = createConfig({
  // Keep EIP-6963 discovery enabled so installed Rabby, Phantom, OKX,
  // SubWallet, Brave Wallet, etc. can appear as separate wallet choices.
  multiInjectedProviderDiscovery: true,
  chains: [arcTestnet],
  connectors: [
    // Use wagmi's dedicated MetaMask connector for reliable MetaMask discovery.
    metaMask(),
    // Generic EIP-1193/EIP-6963 connector for Rabby, Phantom, OKX,
    // Coinbase Wallet, SubWallet, Brave Wallet and other injected wallets.
    injected({ shimDisconnect: true }),
    ...optionalWalletConnect,
  ],
  transports: {
    [arcTestnet.id]: http(),
  },
});

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
