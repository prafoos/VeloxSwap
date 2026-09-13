import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { arcTestnet } from './chains/arcTestnet';
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { createConfig, http, injected, WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as
  | string
  | undefined;

// Use RainbowKit's full native wallet list when WalletConnect is configured.
// If the project id is not present, keep the app working with injected wallets
// instead of crashing the whole app during startup.
export const config = walletConnectProjectId
  ? getDefaultConfig({
      appName: 'VeloxSwap',
      projectId: walletConnectProjectId,
      chains: [arcTestnet],
      multiInjectedProviderDiscovery: true,
      transports: {
        [arcTestnet.id]: http(),
      },
    })
  : createConfig({
      multiInjectedProviderDiscovery: true,
      chains: [arcTestnet],
      connectors: [injected({ shimDisconnect: true })],
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
