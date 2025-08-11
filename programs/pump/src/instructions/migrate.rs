use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use crate::{
    states::{Config, BondingCurve},
    utils::{ensure_admin, ensure_not_completed, ensure_not_paused},
};
use crate::instructions::ReleaseReservesError;

#[derive(Accounts)]
pub struct Migrate<'info> {
    // Load config first so downstream constraints can reference it cheaply
    #[account(seeds = [Config::SEED_PREFIX.as_bytes()], bump)]
    global_config: Box<Account<'info, Config>>,

    #[account(mut, address = global_config.authority)]
    payer: Signer<'info>,

    token_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [BondingCurve::SEED_PREFIX.as_bytes(), &token_mint.key().to_bytes()],
        bump
    )]
    bonding_curve: Box<Account<'info, BondingCurve>>,
}

impl<'info> Migrate<'info> {
    pub fn process(&mut self, _nonce: u8) -> Result<()> {
        // Only admin may migrate and only when not paused and not completed
        ensure_not_paused(&self.global_config.as_ref())?;
        ensure_not_completed(&self.global_config.as_ref())?;
        ensure_admin(&self.global_config.as_ref(), &self.payer.key())?;

        // Require curve to be completed
        require!(self.bonding_curve.is_completed, ReleaseReservesError::CurveNotCompleted);

        // Mark program as completed to prevent re-migration
        self.global_config.is_completed = true;

        ////////////////////    DM if you want full implementation    ////////////////////
        // telegram - https://t.me/microgift88
        // discord - https://discord.com/users/1074514238325927956
        
        Ok(())
    }
}
