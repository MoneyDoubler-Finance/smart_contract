# TypeScript release script sanity + IDL guard

- Node: 22.16.0
- npm: 10.9.2
- Anchor CLI: not available in environment (anchor not installed)

## IDL presence and program ID
- Found `target/idl/pump.json`
- IDL `address`: `CaCK9zpnvkdwmzbTX45k99kBFAb9zbAm1EU8YoVWTFcB`
- Rust `declare_id!` in `programs/pump/src/lib.rs` matches: `CaCK9zpnvkdwmzbTX45k99kBFAb9zbAm1EU8YoVWTFcB`
- Instruction present: `release_reserves` (IDL uses snake_case name)

## Scripts added
- `release:run`: ts-node --transpile-only scripts/release_min.ts (pre-existing)
- `release:encode`: ts-node --transpile-only scripts/release_encode.ts

## Encode sanity (no send)
Command:

```
MINT=<MINT_PUBKEY> npm run release:encode
```

Sample output (truncated):

```
{
  "programId": "CaCK9zpnvkdwmzbTX45k99kBFAb9zbAm1EU8YoVWTFcB",
  "mint": "...",
  "accounts": [ { "pubkey": "...", "isSigner": true, "isWritable": true }, ... ],
  "ixBase64": "okGpiOdNafM=",
  "note": "Instruction encoded from IDL discriminator; this script does not send a transaction."
}
```

## Runtime check (optional send)
- Behavior: `scripts/release_min.ts` now skips sending unless all are set: `MINT`, `RECIPIENT`, `ANCHOR_WALLET_JSON`, `ANCHOR_PROVIDER_URL`.
- To execute on devnet:

```
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
export ANCHOR_WALLET_JSON='{"pubkey":"...","secretKey":[...numbers...]}'
export MINT=<mint>
export RECIPIENT=<recipient>
npm run release:run
```

- In this environment, sending was skipped due to missing env/secrets.

## How to run
- Install deps: `npm ci`
- Build IDL if needed: `anchor build` (requires Anchor CLI; not available here)
- Encode only: `MINT=<mint> npm run release:encode`
- Optional send: set all envs above, then `npm run release:run`

## Notes
- No Rust program logic was changed.
- The encode script manually constructs the instruction from the IDL discriminator and PDA derivations; it does not submit a transaction.