# Solana smart contract for pump.fun

> You can check frontend and backend repo as well.  
> https://github.com/m8s-lab/pump-fun-frontend  
> https://github.com/m8s-lab/pump-fun-backend

You can contact me if you want a better product.

## Available features
- All handled in smart contracts:  
  Token creation and Raydium deposits are handled in the smart contract.

- Enable sniping:  
  Add `Presale` phase before the launch to allow snipers.

- Raydium/Meteora migration:  
  Token launchers can migrate their tokens to Raydium or Meteora as they wish after the curve is completed.

- Set curve limit and fee as stable price:  
  Calculate market cap in each swap instruction using oracle.

Telegram: https://t.me/microgift88  
Discord: https://discord.com/users/1074514238325927956

## Test addresses and transactions
- Contract  
  https://solscan.io/account/Cu3ZCXsVh7xC64gWH23vjDeytWC6ZGcMRVYZAka92QTq?cluster=devnet
- Token launch tx  
  https://solscan.io/tx/sc1apfAXUkGHycbzPHzqcrKxEc4JVQj9zq6i26HjrRAHFR6QGPJYLLuhBRN42Gfk6Xhehji2yMHNViJUL9ga4pU?cluster=devnet
- Launched token address  
  https://solscan.io/token/5WFBKTKq8Ks6HDMZXEfqRTVX4oPop1Yv5kmyznJYp9hE?cluster=devnet
- Buy tx  
  https://solscan.io/tx/3kGJc35TScHs9YjrKqSeGjjGo3MHUjqTTdVoxp7GNUAKqB9eHsjhzWN6Se4ZjrCqC33wrUT4iZj11wZuK8sbbdeY?cluster=devnet
- Sell tx  
  https://solscan.io/tx/tMUqR8cYkYs9hNsA3GCmsj7HC83JdFX6naM13pgXYAY3rT6RZ5yEk9cWaXnVdTjk1josgByezjoLbuGxFD6CPQj?cluster=devnet
- Raydium migration tx  
  https://solscan.io/tx/2JC62ARcT3hopESk99gUQec9HVpdQwPHKnRoY9z7xiMUn4Xcoth3YnLdikuyozSXrp4Y8ez1oLCc2DM9wfyJSoYE?cluster=devnet

## Prerequisites

Install Rust, Solana, and Anchor.  
Here's a useful link: https://anchor-lang.com/docs/installation

```bash
# check rust version
rustc --version

# check solana version
solana --version

# check anchor version
# should be 0.30.1
anchor --version

# check solana configuration
solana config get

# set solana rpc as devnet
solana config set --url devnet

# check wallet set in the config
solana balance

# generate new wallet if doesn't exist
solana-keygen new

# airdrop some devnet SOL
solana airdrop 5

Prepare the project:

# clone the git repo
git clone https://github.com/...

# install node modules
yarn

Quick Start

Build the program

# build the program
# it will generate new keypair for the program if doesn't exist
# and it will make a build version
anchor build

# sync all keys in program
anchor keys sync

# build again if the program address in lib.rs is changed
anchor build

# you can get keypair and so file here
# ./target/deploy/pumpfun-keypair.json
# ./target/deploy/pumpfun.so

Run tests on localnet

Set the cluster as localnet in Anchor.toml:

[provider]
cluster = "Localnet"

Run the tests:

anchor test --provider.cluster Localnet

Test program on devnet

Set the cluster as devnet in Anchor.toml:

[provider]
cluster = "<DEVNET_RPC>"

Deploy program:

anchor deploy

Use CLI to test the program

Configure (admin & fees):

yarn configure:run --fees 0.02 --send

Launch a token:

yarn launch:run --name "MyToken" --symbol "MYT" --uri "https://example.com/metadata.json" --send

Buy on the curve (lamports):

yarn buy:run --mint <MINT> --lamports 1000000 --send

Sell tokens (raw token units, respect mint decimals):

yarn sell:run --mint <MINT> --rawTokens 123456 --send

Inspect curve state:

yarn curve-state:run --mint <MINT>

Release reserves to a recipient (after curve completion, admin-only):

yarn release:run --mint <MINT> --recipient <RECIPIENT_PUBKEY> --send

Devnet deploy workflow
	•	Ensure you have a wallet with devnet SOL and Anchor installed.
	•	To use a wallet secret stored in an environment/CI secret:

# If your secret is base64-encoded JSON (recommended)
mkdir -p ~/.config/solana
printf "%s" "$DEVNET_WALLET_BASE64" | base64 -d > ~/.config/solana/id.json
chmod 600 ~/.config/solana/id.json

# Or if your secret is raw JSON content
mkdir -p ~/.config/solana
printf "%s" "$DEVNET_WALLET_JSON" > ~/.config/solana/id.json
chmod 600 ~/.config/solana/id.json

# Point Anchor/Solana to this keypair
export ANCHOR_WALLET=~/.config/solana/id.json
solana config set --keypair ~/.config/solana/id.json
solana config set --url devnet

	•	Build, deploy to devnet, print Program ID, and refresh the IDL in one command:

yarn devnet:deploy

This will:
	•	Build the program
	•	Sync keys
	•	Deploy to devnet
	•	Print the Program ID
	•	Refresh the IDL and TypeScript types (target/idl/pump.json, target/types)

You can run these individually as well:

yarn program:id
yarn idl:refresh

Notes:
	•	You can override the wallet path with ANCHOR_WALLET without editing Anchor.toml.
	•	You can override the cluster with ANCHOR_PROVIDER_URL (e.g., a custom devnet RPC).

Running locally
	•	Ensure Anchor CLI and a Solana validator are installed
	•	Build: anchor build
	•	Tests (TypeScript): anchor test
	•	Optional Rust tests: cargo test -p pump
