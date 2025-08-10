SHELL := /usr/bin/bash

PROGRAM := pump
PROGRAM_KEYPAIR := target/deploy/$(PROGRAM)-keypair.json
IDL_FILE := target/idl/$(PROGRAM).json

.PHONY: build keys deploy program-id idl typegen devnet

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

devnet: build keys deploy program-id idl
	@echo "Program ID: $$(solana address -k $(PROGRAM_KEYPAIR))"
	@echo "IDL refreshed at $(IDL_FILE)"