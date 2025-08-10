use anchor_lang::prelude::*;

use crate::{errors::PumpError, states::Config};

pub fn ensure_not_paused(config: &Config) -> Result<()> {
    require!(!config.paused, PumpError::ProgramPaused);
    Ok(())
}

pub fn ensure_not_completed(config: &Config) -> Result<()> {
    require!(!config.is_completed, PumpError::ProgramCompleted);
    Ok(())
}

pub fn ensure_admin(config: &Config, admin_key: &Pubkey) -> Result<()> {
    require_keys_eq!(config.authority, *admin_key, PumpError::NotAuthorized);
    Ok(())
}