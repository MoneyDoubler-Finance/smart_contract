"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const web3_js_1 = require("@solana/web3.js");
const scripts_1 = require("./scripts");
commander_1.program.version('0.0.1');
programCommand('config').action(async (directory, cmd) => {
    const { env, keypair, rpc } = cmd.opts();
    await (0, scripts_1.setClusterConfig)(env, keypair, rpc);
    await (0, scripts_1.configProject)();
});
programCommand('launch').action(async (directory, cmd) => {
    const { env, keypair, rpc } = cmd.opts();
    await (0, scripts_1.setClusterConfig)(env, keypair, rpc);
    await (0, scripts_1.launchToken)();
});
programCommand('swap')
    .option('-t, --token <string>', 'token address')
    .option('-a, --amount <number>', 'swap amount')
    .option('-s, --style <string>', '0: buy token, 1: sell token')
    .action(async (directory, cmd) => {
    const { env, keypair, rpc, token, amount, style } = cmd.opts();
    await (0, scripts_1.setClusterConfig)(env, keypair, rpc);
    if (token === undefined) {
        console.log('Error token address');
        return;
    }
    if (amount === undefined) {
        console.log('Error swap amount');
        return;
    }
    if (style === undefined) {
        console.log('Error swap style');
        return;
    }
    await (0, scripts_1.swap)(new web3_js_1.PublicKey(token), amount, style);
});
programCommand('migrate')
    .option('-t, --token <string>', 'token address')
    .action(async (directory, cmd) => {
    const { env, keypair, rpc, token } = cmd.opts();
    await (0, scripts_1.setClusterConfig)(env, keypair, rpc);
    if (token === undefined) {
        console.log('Error token address');
        return;
    }
    await (0, scripts_1.migrate)(new web3_js_1.PublicKey(token));
});
programCommand('withdraw')
    .option('-t, --token <string>', 'token address')
    .action(async (directory, cmd) => {
    const { env, keypair, rpc, token } = cmd.opts();
    await (0, scripts_1.setClusterConfig)(env, keypair, rpc);
    if (token === undefined) {
        console.log('Error token address');
        return;
    }
    await (0, scripts_1.withdraw)(new web3_js_1.PublicKey(token));
});
function programCommand(name) {
    return commander_1.program
        .command(name)
        .option(
    //  mainnet-beta, testnet, devnet
    '-e, --env <string>', 'Solana cluster env name', 'devnet')
        .option('-r, --rpc <string>', 'Solana cluster RPC name', 'https://api.devnet.solana.com')
        .option('-k, --keypair <string>', 'Solana wallet Keypair Path', '../key/uu.json');
}
commander_1.program.parse(process.argv);
