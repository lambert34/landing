import type { Address } from 'viem';
import { EVM_DERIVATION_PATH, WALLET_ENTROPY_BYTES } from './wallet-crypto';

const DB_NAME = 'g64_wallet_vault';
const DB_VERSION = 1;
const VAULT_STORE = 'vaults';
const KEY_STORE = 'keys';
const PRIMARY_VAULT_ID = 'evm-primary';
const VAULT_VERSION = 1;

interface VaultRecord {
  id: typeof PRIMARY_VAULT_ID;
  version: typeof VAULT_VERSION;
  family: 'evm';
  address: Address;
  derivationPath: typeof EVM_DERIVATION_PATH;
  algorithm: 'AES-GCM';
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
  createdAt: string;
  updatedAt: string;
}

interface KeyRecord {
  id: typeof PRIMARY_VAULT_ID;
  key: CryptoKey;
}

export interface WalletVaultMetadata {
  version: typeof VAULT_VERSION;
  family: 'evm';
  address: Address;
  derivationPath: typeof EVM_DERIVATION_PATH;
  createdAt: string;
  updatedAt: string;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  const request = indexedDB.open(DB_NAME, DB_VERSION);

  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(VAULT_STORE)) db.createObjectStore(VAULT_STORE, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE, { keyPath: 'id' });
  };

  return requestResult(request);
}

function additionalData(address: Address): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      version: VAULT_VERSION,
      family: 'evm',
      address,
      derivationPath: EVM_DERIVATION_PATH,
    }),
  );
}

function metadata(record: VaultRecord): WalletVaultMetadata {
  return {
    version: record.version,
    family: record.family,
    address: record.address,
    derivationPath: record.derivationPath,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function getWalletVaultMetadata(): Promise<WalletVaultMetadata | null> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(VAULT_STORE, 'readonly');
    const record = (await requestResult(
      transaction.objectStore(VAULT_STORE).get(PRIMARY_VAULT_ID),
    )) as VaultRecord | undefined;
    await transactionDone(transaction);
    return record ? metadata(record) : null;
  } finally {
    db.close();
  }
}

export async function hasWalletVault(): Promise<boolean> {
  return (await getWalletVaultMetadata()) !== null;
}

export async function createWalletVault(
  entropy: Uint8Array,
  address: Address,
  options: { replace?: boolean } = {},
): Promise<WalletVaultMetadata> {
  if (entropy.length !== WALLET_ENTROPY_BYTES) {
    throw new Error('Wallet vault accepts exactly 256 bits of BIP-39 entropy.');
  }

  const db = await openDatabase();
  try {
    if (!options.replace) {
      const existingTransaction = db.transaction(VAULT_STORE, 'readonly');
      const existing = await requestResult(
        existingTransaction.objectStore(VAULT_STORE).get(PRIMARY_VAULT_ID),
      );
      await transactionDone(existingTransaction);
      if (existing) throw new Error('A local G64 EVM wallet vault already exists.');
    }

    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: additionalData(address) },
      key,
      new Uint8Array(entropy),
    );

    const now = new Date().toISOString();
    const previous = options.replace ? await getExistingRecord(db) : null;
    const record: VaultRecord = {
      id: PRIMARY_VAULT_ID,
      version: VAULT_VERSION,
      family: 'evm',
      address,
      derivationPath: EVM_DERIVATION_PATH,
      algorithm: 'AES-GCM',
      iv: new Uint8Array(iv),
      ciphertext,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };

    const transaction = db.transaction([VAULT_STORE, KEY_STORE], 'readwrite');
    transaction.objectStore(KEY_STORE).put({ id: PRIMARY_VAULT_ID, key } satisfies KeyRecord);
    transaction.objectStore(VAULT_STORE).put(record);
    await transactionDone(transaction);

    return metadata(record);
  } finally {
    db.close();
  }
}

async function getExistingRecord(db: IDBDatabase): Promise<VaultRecord | null> {
  const transaction = db.transaction(VAULT_STORE, 'readonly');
  const record = (await requestResult(
    transaction.objectStore(VAULT_STORE).get(PRIMARY_VAULT_ID),
  )) as VaultRecord | undefined;
  await transactionDone(transaction);
  return record ?? null;
}

export async function decryptWalletEntropy(): Promise<Uint8Array> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction([VAULT_STORE, KEY_STORE], 'readonly');
    const vaultRequest = transaction.objectStore(VAULT_STORE).get(PRIMARY_VAULT_ID);
    const keyRequest = transaction.objectStore(KEY_STORE).get(PRIMARY_VAULT_ID);
    const [record, keyRecord] = await Promise.all([
      requestResult(vaultRequest) as Promise<VaultRecord | undefined>,
      requestResult(keyRequest) as Promise<KeyRecord | undefined>,
    ]);
    await transactionDone(transaction);

    if (!record || !keyRecord?.key) throw new Error('Local G64 wallet vault is unavailable.');

    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: record.iv,
        additionalData: additionalData(record.address),
      },
      keyRecord.key,
      record.ciphertext,
    );
    const entropy = new Uint8Array(plaintext);

    if (entropy.length !== WALLET_ENTROPY_BYTES) {
      entropy.fill(0);
      throw new Error('Local G64 wallet vault is corrupted.');
    }

    return entropy;
  } finally {
    db.close();
  }
}

export async function deleteWalletVault(): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction([VAULT_STORE, KEY_STORE], 'readwrite');
    transaction.objectStore(VAULT_STORE).delete(PRIMARY_VAULT_ID);
    transaction.objectStore(KEY_STORE).delete(PRIMARY_VAULT_ID);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}
