## Devnet Smoke Tests

This repo includes end-to-end smoke tests that exercise the full happy path on Solana devnet:
- configure → launch → buy until curve completion → release_reserves
- verifies SOL drained to recipient (leaving rent), curve ATA swept/closed if empty
- error cases: NotAdmin on configure and CurveNotCompleted on release_reserves

### Prerequisites
- Node 18+
- Yarn or npm
- Anchor CLI 0.30.x and Solana CLI (optional, for wallet management)
- A funded devnet keypair JSON file

### Environment
Set these environment variables so the tests run against devnet with your wallet:

- `ANCHOR_PROVIDER_URL=https://api.devnet.solana.com`
- `ANCHOR_WALLET=/path/to/your/devnet/keypair.json`

Ensure the wallet has some devnet SOL. The tests will airdrop to ephemeral accounts as needed.

### Install deps

```bash
yarn install
# or npm ci
```

### Run the tests

```bash
# Run only the smoke test with a generous timeout
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
ANCHOR_WALLET=$HOME/.config/solana/id.json \
yarn run ts-mocha -p ./tsconfig.json -t 900000 tests/smoke.devnet.ts
```

Alternatively, run all tests:

```bash
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
ANCHOR_WALLET=$HOME/.config/solana/id.json \
yarn test
```

### Notes
- The program ID is read from `target/idl/pump.json` (`address`). Ensure your devnet deployment matches this address.
- If a shared devnet deployment already has a configured `global-config` with a different admin, the configure test may fail by design. Deploy your own program ID to devnet if needed.
- The tests perform real transactions on devnet; allow several minutes to complete.