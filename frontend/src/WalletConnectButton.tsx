import { useAccount, useDisconnect, useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

export function WalletConnectButton() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect } = useConnect();

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  const handleConnect = () => {
    // window.ethereum ഉണ്ടോ എന്ന് ഉറപ്പുവരുത്തുന്നു
    if (typeof window !== 'undefined' && window.ethereum) {
      connect({ connector: injected() });
    } else {
      alert('MetaMask അല്ലെങ്കിൽ മറ്റെതെങ്കിലും Web3 Wallet ബ്രൗസറിൽ ഇൻസ്റ്റാൾ ചെയ്തിട്ടുണ്ടെന്ന് ഉറപ്പുവരുത്തുക!');
    }
  };

  if (isConnected) {
    return (
      <button
        onClick={() => disconnect()}
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
        <span style={{ fontSize: '11px', color: '#ef4444', opacity: 0.8 }}>
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