# G64 Phase 2 — EVM wallet architecture and security model

## Scope

Phase 2 adds the first non-custodial wallet capability to G64.

The implementation is testnet-only and targets Ethereum Sepolia. It must not add custody, server-side key generation, mainnet support, fiat, P2P, order books, or trading features.

## Security invariants

1. The server never receives or stores:
   - BIP-39 mnemonic words
   - mnemonic entropy
   - seed bytes
   - private keys
   - decrypted vault material
   - wallet unlock secrets
2. Wallet secrets must never be written to localStorage or sessionStorage.
3. Wallet secrets must never be logged, included in analytics, error telemetry, URLs, query strings, or API payloads.
4. The EVM derivation path is fixed and versioned:
   - `m/44'/60'/0'/0/0`
5. The first wallet uses 256 bits of entropy and a 24-word English BIP-39 mnemonic.
6. The first supported EVM network is Sepolia:
   - chainId: `11155111`
7. Public address registration must prove key ownership by signing a server-generated challenge.
8. Account recovery and wallet recovery are separate:
   - email OTP recovers access to the G64 account
   - the 24-word mnemonic recovers the wallet
9. If a G64 account already has a registered EVM address but the current browser has no local vault, G64 must require wallet recovery. It must not silently create a different wallet.
10. Mainnet must remain disabled until a separate mainnet security review.

## Client cryptography

### Mnemonic

- Standard: BIP-39
- Language: English
- Entropy: 256 bits
- Length: 24 words
- Entropy source: browser `crypto.getRandomValues`

### EVM derivation

- Curve: secp256k1
- Derivation path: `m/44'/60'/0'/0/0`
- Address format: checksummed Ethereum address
- Current chain: Sepolia (11155111)

The same EVM address may later be reused across EVM-compatible networks. Chain configuration is separate from key derivation.

## Local vault

The local wallet vault lives in IndexedDB.

The plaintext mnemonic, entropy, seed and private key are not persisted.

Vault design:

- generate a 256-bit AES-GCM key with Web Crypto
- mark the CryptoKey non-extractable
- store the non-extractable CryptoKey in IndexedDB using structured clone
- encrypt the 32-byte BIP-39 entropy with AES-256-GCM
- generate a fresh random 96-bit IV for every encryption
- persist only:
  - encrypted entropy
  - IV
  - non-extractable CryptoKey
  - vault version
  - wallet family
  - public address
  - derivation path
  - timestamps

This protects wallet material at rest from simple file/database disclosure. It does not make a compromised same-origin JavaScript runtime safe: malicious code running under the G64 origin could still ask Web Crypto to decrypt using the stored non-extractable key.

For mainnet, G64 must adopt a stronger unlock/signing model before enabling real-value assets.

## Wallet creation flow

1. User must have an authenticated G64 account.
2. Client asks the API whether an EVM address is already registered for the account.
3. If an address already exists but the browser has no matching local vault:
   - do not create a second wallet
   - show recovery flow
4. If no address exists:
   - create 256-bit entropy in the browser
   - derive 24-word mnemonic
   - derive EVM account at `m/44'/60'/0'/0/0`
   - show the mnemonic once for backup
   - require confirmation of selected words
   - create the encrypted local vault
   - request a server registration challenge
   - sign the challenge in the browser
   - send only public address, signature, challenge identifier and public metadata to the API
   - server verifies ownership and registers the address
5. Clear references to plaintext secret material as soon as practical.

## Wallet recovery flow

1. User authenticates to the G64 account through email OTP.
2. If the server already has a registered EVM address and no local vault is present, show wallet recovery.
3. User enters all 24 BIP-39 words locally.
4. Client validates BIP-39 checksum and derives `m/44'/60'/0'/0/0`.
5. Derived address must equal the address already registered to the G64 account.
6. If it matches:
   - create a new encrypted local vault on this browser
   - never send the mnemonic or private key to the API
7. If it does not match:
   - reject recovery
   - do not replace the registered wallet automatically

## Server-side wallet record

The server may store public metadata only.

Minimum record:

- id
- user_id
- family = `evm`
- address
- derivation_path
- created_at
- updated_at

Constraints:

- one EVM wallet per user in v0.1
- one registered owner per EVM address
- address normalized and validated
- no secret wallet fields

## Address ownership proof

Registration must not trust a bare address submitted by the browser.

Flow:

1. authenticated user requests a short-lived registration challenge
2. server returns a random challenge identifier and canonical message
3. challenge is bound to the authenticated user and expires quickly
4. client signs the exact message using the derived EVM account
5. client submits challengeId, address and signature
6. server recovers/verifies the signer and requires it to equal the submitted address
7. challenge is single-use
8. only then is the public wallet address persisted

## Browser state rules

Allowed:

- IndexedDB: encrypted vault + non-extractable CryptoKey + public metadata
- sessionStorage: existing non-secret authentication challenge state only
- in-memory React/JavaScript state: secret material only for the shortest practical lifetime

Forbidden:

- localStorage: mnemonic, seed, private key, plaintext entropy
- sessionStorage: mnemonic, seed, private key, plaintext entropy
- cookies: wallet secrets
- API request bodies: wallet secrets
- URLs/query params: wallet secrets
- console logs: wallet secrets

## Logout behavior

Logout revokes the G64 account session.

It must also clear any decrypted in-memory wallet state.

The encrypted IndexedDB vault remains on the device so the same device can use the wallet again after the user signs back in.

## Browser data loss

Clearing browser/site storage removes the local encrypted vault.

If that happens:

- account access can still be restored through email OTP
- wallet access requires the 24-word mnemonic
- G64 cannot reconstruct the wallet without the mnemonic

The UI must communicate this clearly before wallet creation is finalized.

## Web application hardening

Before wallet secrets are introduced, Phase 2 must avoid third-party runtime scripts on wallet flows and add restrictive security headers where compatible with Next.js.

At minimum:

- HTTPS only
- no third-party analytics on mnemonic/recovery screens
- `frame-ancestors 'none'`
- `object-src 'none'`
- restrictive `connect-src`
- restrictive `base-uri`
- restrictive `form-action`
- Referrer-Policy
- X-Content-Type-Options

A stronger nonce/hash-based Content Security Policy is required before mainnet.

## Test requirements

Automated tests must cover:

- 256-bit entropy -> valid 24-word mnemonic
- known mnemonic -> deterministic EVM address
- fixed derivation path
- mnemonic checksum rejection
- encrypt -> decrypt round trip
- fresh IV for every encryption
- IndexedDB vault persistence
- wallet restore derives the same address
- mismatched mnemonic cannot replace an existing registered wallet
- registration signature verifies to the submitted address
- expired/reused registration challenge is rejected
- API schemas contain no mnemonic/seed/private-key fields
- logout clears decrypted in-memory wallet state

## Phase 2 completion criteria

Phase 2 is complete only when a real authenticated production user can:

1. open G64 on a browser with no wallet
2. create a 24-word wallet locally
3. confirm backup
4. have only the public address registered server-side
5. refresh and recover the wallet from the encrypted local vault
6. log out without losing the encrypted vault
7. log back in and regain local wallet access
8. clear local storage and see a recovery-required state
9. restore the same wallet with the 24 words
10. fail recovery with a different valid mnemonic

No mainnet assets or real-value funds are allowed in Phase 2.
