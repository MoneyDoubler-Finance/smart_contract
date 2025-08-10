use pump::errors::PumpError;

#[tokio::test]
async fn errors_exist() {
    let _ = PumpError::ProgramPaused;
    let _ = PumpError::ProgramCompleted;
}