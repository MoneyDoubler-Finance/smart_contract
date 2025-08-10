SHELL := /usr/bin/bash

PROGRAM := pump
PROGRAM_KEYPAIR := target/deploy/$(PROGRAM)-keypair.json
IDL_FILE := target/idl/$(PROGRAM).json

.PHONY: build keys deploy program-id idl typegen devnet test lint check check-programs check-web

build:
	anchor build

keys:
	anchor keys sync

deploy:
	anchor deploy --provider.cluster Devnet

program-id:
	@solana address -k $(PROGRAM_KEYPAIR)

idl:
	- anchor idl fetch $$(solana address -k $(PROGRAM_KEYPAIR)) -o $(IDL_FILE)
	anchor typegen

# Runs anchor build + anchor test for the on-chain programs
check-programs: build test

# Web checks: lint and tests (prefers pnpm; workspace if available)
check-web: lint
	@set -e; \
	if command -v pnpm >/dev/null 2>&1; then \
		echo "Running pnpm test (workspace if available)"; \
		(pnpm -w test || pnpm test); \
	else \
		echo "pnpm not found, running npm test"; \
		npm test; \
	fi

# Lint workspace (prefer pnpm; workspace if available)
lint:
	@set -e; \
	if command -v pnpm >/dev/null 2>&1; then \
		echo "Running pnpm lint (workspace if available)"; \
		(pnpm -w lint || pnpm lint); \
	else \
		echo "pnpm not found, running npm run lint"; \
		npm run lint; \
	fi

# Anchor tests for programs
test:
	anchor test

# Top-level check for CI/local use
check: check-programs check-web

# Preserve existing devnet workflow
devnet: build keys deploy program-id idl
	@echo "Program ID: $$(solana address -k $(PROGRAM_KEYPAIR))"
	@echo "IDL refreshed at $(IDL_FILE)"

.PHONY: check
check:
	node scripts/idl-check.mjs