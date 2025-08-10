use crate::states::{BondingCurve, Config};
use anchor_lang::{prelude::*, system_program};
use anchor_lang::solana_program::sysvar::rent::Rent;
use anchor_spl::associated_token::{self, AssociatedToken};
use anchor_spl::token::{self, CloseAccount, TransferChecked, Mint, Token, TokenAccount};

#[event]
pub struct ReservesReleased {
    pub mint: Pubkey,
    pub recipient: Pubkey,
    pub lamports_sent: u64,
    pub tokens_sent: u64,
}

#[derive(Accounts)]
pub struct ReleaseReserves<'info> {
    #[account(mut, address = global_config.authority)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"global-config"],
        bump
    )]
    pub global_config: Account<'info, Config>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"bonding-curve", token_mint.key().as_ref()],
        bump
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = bonding_curve
    )]
    pub curve_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub recipient: SystemAccount<'info>,

    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = token_mint,
        associated_token::authority = recipient
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ReleaseReservesError {
    #[msg("Curve is not completed yet")]
    CurveNotCompleted,
}

impl<'info> ReleaseReserves<'info> {
    pub fn process(&mut self, bump_bonding_curve: u8) -> Result<()> {
        // ensure curve completed
        require!(self.bonding_curve.is_completed, ReleaseReservesError::CurveNotCompleted);

        // minimal SOL transfer with logging (no SPL token ops)
        let from_info = self.bonding_curve.to_account_info();
        let to_info = self.recipient.to_account_info();
        let rent = Rent::get()?;
        let min_balance = rent.minimum_balance(from_info.data_len());
        let from_before = **from_info.lamports.borrow();
        let to_before = **to_info.lamports.borrow();
        msg!("before: curve={} recipient={} min={}", from_before, to_before, min_balance);

        let mut lamports_sent: u64 = 0;
        if from_before > min_balance {
            let available = from_before.saturating_sub(min_balance);
            **from_info.try_borrow_mut_lamports()? -= available;
            **to_info.try_borrow_mut_lamports()? += available;
            lamports_sent = available;
            msg!("moved {} lamports", available);
        } else {
            msg!("nothing available (<= rent)");
        }

        let from_after = **from_info.lamports.borrow();
        let to_after = **to_info.lamports.borrow();
        msg!("after:  curve={} recipient={}", from_after, to_after);

        // Sweep tokens from curve ATA -> recipient ATA using PDA signer
        let mut tokens_sent: u64 = 0;
        let amount = self.curve_token_account.amount;
        if amount > 0 {
            let decimals = self.token_mint.decimals;
            let mint_key = self.token_mint.key();
            let signer = BondingCurve::get_signer(&mint_key, &bump_bonding_curve);
            let signer_seeds: &[&[&[u8]]] = &[&signer];

            token::transfer_checked(
                CpiContext::new_with_signer(
                    self.token_program.to_account_info(),
                    TransferChecked {
                        from: self.curve_token_account.to_account_info(),
                        mint: self.token_mint.to_account_info(),
                        to: self.recipient_token_account.to_account_info(),
                        authority: self.bonding_curve.to_account_info(),
                    },
                    signer_seeds,
                ),
                amount,
                decimals,
            )?;
            tokens_sent = amount;

            // Close curve ATA to sweep its rent to recipient (now empty)
            token::close_account(
                CpiContext::new_with_signer(
                    self.token_program.to_account_info(),
                    CloseAccount {
                        account: self.curve_token_account.to_account_info(),
                        destination: self.recipient.to_account_info(),
                        authority: self.bonding_curve.to_account_info(),
                    },
                    signer_seeds,
                ),
            )?;
        }

        // close ATA disabled in minimal patch

        emit!(ReservesReleased {
            mint: self.token_mint.key(),
            recipient: self.recipient.key(),
            lamports_sent,
            tokens_sent,
        });

        Ok(())
    }
}


