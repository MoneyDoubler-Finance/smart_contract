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

pub fn ensure_launch_allowed(config: &Config) -> Result<()> {
    require!(!config.pause_launch, PumpError::ProgramPaused);
    Ok(())
}

pub fn ensure_swap_allowed(config: &Config) -> Result<()> {
    require!(!config.pause_swap, PumpError::ProgramPaused);
    Ok(())
}

pub fn ensure_expected_program(actual: &Pubkey, expected: &Pubkey) -> Result<()> {
    if *expected != Pubkey::default() {
        require_keys_eq!(*actual, *expected, PumpError::UnexpectedProgramId);
    }
    Ok(())
}