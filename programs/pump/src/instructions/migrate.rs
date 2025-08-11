use anchor_lang::prelude::*;
use crate::{states::Config, utils::{ensure_admin, ensure_not_completed, ensure_not_paused, ensure_expected_program}};

#[derive(Accounts)]
pub struct Migrate<'info> {
    #[account(mut)]
    payer: Signer<'info>,

    #[account(seeds = [Config::SEED_PREFIX.as_bytes()], bump)]
    global_config: Account<'info, Config>,

    /// CHECK: validated against expected program id in config if configured
    raydium_program: UncheckedAccount<'info>,
    /// CHECK: validated against expected program id in config if configured
    meteora_program: UncheckedAccount<'info>,
}

impl<'info> Migrate<'info> {
    pub fn process(&mut self, _nonce: u8) -> Result<()> {
        // Only admin may migrate and only when not paused and not completed
        ensure_not_paused(&self.global_config.as_ref())?;
        ensure_not_completed(&self.global_config.as_ref())?;
        ensure_admin(&self.global_config.as_ref(), &self.payer.key())?;

        // Validate external programs if expectations are configured
        ensure_expected_program(self.raydium_program.key, &self.global_config.expected_raydium_program)?;
        ensure_expected_program(self.meteora_program.key, &self.global_config.expected_meteora_program)?;

        ////////////////////    DM if you want full implementation    ////////////////////
        // telegram - https://t.me/microgift88
        // discord - https://discord.com/users/1074514238325927956
        
        Ok(())
    }
}
