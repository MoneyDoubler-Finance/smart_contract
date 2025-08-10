## Contributing

- **Branch naming**: use prefixes
  - `feat/*` for features
  - `fix/*` for bug fixes
  - `chore/*` for maintenance
  - `test/*` for test-only changes

- **Required checks (run locally and pass in CI)**:
  - `anchor build`
  - `anchor test`
  - `pnpm -w lint` (or `npm run lint` if pnpm not installed)
  - Node tests require `ANCHOR_PROVIDER_URL` and a funded keypair via Anchor provider env when running `npm test`

- **Pull Request checklist**:
  - **IDL updated**: If program interfaces changed, run `npm run idl:refresh` and commit updated artifacts
  - **Scripts still run**: Validate `scripts/*` commands still work (e.g., configure, launch, buy/sell)
  - **Tests green**: `anchor test` and Node tests are passing

- **Make targets**:
  - `make check` — runs build+tests for programs and lint+tests for web
  - `make check-programs` — `anchor build` + `anchor test`
  - `make check-web` — lint + web tests
