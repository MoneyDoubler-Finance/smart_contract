use anchor_lang::prelude::*;
use crate::{states::Config, utils::{ensure_admin, ensure_not_completed, ensure_not_paused}};

#[derive(Accounts)]
pub struct Migrate<'info> {
    #[account(mut)]
    payer: Signer<'info>,

    #[account(seeds = [Config::SEED_PREFIX.as_bytes()], bump)]
    global_config: Account<'info, Config>,
}

impl<'info> Migrate<'info> {
    pub fn process(&mut self, _nonce: u8) -> Result<()> {
        // Only admin may migrate and only when not paused and not completed
        ensure_not_paused(&self.global_config.as_ref())?;
        ensure_not_completed(&self.global_config.as_ref())?;
        ensure_admin(&self.global_config.as_ref(), &self.payer.key())?;

        ////////////////////    DM if you want full implementation    ////////////////////
        // telegram - https://t.me/microgift88
        // discord - https://discord.com/users/1074514238325927956
        
        Ok(())
    }
}


use anchor_spl::{
    token::{self, Mint, Token, TokenAccount, SyncNative},
    associated_token::AssociatedToken,
};
use crate::states::{BondingCurve, Config};

#[event]
pub struct MigratedToRaydium {
    pub pool: Pubkey,
    pub lp_mint: Pubkey,
    pub amount_token: u64,
    pub amount_wsol: u64,
}

#[error_code]
pub enum MigrateError {
    #[msg("Curve is not completed yet")]
    CurveNotCompleted,
    #[msg("Raydium program not allowed")]
    RaydiumProgramNotAllowed,
}

#[derive(Accounts)]
pub struct MigrateToRaydium<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(seeds = [Config::SEED_PREFIX.as_bytes()], bump)]
    pub global_config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [BondingCurve::SEED_PREFIX.as_bytes(), token_mint.key().as_ref()],
        bump
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = bonding_curve
    )]
    pub curve_token_account: Account<'info, TokenAccount>,

    /// CHECK: native wSOL token account owned by bonding_curve (ATA for NATIVE_MINT)
    #[account(mut)]
    pub curve_wsol_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub lp_token_destination: Account<'info, TokenAccount>,

    /// CHECK: Raydium program and accounts; validated off-chain or via allowlist
    pub raydium_program: UncheckedAccount<'info>,
    /// CHECK: Raydium CPMM config/state
    #[account(mut)]
    pub amm_config: UncheckedAccount<'info>,
    /// CHECK:
    #[account(mut)]
    pub pool_state: UncheckedAccount<'info>,
    /// CHECK:
    #[account(mut)]
    pub pool_vault_token: UncheckedAccount<'info>,
    /// CHECK:
    #[account(mut)]
    pub pool_vault_wsol: UncheckedAccount<'info>,
    /// CHECK:
    #[account(mut)]
    pub lp_mint: UncheckedAccount<'info>,
    /// CHECK:
    #[account(mut)]
    pub observation_state: UncheckedAccount<'info>,

    pub wsol_mint: Account<'info, Mint>,

    /// CHECK: must equal global_config.fee_recipient
    #[account(mut)]
    pub fee_recipient: SystemAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> MigrateToRaydium<'info> {
    pub fn process(&mut self, _bump_bonding_curve: u8) -> Result<()> {
        // Admin-only and curve completion checks
        require_keys_eq!(self.global_config.authority, self.admin.key(), crate::errors::PumpError::NotAuthorized);
        require!(self.bonding_curve.is_completed, MigrateError::CurveNotCompleted);
        require_keys_eq!(self.global_config.fee_recipient, self.fee_recipient.key(), crate::errors::PumpError::IncorrectFeeRecipient);

        // Wrap SOL into wSOL (move lamports from bonding_curve PDA to wSOL native account, then sync)
        let from_info = self.bonding_curve.to_account_info();
        let wsol_info = self.curve_wsol_account.to_account_info();
        let rent = Rent::get()?;
        let min_balance = rent.minimum_balance(from_info.data_len());
        let from_before = **from_info.lamports.borrow();
        let mut amount_wrapped: u64 = 0;
        if from_before > min_balance {
            let to_wrap = from_before.saturating_sub(min_balance);
            **from_info.try_borrow_mut_lamports()? -= to_wrap;
            **wsol_info.try_borrow_mut_lamports()? += to_wrap;
            amount_wrapped = to_wrap;

            // sync native
            token::sync_native(CpiContext::new(
                self.token_program.to_account_info(),
                SyncNative { account: self.curve_wsol_account.to_account_info() },
            ))?;
        }

        // TODO: Raydium CPI create pool / add liquidity (placeholder)
        msg!("[raydium] create_pool + add_liquidity placeholder");

        // Emit event with observed balances
        let amount_token = self.curve_token_account.amount;
        let amount_wsol = self.curve_wsol_account.amount;
        emit!(MigratedToRaydium {
            pool: self.pool_state.key(),
            lp_mint: self.lp_mint.key(),
            amount_token,
            amount_wsol,
        });

        // Drain any dust lamports from curve PDA to fee_recipient (leave rent)
        let from_after = **from_info.lamports.borrow();
        if from_after > min_balance {
            let dust = from_after.saturating_sub(min_balance);
            **from_info.try_borrow_mut_lamports()? -= dust;
            **self.fee_recipient.to_account_info().try_borrow_mut_lamports()? += dust;
        }

        Ok(())
    }
}
