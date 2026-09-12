import { useAccount, useDisconnect } from 'wagmi';

export function WalletConnectButton() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  const handleConnect = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      } else {
        alert('MetaMask or another Web3 extension is required.');
      }
    } catch (e) {
      console.error('Wallet connection failed', e);
    }
  };

  const handleDisconnect = () => {
    // Let Wagmi disconnect the active connection.
    disconnect();
  };

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
          padding: '8px 16px',
          borderRadius: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
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
      onClick={handleConnect}
      type="button"
      className="btn-connect"
      style={{
        background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
        border: 'none',
        color: '#ffffff',
        padding: '10px 20px',
        borderRadius: '12px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '600',
        boxShadow: '0 4px 14px rgba(124, 58, 237, 0.4)',
      }}
    >
      Connect Wallet
    </button>
  );
}
