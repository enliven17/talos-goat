"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  RainbowKitProvider,
  ConnectButton,
  getDefaultConfig,
  darkTheme,
  useConnectModal,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { WagmiProvider, useAccount, useDisconnect } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { goatChain } from "@/lib/goat-chain";

/**
 * GOAT Network wallet provider tree (wagmi + RainbowKit), replacing the
 * Stellar Wallets Kit. The public context surface (`useGoatWallet`) exposes the
 * connected EVM address from wagmi `useAccount` via the `publicKey` field
 * (named for backwards compatibility with existing consumers).
 *
 * On-chain write calls (createTalos / registerName / token transfers) now use
 * wagmi `useWriteContract` directly in the consuming components — the legacy
 * `signTransaction(xdr)` stub remains only to keep the type surface stable.
 */

// WalletConnect projectId — required by RainbowKit's getDefaultConfig.
// Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID; falls back to a placeholder so
// dev builds don't crash (WalletConnect-based wallets won't work until set).
const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "TALOS_GOAT_PLACEHOLDER";

const wagmiConfig = getDefaultConfig({
  appName: "Talos",
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [goatChain],
  ssr: true,
});

const queryClient = new QueryClient();

/** Re-exported so existing imports keep working. The RainbowKit modal lists
 *  the actual installed wallets (MetaMask etc.); these descriptors are no
 *  longer used to render a custom modal. */
export const WALLET_OPTIONS = [
  { id: "metaMask", name: "MetaMask", icon: "🦊", desc: "Browser extension" },
  { id: "walletConnect", name: "WalletConnect", icon: "🔗", desc: "Mobile & web" },
] as const;

interface WalletContextValue {
  /** Connected EVM address (was Stellar public key). */
  publicKey: string | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  /** @deprecated Stellar XDR signing removed; use wagmi `useWriteContract`. */
  signTransaction: (xdr: string) => Promise<string>;
  showWalletModal: boolean;
  setShowWalletModal: (v: boolean) => void;
}

const WalletContext = createContext<WalletContextValue>({
  publicKey: null,
  isConnected: false,
  connect: () => {},
  disconnect: () => {},
  signTransaction: async () => "",
  showWalletModal: false,
  setShowWalletModal: () => {},
});

export function useGoatWallet(): WalletContextValue {
  return useContext(WalletContext);
}

function WalletContextBridge({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();

  const value: WalletContextValue = {
    publicKey: address ?? null,
    isConnected,
    connect: () => openConnectModal?.(),
    disconnect: () => wagmiDisconnect(),
    signTransaction: async () => {
      throw new Error(
        "signTransaction(xdr) is removed on GOAT — use wagmi useWriteContract.",
      );
    },
    showWalletModal: false,
    setShowWalletModal: () => openConnectModal?.(),
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({ accentColor: "#000000", borderRadius: "none" })}
          modalSize="compact"
        >
          <WalletContextBridge>{children}</WalletContextBridge>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/** RainbowKit connect button, re-exported for components that want the native UI. */
export { ConnectButton };
