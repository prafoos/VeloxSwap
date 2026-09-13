import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

type WalletConnectButtonProps = {
  /** Use the larger action-button appearance used by the page welcome cards. */
  variant?: 'default' | 'action';
};

const WALLET_MODAL_EVENT = 'veloxswap:open-wallet-modal';

function getWalletInitial(name: string) {
  const clean = name.trim();
  return clean ? clean.charAt(0).toUpperCase() : 'W';
}

function detectMobileViewport() {
  if (typeof window === 'undefined') return false;

  // Use several signals because Android Chrome can report a desktop-style UA
  // when "Desktop site" is enabled. The viewport signal is the primary one.
  const viewportIsNarrow = window.innerWidth <= 1100;
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const mobileUAData = Boolean((navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile);
  const touchDevice = navigator.maxTouchPoints > 0;
  const smallScreen = Math.min(window.screen.width, window.screen.height) <= 900;

  return viewportIsNarrow || mobileUA || mobileUAData || (touchDevice && smallScreen);
}

export function WalletConnectButton({ variant = 'default' }: WalletConnectButtonProps) {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error: connectError, reset: resetConnect } = useConnect();
  const { disconnect } = useDisconnect();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() => detectMobileViewport());

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  // Wagmi v2 can discover multiple injected EIP-6963 wallets automatically.
  // Keep the chooser list stable and remove duplicate connector entries.
  const walletConnectors = useMemo(() => {
    const seen = new Set<string>();

    const priority = (connector: (typeof connectors)[number]) => {
      const name = connector.name.toLowerCase();
      const id = connector.id.toLowerCase();
      if (name.includes('metamask') || id.includes('metamask')) return 0;
      if (name.includes('coinbase')) return 1;
      if (name.includes('rabby')) return 2;
      if (name.includes('phantom')) return 3;
      if (name.includes('okx')) return 4;
      if (name.includes('subwallet')) return 5;
      if (id.includes('walletconnect') || name.includes('walletconnect')) return 90;
      return 20;
    };

    return [...connectors]
      .filter((connector) => {
        // The explicit MetaMask connector and EIP-6963 MetaMask connector can
        // both be present. Keep only one visible row for each wallet name.
        const key = connector.name.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => priority(a) - priority(b));
  }, [connectors]);

  const installedWallets = walletConnectors.filter((connector) => {
    const id = connector.id.toLowerCase();
    const name = connector.name.toLowerCase();
    if (id.includes('walletconnect') || name.includes('walletconnect')) return false;
    if (isMobile && name === 'injected') return false;
    return true;
  });

  const moreWalletConnectors = walletConnectors.filter((connector) => {
    const id = connector.id.toLowerCase();
    const name = connector.name.toLowerCase();
    return id.includes('walletconnect') || name.includes('walletconnect');
  });

  useEffect(() => {
    const updateMobile = () => setIsMobile(detectMobileViewport());
    updateMobile();
    window.addEventListener('resize', updateMobile);
    window.addEventListener('orientationchange', updateMobile);
    return () => {
      window.removeEventListener('resize', updateMobile);
      window.removeEventListener('orientationchange', updateMobile);
    };
  }, []);

  useEffect(() => {
    const openModal = () => {
      resetConnect();
      setSelectedConnectorId(null);
      setIsOpen(true);
    };

    window.addEventListener(WALLET_MODAL_EVENT, openModal);
    return () => window.removeEventListener(WALLET_MODAL_EVENT, openModal);
  }, [resetConnect]);

  useEffect(() => {
    if (isConnected) {
      setIsOpen(false);
      setSelectedConnectorId(null);
      resetConnect();
    }
  }, [isConnected, resetConnect]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleOpen = () => {
    resetConnect();
    setSelectedConnectorId(null);
    setIsOpen(true);
  };

  const handleConnect = async (connector: (typeof walletConnectors)[number]) => {
    setSelectedConnectorId(connector.uid);
    resetConnect();

    // On phones, a normal injected connector is not available in Chrome/Safari.
    // Open MetaMask's mobile dapp link instead; the dapp then runs inside the
    // MetaMask mobile browser where the injected provider is available.
    if (isMobile && (connector.name.toLowerCase().includes('metamask') || connector.id.toLowerCase().includes('metamask'))) {
      const dappUrl = `${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.href = `https://metamask.app.link/dapp/${dappUrl}`;
      return;
    }

    try {
      await connect({ connector });
    } catch {
      // Keep the modal open so the user can choose another wallet.
      setSelectedConnectorId(null);
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  if (isConnected) {
    return (
      <>
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
      </>
    );
  }

  return (
    <>
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

      {isOpen && typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
          aria-modal="true"
          aria-label="Connect a Wallet"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? '0' : '20px',
            background: 'rgba(3, 7, 18, 0.72)',
            backdropFilter: 'blur(8px)',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: isMobile ? '100dvw' : 'min(920px, calc(100vw - 40px))',
              height: isMobile ? '100dvh' : 'min(620px, calc(100vh - 40px))',
              minHeight: isMobile ? '0' : '560px',
              maxHeight: isMobile ? '100dvh' : undefined,
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '360px minmax(0, 1fr)',
              gridTemplateRows: isMobile ? 'minmax(0, 42dvh) minmax(0, 58dvh)' : undefined,
              overflow: 'hidden',
              borderRadius: isMobile ? '0' : '24px',
              border: '1px solid rgba(255,255,255,0.10)',
              boxSizing: 'border-box',
              background: '#15171d',
              color: '#fff',
              boxShadow: '0 30px 100px rgba(0,0,0,0.55)',
            }}
          >
            <div
              style={{
                borderRight: isMobile ? '0' : '1px solid rgba(255,255,255,0.08)',
                borderBottom: isMobile ? '1px solid rgba(255,255,255,0.08)' : '0',
                padding: isMobile ? '18px 8px 8px' : '28px 14px 24px',
                overflowY: 'auto',
                maxHeight: isMobile ? '42dvh' : undefined,
                minWidth: 0,
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  padding: isMobile ? '0 16px 14px' : '0 14px 18px',
                  fontSize: isMobile ? '20px' : '22px',
                  fontWeight: 750,
                }}
              >
                Connect a Wallet
              </div>

              <div
                style={{
                  padding: isMobile ? '0 16px 10px' : '0 14px 12px',
                  color: '#3b82f6',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                Installed / Browser Wallets
              </div>

              {installedWallets.length === 0 ? (
                <div
                  style={{
                    margin: '8px',
                    padding: '16px',
                    borderRadius: '14px',
                    background: 'rgba(255,255,255,0.04)',
                    color: 'rgba(255,255,255,0.62)',
                    fontSize: '13px',
                    lineHeight: 1.45,
                  }}
                >
                  No configured wallet connectors were found.
                  <br />
                  Add an injected/EIP-6963 connector to the wagmi config to list installed wallets here.
                </div>
              ) : (
                installedWallets.map((connector) => {
                  const isSelected = selectedConnectorId === connector.uid;
                  const icon = (connector as { icon?: string }).icon;

                  return (
                    <button
                      key={connector.uid}
                      type="button"
                      onClick={() => void handleConnect(connector)}
                      disabled={isPending}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: isMobile ? '12px 16px' : '13px 14px',
                        border: 0,
                        borderRadius: '13px',
                        background: isSelected ? 'rgba(59,130,246,0.18)' : 'transparent',
                        color: '#fff',
                        cursor: isPending ? 'wait' : 'pointer',
                        textAlign: 'left',
                        opacity: isPending && !isSelected ? 0.55 : 1,
                      }}
                    >
                      <span
                        style={{
                          width: '42px',
                          height: '42px',
                          flex: '0 0 42px',
                          borderRadius: '11px',
                          display: 'grid',
                          placeItems: 'center',
                          overflow: 'hidden',
                          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                          boxShadow: '0 5px 18px rgba(59,130,246,0.18)',
                          fontWeight: 800,
                          fontSize: '16px',
                        }}
                      >
                        {icon ? (
                          <img
                            src={icon}
                            alt=""
                            width={42}
                            height={42}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          getWalletInitial(connector.name)
                        )}
                      </span>

                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            display: 'block',
                            fontSize: isMobile ? '16px' : '14px',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {connector.name}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            marginTop: '3px',
                            color: '#8b92a3',
                            fontSize: isMobile ? '12px' : '11px',
                          }}
                        >
                          {isSelected && isPending ? 'Connecting...' : 'Available'}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}

              {moreWalletConnectors.length > 0 && (
                <>
                  <div
                    style={{
                      margin: '14px 14px 8px',
                      paddingTop: '14px',
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                      color: '#a7adbb',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    More Wallets
                  </div>

                  {moreWalletConnectors.map((connector) => {
                    const isSelected = selectedConnectorId === connector.uid;
                    const icon = (connector as { icon?: string }).icon;

                    return (
                      <button
                        key={connector.uid}
                        type="button"
                        onClick={() => void handleConnect(connector)}
                        disabled={isPending}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '13px 14px',
                          border: 0,
                          borderRadius: '13px',
                          background: isSelected ? 'rgba(59,130,246,0.18)' : 'transparent',
                          color: '#fff',
                          cursor: isPending ? 'wait' : 'pointer',
                          textAlign: 'left',
                          opacity: isPending && !isSelected ? 0.55 : 1,
                        }}
                      >
                        <span
                          style={{
                            width: '42px',
                            height: '42px',
                            flex: '0 0 42px',
                            borderRadius: '11px',
                            display: 'grid',
                            placeItems: 'center',
                            overflow: 'hidden',
                            background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
                            fontWeight: 800,
                            fontSize: '16px',
                          }}
                        >
                          {icon ? (
                            <img src={icon} alt="" width={42} height={42} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            'W'
                          )}
                        </span>
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ display: 'block', fontSize: '14px', fontWeight: 700 }}>
                            WalletConnect
                          </span>
                          <span style={{ display: 'block', marginTop: '3px', color: '#8b92a3', fontSize: '11px' }}>
                            Connect more wallets
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            <div
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isMobile ? '28px 18px 24px' : '54px 58px 42px',
                textAlign: 'center',
                minHeight: 0,
                minWidth: 0,
                overflowY: isMobile ? 'auto' : 'visible',
                background:
                  'radial-gradient(circle at 70% 15%, rgba(37,99,235,0.16), transparent 34%), #15171d',
              }}
            >
              <button
                type="button"
                aria-label="Close wallet selector"
                onClick={() => setIsOpen(false)}
                style={{
                  position: 'absolute',
                  top: '15px',
                  right: '15px',
                  width: '36px',
                  height: '36px',
                  border: 0,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '22px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>

              <div
                style={{
                  width: isMobile ? '72px' : '82px',
                  height: isMobile ? '72px' : '82px',
                  display: 'grid',
                  placeItems: 'center',
                  marginBottom: isMobile ? '16px' : '22px',
                  borderRadius: '20px',
                  background:
                    'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(139,92,246,0.25))',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontSize: isMobile ? '32px' : '38px',
                }}
              >
                ◈
              </div>

              <h2
                style={{
                  margin: '0 0 12px',
                  fontSize: isMobile ? '24px' : '30px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                }}
              >
                What is a Wallet?
              </h2>

              <p
                style={{
                  maxWidth: '460px',
                  margin: '0 0 30px',
                  color: '#a7adbb',
                  fontSize: isMobile ? '14px' : '15px',
                  lineHeight: 1.6,
                }}
              >
                Wallets are used to send, receive, store and interact with digital assets.
                Connect your wallet to use VeloxSwap without creating another password.
              </p>

              {connectError && (
                <div
                  style={{
                    width: '100%',
                    maxWidth: '390px',
                    marginBottom: '18px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(239,68,68,0.10)',
                    border: '1px solid rgba(239,68,68,0.22)',
                    color: '#fca5a5',
                    fontSize: '12px',
                    lineHeight: 1.4,
                    textAlign: 'left',
                  }}
                >
                  {connectError.message || 'Wallet connection failed. Please try another wallet.'}
                </div>
              )}

              <a
                href="https://ethereum.org/en/wallets/find-wallet/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
                style={{
                  color: '#60a5fa',
                  fontSize: '13px',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Get a Wallet
              </a>
            </div>
          </div>


          </div>,
          document.body
        )}
    </>
  );
}
