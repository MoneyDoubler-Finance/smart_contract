use anchor_lang::prelude::*;

pub mod consts;
pub mod errors;
pub mod instructions;
pub mod states;
pub mod utils;

use crate::instructions::*;

declare_id!("CaCK9zpnvkdwmzbTX45k99kBFAb9zbAm1EU8YoVWTFcB");

#[program]
pub mod pump {
    use super::*;

    //  called by admin to set global config
    //  need to check the signer is authority
    //  global guards: enforced in each handler as appropriate
    pub fn configure(ctx: Context<Configure>, new_config: states::Config) -> Result<()> {
        ctx.accounts.process(new_config)
    }

    //  called by a creator to launch a token on the platform
    //  global guards: paused/completed enforced
    pub fn launch<'info>(
        ctx: Context<'_, '_, '_, 'info, Launch<'info>>,

        //  metadata
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        ctx.accounts
            .process(name, symbol, uri, ctx.bumps.global_config)
    }

    //  called by a user to swap token/sol
    //  global guards: paused/completed enforced
    pub fn swap<'info>(
        ctx: Context<'_, '_, '_, 'info, Swap<'info>>,
        amount: u64,
        direction: u8,
        min_out: u64,
    ) -> Result<()> {
        ctx.accounts
            .process(amount, direction, min_out, ctx.bumps.bonding_curve)
    }

    ////////////////////    DM if you want full implementation  ////////////////////
    // telegram - https://t.me/microgift88
    // discord - https://discord.com/users/1074514238325927956

    //  migrate the token to raydium once a curve reaches the limit
    //  global guards: paused/completed and admin enforced
    pub fn migrate<'info>(
        ctx: Context<'_, '_, '_, 'info, Migrate<'info>>,
        nonce: u8,
    ) -> Result<()> {
        ctx.accounts.process(nonce)
    }

    // release reserves from completed curve to recipient
    // global guards: paused and admin enforced
    pub fn release_reserves<'info>(
        ctx: Context<'_, '_, '_, 'info, ReleaseReserves<'info>>,
    ) -> Result<()> {
        ctx.accounts.process(ctx.bumps.bonding_curve)
    }
}

#[cfg(test)]
mod compile_variants {
    #[test]
    #[cfg(feature = "raydium_cpi")]
    fn builds_with_raydium_cpi_feature() {
        assert!(true);
    }

    #[test]
    #[cfg(not(feature = "raydium_cpi"))]
    fn builds_without_raydium_cpi_feature() {
        assert!(true);
    }
}
