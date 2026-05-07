# Roadmap 3 — Stealth Wallet UX Layer

## Goal

Improve receiving privacy and UX.

Railgun remains main privacy layer.

---

## Core Rules

- each payment uses unique address
- no address reuse
- outbound still via Railgun

---

## Architecture

passphrase  
→ stealth keys

sender  
→ generates one-time address  
→ sends funds

receiver  
→ scans announcements  
→ detects funds

---

## Modules

### 1. Stealth Keys

derive:

- viewing key
- spending key
- meta address

---

### 2. Address Generation

generateStealthAddress(metaAddress)

---

### 3. Scanner

scanAnnouncements()  
detectPayments()

---

### 4. CLI Commands

vault stealth-address  
vault stealth-scan  
vault stealth-list

---

### 5. Flow

stealth receive  
→ shield to Railgun  
→ private balance

---

## Deliverables

/src/stealth/keys.ts  
/src/stealth/address.ts  
/src/stealth/scan.ts  
/src/cli/stealth.ts

---

## Acceptance

- unique receive addresses generated
- payments detected via scan
- funds recoverable from passphrase
- integrates with Railgun flow
