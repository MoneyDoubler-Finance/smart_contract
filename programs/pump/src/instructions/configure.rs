use crate::{states::Config, utils::{ensure_admin}};
use anchor_lang::{prelude::*, system_program};

#[derive(Accounts)]
pub struct Configure<'info> {
    #[account(mut)]
    admin: Signer<'info>,

    #[account(
        init_if_needed,
        payer = admin,
        seeds = [Config::SEED_PREFIX.as_bytes()],
        space = 8 + Config::LEN,
        bump,
    )]
    global_config: Account<'info, Config>,

    #[account(address = system_program::ID)]
    system_program: Program<'info, System>,
}

impl<'info> Configure<'info> {
    pub fn process(&mut self, new_config: Config) -> Result<()> {
        // Admin-only (allow first-time init when authority is default)
        if !self.global_config.authority.eq(&Pubkey::default()) {
            ensure_admin(&self.global_config.as_ref(), &self.admin.key())?;
        }

        self.global_config.set_inner(new_config);

        Ok(())
    }
}
