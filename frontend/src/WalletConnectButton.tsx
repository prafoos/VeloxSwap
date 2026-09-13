import { useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';

type WalletConnectButtonProps = {
  /** Use the larger action-button appearance used by the page welcome cards. */
  variant?: 'default' | 'action';
};

const WALLET_MODAL_EVENT = 'veloxswap:open-wallet-modal';

export function WalletConnectButton({ variant = 'default' }: WalletConnectButtonProps) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  useEffect(() => {
    const openModal = () => {
      openConnectModal?.();
    };

    window.addEventListener(WALLET_MODAL_EVENT, openModal);
    return () => window.removeEventListener(WALLET_MODAL_EVENT, openModal);
  }, [openConnectModal]);

  const handleOpen = () => {
    openConnectModal?.();
  };

  const handleDisconnect = () => {
    disconnect();
  };

  // RainbowKit owns the wallet-selection modal.
  // Do not recreate the wallet modal here.
  if (isConnected) {
    return (
      <button
        onClick={handleDisconnect}
        type="button"
        className="btn-connect"
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          color: '#ffffff',
          padding: variant === 'action' ? '12px 20px' : '8px 16px',
          borderRadius: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: variant === 'action' ? '15px' : '14px',
          fontWeight: '600',
        }}
      >
        <span>{truncatedAddress}</span>
        <span style={{ fontSize: '11px', color: '#ef4444', opacity: 0.9 }}>
          (Disconnect)
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={handleOpen}
      type="button"
      className="btn-connect"
      style={
        variant === 'action'
          ? {
              width: '100%',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
              border: 'none',
              color: '#ffffff',
              padding: '13px 20px',
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '15px',
              fontWeight: '700',
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.25)',
            }
          : {
              background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
              border: 'none',
              color: '#ffffff',
              padding: '10px 20px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
            }
      }
    >
      Connect Wallet
    </button>
  );
}
