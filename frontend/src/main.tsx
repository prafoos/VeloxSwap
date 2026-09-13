import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { arcTestnet } from './chains/arcTestnet';
import { createConfig, http, WagmiProvider } from 'wagmi';
import {
  injected,
  walletConnect,
} from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

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
    // Explicit MetaMask target fixes MetaMask selection while keeping the
    // generic injected connector available for the long tail of wallets.
    injected({
      target: 'metaMask',
      shimDisconnect: true,
    }),
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
        <RainbowKitProvider theme={darkTheme()}>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
