use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("2q8EXsQ99V7F3pQq8gGjt6o3vijqjCEYazA2Yh4S4ray");

#[program]
pub mod raydium_adapter {
    use super::*;

    // Minimal stub to represent creating a Raydium pool; logs then returns Ok
    pub fn create_pool(_ctx: Context<CreatePool>) -> Result<()> {
        msg!("[raydium_adapter] create_pool called");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_mint: Account<'info, Mint>,
    /// CHECK: PDA of bonding curve from caller program
    #[account(mut)]
    pub curve_pda: UncheckedAccount<'info>,
    pub curve_token_account: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}