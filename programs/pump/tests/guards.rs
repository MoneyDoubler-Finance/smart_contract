use pump::errors::PumpError;
use pump::states::Config;
use pump::utils::{ensure_admin, ensure_not_completed, ensure_not_paused};
use solana_program::pubkey::Pubkey;

fn dummy_config(paused: bool, completed: bool, authority: Pubkey) -> Config {
    Config {
        authority,
        fee_recipient: Pubkey::new_unique(),
        curve_limit: 0,
        initial_virtual_token_reserves: 0,
        initial_virtual_sol_reserves: 0,
        initial_real_token_reserves: 0,
        total_token_supply: 0,
        buy_fee_percent: 0.0,
        sell_fee_percent: 0.0,
        migration_fee_percent: 0.0,
        paused,
        is_completed: completed,
    }
}

#[tokio::test]
async fn errors_exist() {
    let _ = PumpError::ProgramPaused;
    let _ = PumpError::ProgramCompleted;
}

#[tokio::test]
async fn guard_not_paused_ok() {
    let cfg = dummy_config(false, false, Pubkey::new_unique());
    assert!(ensure_not_paused(&cfg).is_ok());
}

#[tokio::test]
async fn guard_not_paused_err() {
    let cfg = dummy_config(true, false, Pubkey::new_unique());
    let err = ensure_not_paused(&cfg).unwrap_err();
    assert_eq!(err, PumpError::ProgramPaused.into());
}

#[tokio::test]
async fn guard_not_completed_ok() {
    let cfg = dummy_config(false, false, Pubkey::new_unique());
    assert!(ensure_not_completed(&cfg).is_ok());
}

#[tokio::test]
async fn guard_not_completed_err() {
    let cfg = dummy_config(false, true, Pubkey::new_unique());
    let err = ensure_not_completed(&cfg).unwrap_err();
    assert_eq!(err, PumpError::ProgramCompleted.into());
}

#[tokio::test]
async fn guard_admin_ok() {
    let admin = Pubkey::new_unique();
    let cfg = dummy_config(false, false, admin);
    assert!(ensure_admin(&cfg, &admin).is_ok());
}

#[tokio::test]
async fn guard_admin_err() {
    let cfg = dummy_config(false, false, Pubkey::new_unique());
    let not_admin = Pubkey::new_unique();
    let err = ensure_admin(&cfg, &not_admin).unwrap_err();
    assert_eq!(err, PumpError::NotAuthorized.into());
}