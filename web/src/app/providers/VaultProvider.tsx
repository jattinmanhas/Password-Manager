import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import type { XChaCha20Poly1305Aead } from "../../crypto";
import type { VaultItemResponse } from "../../features/vault/types";
import type { VaultViewItem } from "../../features/vault/vault.types";
import { wipeKeyMaterial } from "../../features/vault/vault.utils";
import { createDefaultXChaCha20Poly1305 } from "../../crypto/adapters";
import { useAuth } from "./AuthProvider";

interface VaultSessionState {
  aead: XChaCha20Poly1305Aead | null;
  kek: Uint8Array | null;
  isKekVerified: boolean;
  verifierItem: VaultItemResponse | null;
  items: VaultViewItem[];
  userPublicKey: Uint8Array | null;
  userPrivateKey: Uint8Array | null;
  setAead: (aead: XChaCha20Poly1305Aead | null) => void;
  setVaultSession: (
    kek: Uint8Array,
    verifierItem: VaultItemResponse,
    isKekVerified?: boolean
  ) => void;
  setItems: (items: VaultViewItem[]) => void;
  setUserKeyPair: (publicKey: Uint8Array, privateKey: Uint8Array) => void;
  lockVault: () => void;
}

const VaultContext = createContext<VaultSessionState | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [aead, setAead] = useState<XChaCha20Poly1305Aead | null>(null);
  const [kek, setKek] = useState<Uint8Array | null>(null);
  const [isKekVerified, setIsKekVerified] = useState(false);
  const [verifierItem, setVerifierItem] = useState<VaultItemResponse | null>(null);
  const [items, setItems] = useState<VaultViewItem[]>([]);
  const [userPublicKey, setUserPublicKey] = useState<Uint8Array | null>(null);
  const [userPrivateKey, setUserPrivateKey] = useState<Uint8Array | null>(null);

  const { session } = useAuth();

  // Initialize vault encryption adapter once
  useEffect(() => {
    let active = true;
    createDefaultXChaCha20Poly1305()
      .then((cipher: XChaCha20Poly1305Aead) => {
        if (active) setAead(cipher);
      })
      .catch((err: unknown) => {
        console.error("Failed to initialize vault encryption", err);
      });
    return () => {
      active = false;
    };
  }, []);

  const setVaultSession = useCallback(
    (newKek: Uint8Array, newVerifierItem: VaultItemResponse, verified = true) => {
      setKek(newKek);
      setVerifierItem(newVerifierItem);
      setIsKekVerified(verified);
    },
    []
  );

  const setUserKeyPair = useCallback(
    (publicKey: Uint8Array, privateKey: Uint8Array) => {
      setUserPublicKey(publicKey);
      setUserPrivateKey(privateKey);
    },
    []
  );

  const lockVault = useCallback(() => {
    setKek((prev) => {
      wipeKeyMaterial(prev);
      return null;
    });
    setIsKekVerified(false);
    setVerifierItem(null);
    setItems([]);
    setUserPrivateKey((prev) => {
      wipeKeyMaterial(prev);
      return null;
    });
    setUserPublicKey(null);
  }, []);

  // Clear vault keys when logging out
  useEffect(() => {
    if (!session) {
      lockVault();
    }
  }, [session, lockVault]);

  return (
    <VaultContext.Provider
      value={{
        aead,
        kek,
        isKekVerified,
        verifierItem,
        items,
        userPublicKey,
        userPrivateKey,
        setAead,
        setVaultSession,
        setItems,
        setUserKeyPair,
        lockVault,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVaultSession() {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error("useVaultSession must be used within a VaultProvider");
  }
  return context;
}

