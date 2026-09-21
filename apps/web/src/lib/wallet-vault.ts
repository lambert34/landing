import type { Address } from 'viem';
import { EVM_DERIVATION_PATH, WALLET_ENTROPY_BYTES } from './wallet-crypto';

const DB_NAME = 'g64_wallet_vault';
const DB_VERSION = 1;
const VAULT_STORE = 'vaults';
const KEY_STORE = 'keys';
const PRIMARY_VAULT_PREFIX = 'evm-primary';
const VAULT_VERSION = 1;

interface VaultRecord {
  id: string;
  userId: string;
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
  id: string;
  key: CryptoKey;
}

export interface WalletVaultMetadata {
  userId: string;
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
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
  });
}

function primaryVaultId(userId: string): string {
  const normalized = userId.trim();
  if (!normalized) throw new Error('Authenticated G64 user ID is required for wallet storage.');
  return `${PRIMARY_VAULT_PREFIX}:${normalized}`;
}

async function openDatabase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) {
    throw new Error('Secure browser storage is unavailable in this browser.');
  }

  const request = indexedDB.open(DB_NAME, DB_VERSION);

  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(VAULT_STORE)) {
      db.createObjectStore(VAULT_STORE, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(KEY_STORE)) {
      db.createObjectStore(KEY_STORE, { keyPath: 'id' });
    }
  };

  return requestResult(request);
}

function additionalData(userId: string, address: Address): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      version: VAULT_VERSION,
      userId,
      family: 'evm',
      address,
      derivationPath: EVM_DERIVATION_PATH,
    }),
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function metadata(record: VaultRecord): WalletVaultMetadata {
  return {
    userId: record.userId,
    version: record.version,
    family: record.family,
    address: record.address,
    derivationPath: record.derivationPath,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function getExistingRecord(db: IDBDatabase, userId: string): Promise<VaultRecord | null> {
  const transaction = db.transaction(VAULT_STORE, 'readonly');
  const done = transactionDone(transaction);
  const record = (await requestResult(
    transaction.objectStore(VAULT_STORE).get(primaryVaultId(userId)),
  )) as VaultRecord | undefined;
  await done;
  return record ?? null;
}

export async function getWalletVaultMetadata(
  userId: string,
): Promise<WalletVaultMetadata | null> {
  const db = await openDatabase();
  try {
    const record = await getExistingRecord(db, userId);
    return record ? metadata(record) : null;
  } finally {
    db.close();
  }
}

export async function hasWalletVault(userId: string): Promise<boolean> {
  return (await getWalletVaultMetadata(userId)) !== null;
}

export async function createWalletVault(
  userId: string,
  entropy: Uint8Array,
  address: Address,
  options: { replace?: boolean } = {},
): Promise<WalletVaultMetadata> {
  if (entropy.length !== WALLET_ENTROPY_BYTES) {
    throw new Error('Wallet vault accepts exactly 256 bits of BIP-39 entropy.');
  }

  const db = await openDatabase();
  try {
    const id = primaryVaultId(userId);
    const previous = await getExistingRecord(db, userId);
    if (previous && !options.replace) {
      throw new Error('A local G64 EVM wallet vault already exists for this account.');
    }

    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(additionalData(userId, address)),
      },
      key,
      toArrayBuffer(entropy),
    );

    const now = new Date().toISOString();
    const record: VaultRecord = {
      id,
      userId,
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
    const done = transactionDone(transaction);
    transaction.objectStore(KEY_STORE).put({ id, key } satisfies KeyRecord);
    transaction.objectStore(VAULT_STORE).put(record);
    await done;

    return metadata(record);
  } finally {
    db.close();
  }
}

export async function decryptWalletEntropy(userId: string): Promise<Uint8Array> {
  const db = await openDatabase();
  try {
    const id = primaryVaultId(userId);
    const transaction = db.transaction([VAULT_STORE, KEY_STORE], 'readonly');
    const done = transactionDone(transaction);
    const vaultRequest = transaction.objectStore(VAULT_STORE).get(id);
    const keyRequest = transaction.objectStore(KEY_STORE).get(id);
    const [record, keyRecord] = await Promise.all([
      requestResult(vaultRequest) as Promise<VaultRecord | undefined>,
      requestResult(keyRequest) as Promise<KeyRecord | undefined>,
    ]);
    await done;

    if (!record || !keyRecord?.key || record.userId !== userId) {
      throw new Error('Local G64 wallet vault is unavailable for this account.');
    }

    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(record.iv),
        additionalData: toArrayBuffer(additionalData(userId, record.address)),
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

export async function deleteWalletVault(userId: string): Promise<void> {
  const db = await openDatabase();
  try {
    const id = primaryVaultId(userId);
    const transaction = db.transaction([VAULT_STORE, KEY_STORE], 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(VAULT_STORE).delete(id);
    transaction.objectStore(KEY_STORE).delete(id);
    await done;
  } finally {
    db.close();
  }
}
