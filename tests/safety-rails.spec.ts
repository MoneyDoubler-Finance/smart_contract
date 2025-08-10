import * as fs from "fs";
import * as path from "path";
import { strict as assert } from "assert";

// Minimal tests that only parse IDL and source to validate safety-rails presence
// These do not require a running validator

describe("safety-rails idl sanity", () => {
  const idlPath = path.resolve(__dirname, "../target/idl/pump.json");
  const rustLibPath = path.resolve(__dirname, "../programs/pump/src/lib.rs");

  it("IDL exists", () => {
    assert.ok(
      fs.existsSync(idlPath),
      "IDL file missing at target/idl/pump.json",
    );
  });

  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));

  it("Program ID in IDL matches declare_id! in Rust", () => {
    const idlAddress: string = idl.address;
    const rustSrc = fs.readFileSync(rustLibPath, "utf8");
    const m = rustSrc.match(/declare_id!\("([^"]+)"\)/);
    assert.ok(m && m[1], "declare_id! not found in Rust");
    const rustProgramId = m![1];
    assert.equal(
      idlAddress,
      rustProgramId,
      "IDL address does not match declare_id!",
    );
  });

  it("IDL has expected accounts and fields in types", () => {
    const types: any[] = idl.types || [];
    const config = types.find((t) => t.name === "Config");
    const bondingCurve = types.find((t) => t.name === "BondingCurve");

    assert.ok(config, "Config type missing");
    assert.ok(bondingCurve, "BondingCurve type missing");

    const configFields = (config?.type?.fields || []).map((f: any) => f.name);
    const bondingFields = (bondingCurve?.type?.fields || []).map(
      (f: any) => f.name,
    );

    assert.ok(configFields.includes("authority"), "Config.authority missing");

    // Expected safety-rails: paused should exist on global state
    // This assertion will FAIL if paused is missing (intended to reflect PR requirement)
    assert.ok(configFields.includes("paused"), "Config.paused missing");

    assert.ok(
      bondingFields.includes("is_completed"),
      "BondingCurve.is_completed missing",
    );
  });

  it("IDL includes required safety-rail instructions", () => {
    const instructions: any[] = idl.instructions || [];
    const names = new Set(instructions.map((ix) => ix.name));

    // Expect initialize, setAdmin, pause, unpause, release_reserves
    assert.ok(names.has("initialize"), "initialize instruction missing");
    assert.ok(names.has("setAdmin"), "setAdmin instruction missing");
    assert.ok(names.has("pause"), "pause instruction missing");
    assert.ok(names.has("unpause"), "unpause instruction missing");
    assert.ok(
      names.has("release_reserves") || names.has("releaseReserves"),
      "releaseReserves instruction missing",
    );
  });

  it("PDA seed stability: global-config and bonding-curve unchanged", () => {
    const instructions: any[] = idl.instructions || [];

    const configSeedsPresent = instructions.some((ix) =>
      (ix.accounts || []).some(
        (a: any) => a.name === "global_config" || a.name === "globalConfig",
      ),
    );
    assert.ok(
      configSeedsPresent,
      "global_config PDA not referenced in any instruction",
    );

    const bondingSeedsPresent = instructions.some((ix) =>
      (ix.accounts || []).some(
        (a: any) => a.name === "bonding_curve" || a.name === "bondingCurve",
      ),
    );
    assert.ok(
      bondingSeedsPresent,
      "bonding_curve PDA not referenced in any instruction",
    );

    // Optionally verify specific seed bytes where available in IDL metadata
    const hasGlobalSeedConst = instructions.some((ix) =>
      (ix.accounts || []).some((a: any) =>
        (a.pda?.seeds || []).some(
          (s: any) =>
            Array.isArray(s.value) &&
            Buffer.from(s.value).toString("utf8") === "global-config",
        ),
      ),
    );
    assert.ok(
      hasGlobalSeedConst,
      "global-config seed constant not found in IDL",
    );

    const hasBondingSeedConst = instructions.some((ix) =>
      (ix.accounts || []).some((a: any) =>
        (a.pda?.seeds || []).some(
          (s: any) =>
            Array.isArray(s.value) &&
            Buffer.from(s.value).toString("utf8") === "bonding-curve",
        ),
      ),
    );
    assert.ok(
      hasBondingSeedConst,
      "bonding-curve seed constant not found in IDL",
    );
  });
});
