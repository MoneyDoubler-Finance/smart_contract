# Security Notes

Instruction guard coverage summary:

- **configure**: admin-only (authority must equal `global_config.authority`, except first init when default). Does not use paused/completed flags to allow configuration; behavior unchanged aside from explicit admin check helper.
- **launch**: blocked when `paused` or `is_completed` on `Config` is true.
- **swap**: blocked when `paused` or `is_completed` on `Config` is true. Also blocked when per-curve `bonding_curve.is_completed` is true.
- **migrate**: admin-only; blocked when `paused` or `is_completed` on `Config` is true.
- **release_reserves**: admin-only; blocked when `paused` is true; requires `bonding_curve.is_completed`.

Table

| Instruction       | Admin required | Blocks when paused | Blocks when is_completed |
|-------------------|----------------|--------------------|---------------------------|
| configure         | Yes (except init) | No                 | No                        |
| launch            | No             | Yes                | Yes                       |
| swap              | No             | Yes                | Yes                       |
| migrate           | Yes            | Yes                | Yes                       |
| release_reserves  | Yes            | Yes                | No (but curve must be completed) |