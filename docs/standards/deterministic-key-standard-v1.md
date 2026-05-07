# Luckybox Deterministic Key Standard v1

This is the recovery standard name for this system.

If you remember:

1. `passphrase`
2. `wallet_salt` (`BRAIN_WALLET_SALT`)
3. this standard definition

you can deterministically recover the same key material even without this codebase.

## Deterministic Method

1. Normalize passphrase with Unicode `NFKD`.
2. Derive 32-byte seed using `scrypt`:
   - password: normalized passphrase
   - salt: `wallet_salt`
   - `N = 32768`, `r = 8`, `p = 1`
   - output length: `32` bytes
3. Derive child keys using BIP32/BIP44 path:
   - base path: `m/44'/60'/0'/0/{index}`
   - `box1 => index 0`, `box2 => index 1`, etc.
4. Derive EVM address from each child private key on secp256k1.

## Public Standards References

- BIP-0032 (Hierarchical Deterministic Keys):
  - https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
- BIP-0044 (Derivation Path Structure):
  - https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki
- SLIP-0044 (Coin Type Registry; Ethereum = 60):
  - https://slips.readthedocs.io/en/latest/slip-0044/
- RFC 7914 (`scrypt`):
  - https://www.rfc-editor.org/rfc/rfc7914

Note: there is no canonical Ethereum EIP that defines this exact passphrase+salt deterministic scheme.
The system is built from these public standards.

## Canonical String

`Luckybox Deterministic Key Standard v1: scrypt(NFKD(passphrase), wallet_salt, N=32768,r=8,p=1,dkLen=32) -> BIP32/BIP44 m/44'/60'/0'/0/{index}`
