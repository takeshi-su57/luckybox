# Roadmap 1 — Brain Wallet (No Privacy)

## Goal

Deterministic CLI wallet system:

passphrase → wallet[index]

No privacy guarantees. Foundation layer.

---

## Core Rules

- Deterministic wallet derivation
- No passphrase storage
- CLI-only interaction
- Minimal data exposure
- Normal public transactions allowed

---

## Modules

### 1. KDF

Function:

deriveSeed(passphrase)

Requirements:

- Argon2id or scrypt
- normalize input (NFKD)
- fixed salt: "brainvault:v1:ethereum"
- deterministic output

---

### 2. HD Wallet

Path:

m/44'/60'/0'/0/{index}

Functions:

- deriveAccount(seed, index)
- deriveAddress(seed, index)

---

### 3. CLI Commands

vault init
vault unlock
vault list

vault address box1
vault address box1 --copy
vault address box1 --show

vault balance box1

vault send box1 --to <address> --amount <value>

---

### 4. CLI Output Rules

Default:

- show box1, box2
- show partial address (first5...last5)
- hide full address
- hide balance

Explicit:

- --show → full address
- --copy → clipboard
- balance command → fetch

---

### 5. Safety

- confirm before send
- show preview address
- show chain + gas
- warn: "public transaction"

---

## Deliverables

/src/crypto/kdf.ts  
/src/crypto/hd.ts  
/src/wallet/derive.ts  
/src/cli/vault.ts  
/src/cli/address.ts  
/src/cli/send.ts  
/src/cli/balance.ts

---

## Acceptance

- same passphrase → same wallets
- no data persisted
- CLI hides sensitive info by default
