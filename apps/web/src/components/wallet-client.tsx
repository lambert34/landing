'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, BrandLogo, Button, Card } from '@g64/ui';
import { getSession, logout, type AuthUser } from '../lib/auth';
import {
  generateWalletMaterial,
  restoreWalletMaterial,
  signEvmMessage,
  walletFromEntropy,
  wipeBytes,
  type WalletMaterial,
} from '../lib/wallet-crypto';
import {
  getEvmWallet,
  registerEvmWallet,
  requestWalletRegistrationChallenge,
  walletApiErrorMessage,
  type EvmWallet,
  type WalletApiError,
} from '../lib/wallet-api';
import {
  createWalletVault,
  decryptWalletEntropy,
  getWalletVaultMetadata,
} from '../lib/wallet-vault';

const assets = ['Bitcoin', 'Ethereum', 'USDT', 'TON', 'G64 Token'];

type WalletPhase =
  | 'loading'
  | 'create'
  | 'confirm'
  | 'recover'
  | 'registering'
  | 'ready'
  | 'error';

interface PendingWallet {
  material: WalletMaterial;
  confirmationIndexes: number[];
}

function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function shortAddress(address: string): string {
  return `${address.slice(0, 7)}…${address.slice(-5)}`;
}

function chooseConfirmationIndexes(): number[] {
  const values = new Set<number>();
  while (values.size < 3) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0]!;
    values.add(random % 24);
  }
  return [...values].sort((a, b) => a - b);
}

export function WalletClient() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [phase, setPhase] = useState<WalletPhase>('loading');
  const [serverWallet, setServerWallet] = useState<EvmWallet | null>(null);
  const [pendingWallet, setPendingWallet] = useState<PendingWallet | null>(null);
  const [confirmationWords, setConfirmationWords] = useState<Record<number, string>>({});
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [walletError, setWalletError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const pendingMaterialRef = useRef<WalletMaterial | null>(null);

  const mnemonicWords = useMemo(
    () => pendingWallet?.material.mnemonic.split(' ') ?? [],
    [pendingWallet],
  );

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const session = await getSession();
        if (!active) return;
        if (!session.authenticated || !session.user) {
          router.replace('/login');
          return;
        }

        setUser(session.user);
        await synchronizeWallet(session.user, active);
      } catch {
        if (active) router.replace('/login');
      }
    }

    void load();

    return () => {
      active = false;
      const pending = pendingMaterialRef.current;
      if (pending) {
        wipeBytes(pending.entropy);
        pendingMaterialRef.current = null;
      }
    };
  }, [router]);

  async function synchronizeWallet(authUser: AuthUser, active = true) {
    setPhase('loading');
    setWalletError(null);

    try {
      const remote = await getEvmWallet();
      if (!active) return;

      const local = await getWalletVaultMetadata(authUser.id);
      if (!active) return;

      if (remote.registered && remote.wallet) {
        setServerWallet(remote.wallet);
        if (local && sameAddress(local.address, remote.wallet.address)) {
          setPhase('ready');
        } else {
          setPhase('recover');
        }
        return;
      }

      setServerWallet(null);

      if (local) {
        setPhase('registering');
        await resumeRegistration(authUser, local.address);
        if (active) setPhase('ready');
        return;
      }

      setPhase('create');
    } catch (error) {
      if (!active) return;
      setWalletError(walletApiErrorMessage(error));
      setPhase('error');
    }
  }

  async function resumeRegistration(authUser: AuthUser, expectedLocalAddress: string) {
    const entropy = await decryptWalletEntropy(authUser.id);
    try {
      const material = walletFromEntropy(entropy);
      if (!sameAddress(material.address, expectedLocalAddress)) {
        throw new Error('Local wallet metadata does not match decrypted wallet material.');
      }

      const challenge = await requestWalletRegistrationChallenge(material.address);
      const signature = await signEvmMessage(material.mnemonic, challenge.message);

      try {
        const result = await registerEvmWallet(challenge.challengeId, signature);
        setServerWallet(result.wallet);
      } catch (error) {
        if ((error as WalletApiError)?.code !== 'WALLET_ALREADY_REGISTERED') throw error;
        const remote = await getEvmWallet();
        if (!remote.wallet || !sameAddress(remote.wallet.address, material.address)) throw error;
        setServerWallet(remote.wallet);
      }
    } finally {
      wipeBytes(entropy);
    }
  }

  function startWalletCreation() {
    setWalletError(null);
    const material = generateWalletMaterial();
    pendingMaterialRef.current = material;
    setPendingWallet({
      material,
      confirmationIndexes: chooseConfirmationIndexes(),
    });
    setConfirmationWords({});
    setPhase('confirm');
  }

  async function confirmAndRegisterWallet() {
    if (!user || !pendingWallet) return;

    const words = pendingWallet.material.mnemonic.split(' ');
    const valid = pendingWallet.confirmationIndexes.every(
      (index) => confirmationWords[index]?.trim().toLowerCase() === words[index],
    );

    if (!valid) {
      setWalletError('One or more recovery words do not match. Check your backup and try again.');
      return;
    }

    setPhase('registering');
    setWalletError(null);

    try {
      await createWalletVault(
        user.id,
        pendingWallet.material.entropy,
        pendingWallet.material.address,
      );
      const challenge = await requestWalletRegistrationChallenge(pendingWallet.material.address);
      const signature = await signEvmMessage(pendingWallet.material.mnemonic, challenge.message);
      const result = await registerEvmWallet(challenge.challengeId, signature);
      setServerWallet(result.wallet);
      wipeBytes(pendingWallet.material.entropy);
      pendingMaterialRef.current = null;
      setPendingWallet(null);
      setConfirmationWords({});
      setPhase('ready');
    } catch (error) {
      setWalletError(walletApiErrorMessage(error));
      setPhase('error');
    }
  }

  async function recoverWallet() {
    if (!user || !serverWallet) return;
    setWalletError(null);

    let material: WalletMaterial;
    try {
      material = restoreWalletMaterial(recoveryPhrase);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : 'Invalid recovery phrase.');
      return;
    }

    try {
      if (!sameAddress(material.address, serverWallet.address)) {
        setWalletError(
          'This recovery phrase belongs to a different wallet and cannot replace the registered G64 wallet.',
        );
        return;
      }

      await createWalletVault(user.id, material.entropy, material.address, { replace: true });
      setRecoveryPhrase('');
      setPhase('ready');
    } finally {
      wipeBytes(material.entropy);
    }
  }

  async function retryWalletSetup() {
    if (!user) return;
    await synchronizeWallet(user);
  }

  async function signOut() {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await logout();
    } finally {
      const pending = pendingMaterialRef.current;
      if (pending) wipeBytes(pending.entropy);
      pendingMaterialRef.current = null;
      setPendingWallet(null);
      setRecoveryPhrase('');
      router.replace('/login');
      router.refresh();
    }
  }

  if (phase === 'loading' || !user) {
    return (
      <div className="session-loading">
        <BrandLogo imageSrc="/brand/logo.svg" />
        <span>Loading your account…</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside>
        <Link href="/" aria-label="G64 home">
          <BrandLogo imageSrc="/brand/logo.svg" />
        </Link>

        <nav>
          <Link className="active" href="/wallet">
            Portfolio
          </Link>
          <span>
            Activity <small>Soon</small>
          </span>
        </nav>

        <div className="account-block">
          {serverWallet ? (
            <span className="wallet-address" title={serverWallet.address}>
              {shortAddress(serverWallet.address)}
            </span>
          ) : null}
          <span className="account-email">{user.email}</span>
          <button type="button" onClick={signOut} disabled={loggingOut}>
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>

      <main className="wallet-main">
        {phase !== 'ready' ? (
          <WalletSetup
            phase={phase}
            pendingWallet={pendingWallet}
            mnemonicWords={mnemonicWords}
            confirmationWords={confirmationWords}
            recoveryPhrase={recoveryPhrase}
            error={walletError}
            serverWallet={serverWallet}
            onStart={startWalletCreation}
            onConfirmWord={(index, value) =>
              setConfirmationWords((current) => ({ ...current, [index]: value }))
            }
            onConfirm={confirmAndRegisterWallet}
            onRecoveryPhrase={setRecoveryPhrase}
            onRecover={recoverWallet}
            onRetry={retryWalletSetup}
          />
        ) : (
          <>
            <header>
              <div>
                <span className="eyebrow">Portfolio</span>
                <h1>$0.00</h1>
                <p>{serverWallet ? shortAddress(serverWallet.address) : 'No assets yet'}</p>
              </div>

              <div className="wallet-actions">
                <Button disabled>Send</Button>
                <Button variant="secondary" disabled>
                  Receive
                </Button>
                <Button variant="secondary" disabled>
                  Swap
                </Button>
              </div>
            </header>

            <Card>
              <div className="asset-title">
                <h2>Assets</h2>
                <span>Network</span>
              </div>

              {assets.map((asset) => (
                <div className="asset-row" key={asset}>
                  <div className="asset-icon">{asset[0]}</div>
                  <strong>{asset}</strong>
                  <Badge>Testnet</Badge>
                  <span>—</span>
                </div>
              ))}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function WalletSetup({
  phase,
  pendingWallet,
  mnemonicWords,
  confirmationWords,
  recoveryPhrase,
  error,
  serverWallet,
  onStart,
  onConfirmWord,
  onConfirm,
  onRecoveryPhrase,
  onRecover,
  onRetry,
}: {
  phase: WalletPhase;
  pendingWallet: PendingWallet | null;
  mnemonicWords: string[];
  confirmationWords: Record<number, string>;
  recoveryPhrase: string;
  error: string | null;
  serverWallet: EvmWallet | null;
  onStart: () => void;
  onConfirmWord: (index: number, value: string) => void;
  onConfirm: () => void;
  onRecoveryPhrase: (value: string) => void;
  onRecover: () => void;
  onRetry: () => void;
}) {
  if (phase === 'registering') {
    return (
      <Card className="wallet-setup-card">
        <span className="eyebrow">Securing wallet</span>
        <h1>Registering your wallet…</h1>
        <p>
          G64 is verifying a one-time cryptographic signature. Your recovery phrase and private key
          stay in this browser.
        </p>
      </Card>
    );
  }

  if (phase === 'error') {
    return (
      <Card className="wallet-setup-card">
        <span className="eyebrow">Wallet setup</span>
        <h1>Setup needs another try</h1>
        {error ? <p className="auth-error">{error}</p> : null}
        <Button onClick={onRetry}>Try again</Button>
      </Card>
    );
  }

  if (phase === 'create') {
    return (
      <Card className="wallet-setup-card">
        <span className="eyebrow">Non-custodial wallet</span>
        <h1>Create your G64 wallet</h1>
        <p>
          Your wallet will be generated locally in this browser. G64 never receives your recovery
          phrase or private key.
        </p>
        <div className="wallet-setup-note">
          You will receive 24 recovery words. Store them offline. They are the only way to recover
          this wallet if your browser data is lost.
        </div>
        <Button onClick={onStart}>Create wallet</Button>
      </Card>
    );
  }

  if (phase === 'confirm' && pendingWallet) {
    return (
      <Card className="wallet-setup-card wallet-seed-card">
        <span className="eyebrow">Recovery phrase</span>
        <h1>Save these 24 words</h1>
        <p>
          Write them down in order. Do not save them in screenshots, cloud notes, email, or chat.
        </p>

        <div className="seed-grid">
          {mnemonicWords.map((word, index) => (
            <div className="seed-word" key={`${index}-${word}`}>
              <span>{index + 1}</span>
              <strong>{word}</strong>
            </div>
          ))}
        </div>

        <div className="seed-confirm">
          <h2>Confirm your backup</h2>
          <p>Enter the requested words exactly as written above.</p>
          <div className="seed-confirm-grid">
            {pendingWallet.confirmationIndexes.map((index) => (
              <label key={index}>
                Word #{index + 1}
                <input
                  value={confirmationWords[index] ?? ''}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => onConfirmWord(index, event.target.value)}
                />
              </label>
            ))}
          </div>
        </div>

        {error ? <p className="auth-error">{error}</p> : null}
        <Button onClick={onConfirm}>I saved my recovery phrase</Button>
      </Card>
    );
  }

  if (phase === 'recover' && serverWallet) {
    return (
      <Card className="wallet-setup-card">
        <span className="eyebrow">Wallet recovery</span>
        <h1>Restore this wallet</h1>
        <p>
          G64 knows the public address <strong>{shortAddress(serverWallet.address)}</strong>, but this
          browser no longer has its encrypted local vault.
        </p>
        <label className="recovery-field">
          24-word recovery phrase
          <textarea
            value={recoveryPhrase}
            rows={6}
            autoComplete="off"
            spellCheck={false}
            placeholder="word1 word2 word3 …"
            onChange={(event) => onRecoveryPhrase(event.target.value)}
          />
        </label>
        <p className="wallet-privacy-note">
          The phrase is validated locally and is never sent to the G64 API.
        </p>
        {error ? <p className="auth-error">{error}</p> : null}
        <Button onClick={onRecover} disabled={!recoveryPhrase.trim()}>
          Restore wallet
        </Button>
      </Card>
    );
  }

  return null;
}
