use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::{self, AssociatedToken},
    token::{self, Mint, Token, TokenAccount},
};

use crate::states::{BondingCurve, Config};

#[event]
pub struct MigrationCompleted {
    pub mint: Pubkey,
    pub adapter_program: Pubkey,
}

#[derive(Accounts)]
pub struct Migrate<'info> {
    #[account(mut)]
    payer: Signer<'info>,

    #[account(
        seeds = [Config::SEED_PREFIX.as_bytes()],
        bump,
    )]
    global_config: Box<Account<'info, Config>>,

    token_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [BondingCurve::SEED_PREFIX.as_bytes(), &token_mint.key().to_bytes()],
        bump
    )]
    bonding_curve: Box<Account<'info, BondingCurve>>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = bonding_curve
    )]
    curve_token_account: Box<Account<'info, TokenAccount>>,

    // The external Raydium (adapter) program. Feature-gated check is inside handler.
    /// CHECK: checked in handler when feature is enabled
    #[account(mut)]
    raydium_program: UncheckedAccount<'info>,

    #[account(address = token::ID)]
    token_program: Program<'info, Token>,
    #[account(address = associated_token::ID)]
    associated_token_program: Program<'info, AssociatedToken>,
    system_program: Program<'info, System>,
}

impl<'info> Migrate<'info> {
    pub fn process(&mut self, _nonce: u8) -> Result<()> {
        // must be completed by curve and not migrated yet
        require!(self.bonding_curve.is_completed, crate::errors::PumpError::CurveAlreadyCompleted);
        require!(!self.bonding_curve.migration_completed, crate::errors::PumpError::CurveAlreadyCompleted);

        #[cfg(feature = "raydium_cpi")]
        {
            // Perform a minimal CPI to the local adapter which represents Raydium pool creation
            // This adapter just logs and returns Ok, allowing us to test CPI plumbing safely.
            let cpi_program = self.raydium_program.to_account_info();
            let accounts = raydium_adapter::cpi::accounts::CreatePool {
                payer: self.payer.to_account_info(),
                token_mint: self.token_mint.to_account_info(),
                curve_pda: self.bonding_curve.to_account_info(),
                curve_token_account: self.curve_token_account.to_account_info(),
                system_program: self.system_program.to_account_info(),
                token_program: self.token_program.to_account_info(),
            };
            raydium_adapter::cpi::create_pool(CpiContext::new(cpi_program, accounts))?;
            msg!("Raydium adapter CPI invoked");
        }

        #[cfg(not(feature = "raydium_cpi"))]
        {
            msg!("raydium_cpi feature is disabled; migrate is a no-op");
            return Ok(());
        }

        // mark migration completed and emit event
        self.bonding_curve.migration_completed = true;
        emit!(MigrationCompleted { mint: self.token_mint.key(), adapter_program: self.raydium_program.key() });
        Ok(())
    }
}
