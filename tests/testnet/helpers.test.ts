import { describe, expect, it } from "vitest";
import { hasConfiguredTokenSymbol } from "./helpers";

describe("testnet helpers", () => {
  it("returns false when the requested token symbol is missing from VAULT_ERC20_TOKENS", () => {
    expect(hasConfiguredTokenSymbol("USDT", "DAI:0x1111111111111111111111111111111111111111")).toBe(
      false
    );
  });

  it("returns true when the requested token symbol is present with a valid address", () => {
    expect(
      hasConfiguredTokenSymbol("USDT", "USDT:0x1111111111111111111111111111111111111111")
    ).toBe(true);
  });
});
