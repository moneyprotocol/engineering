import assert from "assert";
import { describe, it } from "mocha";
import fc from "fast-check";

import {
  BPD_LIQUIDATION_RESERVE,
  BPD_MINIMUM_DEBT,
  MAXIMUM_BORROWING_RATE
} from "../src/constants";

import { Decimal, Difference } from "../src/Decimal";
import { Vault, _emptyVault } from "../src/Vault";

const liquidationReserve = Number(BPD_LIQUIDATION_RESERVE);
const maximumBorrowingRate = Number(MAXIMUM_BORROWING_RATE);

const maxDebt = 10 * Number(BPD_MINIMUM_DEBT);

const vault = ({ collateral = 0, debt = 0 }) =>
  new Vault(Decimal.from(collateral), Decimal.from(debt));

const onlyCollateral = () => fc.record({ collateral: fc.float({ min: 0.1 }) }).map(vault);

const onlyDebt = () =>
  fc.record({ debt: fc.float({ min: liquidationReserve, max: maxDebt }) }).map(vault);

const bothCollateralAndDebt = () =>
  fc
    .record({
      collateral: fc.float({ min: 0.1 }),
      debt: fc.float({ min: liquidationReserve, max: maxDebt })
    })
    .map(vault);

const arbitraryVault = () => fc.record({ collateral: fc.float(), debt: fc.float() }).map(vault);

const validVault = () =>
  fc
    .record({ collateral: fc.float(), debt: fc.float({ min: liquidationReserve, max: maxDebt }) })
    .map(vault);

const validNonEmptyVault = () => validVault().filter(t => !t.isEmpty);

const roughlyEqual = (a: Vault, b: Vault) =>
  a.collateral.eq(b.collateral) && !!Difference.between(a.debt, b.debt).absoluteValue?.lt(1e-9);

describe("Vault", () => {
  it("applying undefined diff should yield the same Vault", () => {
    const vault = new Vault(Decimal.from(1), Decimal.from(111));

    assert(vault.apply(undefined) === vault);
  });

  it("applying diff of empty from `b` to `a` should yield empty", () => {
    fc.assert(
      fc.property(validNonEmptyVault(), validNonEmptyVault(), (a, b) =>
        a.apply(b.whatChanged(_emptyVault)).equals(_emptyVault)
      )
    );
  });

  it("applying what changed should preserve zeroings", () => {
    fc.assert(
      fc.property(
        arbitraryVault(),
        bothCollateralAndDebt(),
        onlyCollateral(),
        (a, b, c) => a.apply(b.whatChanged(c)).debt.isZero
      )
    );

    fc.assert(
      fc.property(
        arbitraryVault(),
        bothCollateralAndDebt(),
        onlyDebt(),
        (a, b, c) => a.apply(b.whatChanged(c)).collateral.isZero
      )
    );
  });

  it("applying diff of `b` from `a` to `a` should yield `b` when borrowing rate is 0", () => {
    fc.assert(
      fc.property(validVault(), arbitraryVault(), (a, b) =>
        a.apply(a.whatChanged(b, 0), 0).equals(b)
      )
    );
  });

  it("applying diff of `b` from `a` to `a` should roughly yield `b` when borrowing rate is non-0", () => {
    fc.assert(
      fc.property(validVault(), arbitraryVault(), fc.float({ max: 0.5 }), (a, b, c) =>
        roughlyEqual(a.apply(a.whatChanged(b, c), c), b)
      )
    );
  });

  it("applying an adjustment should never throw", () => {
    fc.assert(
      fc.property(validNonEmptyVault(), validNonEmptyVault(), validNonEmptyVault(), (a, b, c) => {
        a.apply(b.whatChanged(c));
      })
    );
  });

  describe("whatChanged()", () => {
    it("should not define zeros on adjustment", () => {
      fc.assert(
        fc.property(validNonEmptyVault(), validNonEmptyVault(), (a, b) => {
          const change = a.whatChanged(b);

          return (
            change === undefined ||
            (change.type === "adjustment" &&
              !change.params.depositCollateral?.isZero &&
              !change.params.withdrawCollateral?.isZero &&
              !change.params.borrowBPD?.isZero &&
              !change.params.repayBPD?.isZero)
          );
        })
      );
    });

    it("should recreate a Vault with minimum debt at any borrowing rate", () => {
      fc.assert(
        fc.property(fc.float({ max: maximumBorrowingRate }), borrowingRate => {
          const withMinimumDebt = Vault.recreate(
            new Vault(Decimal.ONE, BPD_MINIMUM_DEBT),
            borrowingRate
          );

          const ret = Vault.create(withMinimumDebt, borrowingRate).debt.gte(BPD_MINIMUM_DEBT);

          if (!ret) {
            console.log(`${Vault.create(withMinimumDebt, borrowingRate).debt}`);
          }

          return ret;
        })
      );
    });
  });
});
