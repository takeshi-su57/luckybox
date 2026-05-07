# Roadmap 2 — Railgun Privacy Layer

## Goal

All outbound transfers must go through Railgun.

receive: public  
send: private only

---

## Core Rules

- inbound allowed normally
- outbound must use Railgun
- no direct wallet[i] → wallet[j]
- relayer required by default

---

## Architecture

wallet[i]  
→ shield (public → private)  
→ private balance  
→ unshield (private → destination)

---

## Modules

### 1. Privacy Provider

interface:

- shield()
- unshield()
- getPrivateBalance()
- estimateFees()

---

### 2. Railgun Integration

- privacy engine
- wallet keys
- local DB
- broadcaster client
- POI config

---

### 3. CLI Commands

vault shield box1 --token ETH --amount 1

vault private-balance

vault withdraw --to <address> --amount <value>

---

### 4. Cost Model

- shield fee: 0.25%
- unshield fee: 0.25%
- total ≈ 0.5% + gas + relayer

---

### 5. Privacy Guardrails

warn if:

- same amount reused
- withdrawal too soon
- low liquidity token
- known linked destination

---

### 6. Restrictions

disable:

vault send (public)

allow:

shield / withdraw only

---

## Deliverables

/src/privacy/provider.ts  
/src/privacy/railgun/init.ts  
/src/privacy/railgun/shield.ts  
/src/privacy/railgun/unshield.ts  
/src/privacy/fees.ts  
/src/cli/shield.ts  
/src/cli/withdraw.ts  
/src/cli/privateBalance.ts

---

## Acceptance

- direct send disabled
- shield works
- unshield works via relayer
- cost shown before execution
- recovery works from passphrase
