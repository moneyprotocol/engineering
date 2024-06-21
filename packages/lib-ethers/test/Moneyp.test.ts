import chai, { expect, assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { AddressZero } from "@ethersproject/constants";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, network, deployMoneyp } from "hardhat";

import {
  Decimal,
  Decimalish,
  Vault,
  StabilityDeposit,
  MoneypReceipt,
  SuccessfulReceipt,
  SentMoneypTransaction,
  VaultCreationParams,
  Fees,
  BPD_LIQUIDATION_RESERVE,
  MAXIMUM_BORROWING_RATE,
  MINIMUM_BORROWING_RATE,
  BPD_MINIMUM_DEBT,
  BPD_MINIMUM_NET_DEBT,
} from "@moneyprotocol/lib-base";

import { HintHelpers } from "../types";

import {
  PopulatableBitcoinsMoneyp,
  PopulatedBitcoinsMoneypTransaction,
  _redeemMaxIterations,
} from "../src/PopulatableBitcoinsMoneyp";

import { _MoneypDeploymentJSON } from "../src/contracts";
import { _connectToDeployment } from "../src/BitcoinsMoneypConnection";
import { BitcoinsMoneyp } from "../src/BitcoinsMoneyp";
import { ReadableBitcoinsMoneyp } from "../src/ReadableBitcoinsMoneyp";

const provider = ethers.provider;

chai.use(chaiAsPromised);
chai.use(chaiSpies);

const connectToDeployment = async (
  deployment: _MoneypDeploymentJSON,
  signer: Signer,
  frontendTag?: string
) =>
  BitcoinsMoneyp._from(
    _connectToDeployment(deployment, signer, {
      userAddress: await signer.getAddress(),
      frontendTag,
    })
  );

const increaseTime = async (timeJumpSeconds: number) => {
  await provider.send("evm_increaseTime", [timeJumpSeconds]);
};

function assertStrictEqual<T, U extends T>(
  actual: T,
  expected: U,
  message?: string
): asserts actual is U {
  assert.strictEqual(actual, expected, message);
}

function assertDefined<T>(actual: T | undefined): asserts actual is T {
  assert(actual !== undefined);
}

const waitForSuccess = async <T extends MoneypReceipt>(
  tx: Promise<SentMoneypTransaction<unknown, T>>
) => {
  const receipt = await (await tx).waitForReceipt();
  assertStrictEqual(receipt.status, "succeeded" as const);

  return receipt as Extract<T, SuccessfulReceipt>;
};

// TODO make the testcases isolated

describe("BitcoinsMoneyp", () => {
  let deployer: Signer;
  let funder: Signer;
  let user: Signer;
  let otherUsers: Signer[];

  let deployment: _MoneypDeploymentJSON;

  let deployerMoneyp: BitcoinsMoneyp;
  let moneyp: BitcoinsMoneyp;
  let otherLiquities: BitcoinsMoneyp[];

  const connectUsers = (users: Signer[]) =>
    Promise.all(users.map((user) => connectToDeployment(deployment, user)));

  const openVaults = (
    users: Signer[],
    params: VaultCreationParams<Decimalish>[]
  ) =>
    params
      .map(
        (params, i) => () =>
          Promise.all([
            connectToDeployment(deployment, users[i]),
            sendTo(users[i], params.depositCollateral).then((tx) => tx.wait()),
          ]).then(async ([moneyp]) => {
            await moneyp.openVault(params, undefined, { gasPrice: 0 });
          })
      )
      .reduce((a, b) => a.then(b), Promise.resolve());

  const sendTo = (user: Signer, value: Decimalish, nonce?: number) =>
    funder.sendTransaction({
      to: user.getAddress(),
      value: Decimal.from(value).hex,
      nonce,
    });

  const sendToEach = async (users: Signer[], value: Decimalish) => {
    const txCount = await provider.getTransactionCount(funder.getAddress());
    const txs = await Promise.all(
      users.map((user, i) => sendTo(user, value, txCount + i))
    );

    // Wait for the last tx to be mined.
    await txs[txs.length - 1].wait();
  };

  before(async () => {
    [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
    deployment = await deployMoneyp(deployer);

    moneyp = await connectToDeployment(deployment, user);
    expect(moneyp).to.be.an.instanceOf(BitcoinsMoneyp);
  });

  // Always setup same initial balance for user
  beforeEach(async () => {
    const targetBalance = BigNumber.from(Decimal.from(100).hex);
    const balance = await user.getBalance();
    const gasPrice = 0;

    if (balance.eq(targetBalance)) {
      return;
    }

    if (balance.gt(targetBalance)) {
      await user.sendTransaction({
        to: funder.getAddress(),
        value: balance.sub(targetBalance),
        gasPrice,
      });
    } else {
      await funder.sendTransaction({
        to: user.getAddress(),
        value: targetBalance.sub(balance),
        gasPrice,
      });
    }

    expect(`${await user.getBalance()}`).to.equal(`${targetBalance}`);
  });

  it("should get the price", async () => {
    const price = await moneyp.getPrice();
    expect(price).to.be.an.instanceOf(Decimal);
  });

  describe("findHintForCollateralRatio", () => {
    it("should pick the closest approx hint", async () => {
      type Resolved<T> = T extends Promise<infer U> ? U : never;
      type ApproxHint = Resolved<ReturnType<HintHelpers["getApproxHint"]>>;

      const fakeHints: ApproxHint[] = [
        {
          diff: BigNumber.from(3),
          hintAddress: "alice",
          latestRandomSeed: BigNumber.from(1111),
        },
        {
          diff: BigNumber.from(4),
          hintAddress: "bob",
          latestRandomSeed: BigNumber.from(2222),
        },
        {
          diff: BigNumber.from(1),
          hintAddress: "carol",
          latestRandomSeed: BigNumber.from(3333),
        },
        {
          diff: BigNumber.from(2),
          hintAddress: "dennis",
          latestRandomSeed: BigNumber.from(4444),
        },
      ];

      const borrowerOperations = {
        estimateAndPopulate: {
          openVault: () => ({}),
        },
      };

      const hintHelpers = chai.spy.interface({
        getApproxHint: () => Promise.resolve(fakeHints.shift()),
      });

      const sortedVaults = chai.spy.interface({
        findInsertPosition: () => Promise.resolve(["fake insert position"]),
      });

      const fakeMoneyp = new PopulatableBitcoinsMoneyp({
        getNumberOfVaults: () => Promise.resolve(1000000),
        getFees: () =>
          Promise.resolve(new Fees(0, 0.99, 1, new Date(), new Date(), false)),

        connection: {
          signerOrProvider: user,
          _contracts: {
            borrowerOperations,
            hintHelpers,
            sortedVaults,
          },
        },
      } as unknown as ReadableBitcoinsMoneyp);

      const nominalCollateralRatio = Decimal.from(0.05);

      const params = Vault.recreate(
        new Vault(Decimal.from(1), BPD_MINIMUM_DEBT)
      );
      const vault = Vault.create(params);
      expect(`${vault._nominalCollateralRatio}`).to.equal(
        `${nominalCollateralRatio}`
      );

      await fakeMoneyp.openVault(params);

      expect(hintHelpers.getApproxHint).to.have.been.called.exactly(4);
      expect(hintHelpers.getApproxHint).to.have.been.called.with(
        nominalCollateralRatio.hex
      );

      // returned latestRandomSeed should be passed back on the next call
      expect(hintHelpers.getApproxHint).to.have.been.called.with(
        BigNumber.from(1111)
      );
      expect(hintHelpers.getApproxHint).to.have.been.called.with(
        BigNumber.from(2222)
      );
      expect(hintHelpers.getApproxHint).to.have.been.called.with(
        BigNumber.from(3333)
      );

      expect(sortedVaults.findInsertPosition).to.have.been.called.once;
      expect(sortedVaults.findInsertPosition).to.have.been.called.with(
        nominalCollateralRatio.hex,
        "carol"
      );
    });
  });

  describe("Vault", () => {
    it("should have no Vault initially", async () => {
      const vault = await moneyp.getVault();
      expect(vault.isEmpty).to.be.true;
    });

    it("should fail to create an undercollateralized Vault", async () => {
      const price = await moneyp.getPrice();
      const undercollateralized = new Vault(
        BPD_MINIMUM_DEBT.div(price),
        BPD_MINIMUM_DEBT
      );

      await expect(moneyp.openVault(Vault.recreate(undercollateralized))).to
        .eventually.be.rejected;
    });

    it("should fail to create a Vault with too little debt", async () => {
      const withTooLittleDebt = new Vault(
        Decimal.from(50),
        BPD_MINIMUM_DEBT.sub(1)
      );

      await expect(moneyp.openVault(Vault.recreate(withTooLittleDebt))).to
        .eventually.be.rejected;
    });

    const withSomeBorrowing = {
      depositCollateral: 50,
      borrowBPD: BPD_MINIMUM_NET_DEBT.add(100),
    };

    it("should create a Vault with some borrowing", async () => {
      const { newVault, fee } = await moneyp.openVault(withSomeBorrowing);
      expect(newVault).to.deep.equal(Vault.create(withSomeBorrowing));
      expect(`${fee}`).to.equal(
        `${MINIMUM_BORROWING_RATE.mul(withSomeBorrowing.borrowBPD)}`
      );
    });

    it("should fail to withdraw all the collateral while the Vault has debt", async () => {
      const vault = await moneyp.getVault();

      await expect(moneyp.withdrawCollateral(vault.collateral)).to.eventually.be
        .rejected;
    });

    const repaySomeDebt = { repayBPD: 10 };

    it("should repay some debt", async () => {
      const { newVault, fee } = await moneyp.repayBPD(repaySomeDebt.repayBPD);
      expect(newVault).to.deep.equal(
        Vault.create(withSomeBorrowing).adjust(repaySomeDebt)
      );
      expect(`${fee}`).to.equal("0");
    });

    const borrowSomeMore = { borrowBPD: 20 };

    it("should borrow some more", async () => {
      const { newVault, fee } = await moneyp.borrowBPD(
        borrowSomeMore.borrowBPD
      );
      expect(newVault).to.deep.equal(
        Vault.create(withSomeBorrowing)
          .adjust(repaySomeDebt)
          .adjust(borrowSomeMore)
      );
      expect(`${fee}`).to.equal(
        `${MINIMUM_BORROWING_RATE.mul(borrowSomeMore.borrowBPD)}`
      );
    });

    const depositMoreCollateral = { depositCollateral: 1 };

    it("should deposit more collateral", async () => {
      const { newVault } = await moneyp.depositCollateral(
        depositMoreCollateral.depositCollateral
      );
      expect(newVault).to.deep.equal(
        Vault.create(withSomeBorrowing)
          .adjust(repaySomeDebt)
          .adjust(borrowSomeMore)
          .adjust(depositMoreCollateral)
      );
    });

    const repayAndWithdraw = { repayBPD: 60, withdrawCollateral: 0.5 };

    it("should repay some debt and withdraw some collateral at the same time", async () => {
      const { newVault } = await moneyp.adjustVault(
        repayAndWithdraw,
        undefined,
        { gasPrice: 0 }
      );

      expect(newVault).to.deep.equal(
        Vault.create(withSomeBorrowing)
          .adjust(repaySomeDebt)
          .adjust(borrowSomeMore)
          .adjust(depositMoreCollateral)
          .adjust(repayAndWithdraw)
      );

      const ethBalance = Decimal.fromBigNumberString(
        `${await user.getBalance()}`
      );
      expect(`${ethBalance}`).to.equal("100.5");
    });

    const borrowAndDeposit = { borrowBPD: 60, depositCollateral: 0.5 };

    it("should borrow more and deposit some collateral at the same time", async () => {
      const { newVault, fee } = await moneyp.adjustVault(
        borrowAndDeposit,
        undefined,
        {
          gasPrice: 0,
        }
      );

      expect(newVault).to.deep.equal(
        Vault.create(withSomeBorrowing)
          .adjust(repaySomeDebt)
          .adjust(borrowSomeMore)
          .adjust(depositMoreCollateral)
          .adjust(repayAndWithdraw)
          .adjust(borrowAndDeposit)
      );

      expect(`${fee}`).to.equal(
        `${MINIMUM_BORROWING_RATE.mul(borrowAndDeposit.borrowBPD)}`
      );

      const ethBalance = Decimal.fromBigNumberString(
        `${await user.getBalance()}`
      );
      expect(`${ethBalance}`).to.equal("99.5");
    });

    it("should close the Vault with some BPD from another user", async () => {
      const price = await moneyp.getPrice();
      const initialVault = await moneyp.getVault();
      const bpdBalance = await moneyp.getMPBalance();
      const bpdShortage = initialVault.netDebt.sub(bpdBalance);

      let funderVault = Vault.create({
        depositCollateral: 1,
        borrowBPD: bpdShortage,
      });
      funderVault = funderVault.setDebt(
        Decimal.max(funderVault.debt, BPD_MINIMUM_DEBT)
      );
      funderVault = funderVault.setCollateral(
        funderVault.debt.mulDiv(1.51, price)
      );

      const funderMoneyp = await connectToDeployment(deployment, funder);
      await funderMoneyp.openVault(Vault.recreate(funderVault));
      await funderMoneyp.sendBPD(await user.getAddress(), bpdShortage);

      const { params } = await moneyp.closeVault();

      expect(params).to.deep.equal({
        withdrawCollateral: initialVault.collateral,
        repayBPD: initialVault.netDebt,
      });

      const finalVault = await moneyp.getVault();
      expect(finalVault.isEmpty).to.be.true;
    });
  });

  describe("SendableBitcoinsMoneyp", () => {
    it("should parse failed transactions without throwing", async () => {
      // By passing a gasLimit, we avoid automatic use of estimateGas which would throw
      const tx = await moneyp.send.openVault(
        { depositCollateral: 0.01, borrowBPD: 0.01 },
        undefined,
        { gasLimit: 1e6 }
      );
      const { status } = await tx.waitForReceipt();

      expect(status).to.equal("failed");
    });
  });

  describe("Frontend", () => {
    it("should have no frontend initially", async () => {
      const frontend = await moneyp.getFrontendStatus(await user.getAddress());

      assertStrictEqual(frontend.status, "unregistered" as const);
    });

    it("should register a frontend", async () => {
      await moneyp.registerFrontend(0.75);
    });

    it("should have a frontend now", async () => {
      const frontend = await moneyp.getFrontendStatus(await user.getAddress());

      assertStrictEqual(frontend.status, "registered" as const);
      expect(`${frontend.kickbackRate}`).to.equal("0.75");
    });

    it("other user's deposit should be tagged with the frontend's address", async () => {
      const frontendTag = await user.getAddress();

      await funder.sendTransaction({
        to: otherUsers[0].getAddress(),
        value: Decimal.from(20.1).hex,
      });

      const otherMoneyp = await connectToDeployment(
        deployment,
        otherUsers[0],
        frontendTag
      );
      await otherMoneyp.openVault({
        depositCollateral: 20,
        borrowBPD: BPD_MINIMUM_DEBT,
      });

      await otherMoneyp.depositBPDInStabilityPool(BPD_MINIMUM_DEBT);

      const deposit = await otherMoneyp.getStabilityDeposit();
      expect(deposit.frontendTag).to.equal(frontendTag);
    });
  });

  describe("StabilityPool", () => {
    before(async () => {
      deployment = await deployMoneyp(deployer);

      [deployerMoneyp, moneyp, ...otherLiquities] = await connectUsers([
        deployer,
        user,
        ...otherUsers.slice(0, 1),
      ]);

      await funder.sendTransaction({
        to: otherUsers[0].getAddress(),
        value: BPD_MINIMUM_DEBT.div(170).hex,
      });
    });

    const initialVaultOfDepositor = Vault.create({
      depositCollateral: BPD_MINIMUM_DEBT.div(100),
      borrowBPD: BPD_MINIMUM_NET_DEBT,
    });

    const smallStabilityDeposit = Decimal.from(10);

    it("should make a small stability deposit", async () => {
      const { newVault } = await moneyp.openVault(
        Vault.recreate(initialVaultOfDepositor)
      );
      expect(newVault).to.deep.equal(initialVaultOfDepositor);

      const details = await moneyp.depositBPDInStabilityPool(
        smallStabilityDeposit
      );

      expect(details).to.deep.equal({
        bpdLoss: Decimal.from(0),
        newBPDDeposit: smallStabilityDeposit,
        collateralGain: Decimal.from(0),
        mpReward: Decimal.from(0),

        change: {
          depositBPD: smallStabilityDeposit,
        },
      });
    });

    const vaultWithVeryLowICR = Vault.create({
      depositCollateral: BPD_MINIMUM_DEBT.div(180),
      borrowBPD: BPD_MINIMUM_NET_DEBT,
    });

    it("other user should make a Vault with very low ICR", async () => {
      const { newVault } = await otherLiquities[0].openVault(
        Vault.recreate(vaultWithVeryLowICR)
      );

      const price = await moneyp.getPrice();
      expect(Number(`${newVault.collateralRatio(price)}`)).to.be.below(1.15);
    });

    const dippedPrice = Decimal.from(190);

    it("the price should take a dip", async () => {
      await deployerMoneyp.setPrice(dippedPrice);

      const price = await moneyp.getPrice();
      expect(`${price}`).to.equal(`${dippedPrice}`);
    });

    it("should liquidate other user's Vault", async () => {
      const details = await moneyp.liquidateUpTo(1);

      expect(details).to.deep.equal({
        liquidatedAddresses: [await otherUsers[0].getAddress()],

        collateralGasCompensation: vaultWithVeryLowICR.collateral.mul(0.005), // 0.5%
        bpdGasCompensation: BPD_LIQUIDATION_RESERVE,

        totalLiquidated: new Vault(
          vaultWithVeryLowICR.collateral
            .mul(0.995) // -0.5% gas compensation
            .add("0.000000000000000001"), // tiny imprecision
          vaultWithVeryLowICR.debt
        ),
      });

      const otherVault = await otherLiquities[0].getVault();
      expect(otherVault.isEmpty).to.be.true;
    });

    it("should have a depleted stability deposit and some collateral gain", async () => {
      const stabilityDeposit = await moneyp.getStabilityDeposit();

      expect(stabilityDeposit).to.deep.equal(
        new StabilityDeposit(
          smallStabilityDeposit,
          Decimal.ZERO,
          vaultWithVeryLowICR.collateral
            .mul(0.995) // -0.5% gas compensation
            .mulDiv(smallStabilityDeposit, vaultWithVeryLowICR.debt)
            .sub("0.000000000000000005"), // tiny imprecision
          Decimal.ZERO,
          AddressZero
        )
      );
    });

    it("the Vault should have received some liquidation shares", async () => {
      const vault = await moneyp.getVault();

      expect(vault).to.deep.equal({
        ownerAddress: await user.getAddress(),
        status: "open",

        ...initialVaultOfDepositor
          .addDebt(vaultWithVeryLowICR.debt.sub(smallStabilityDeposit))
          .addCollateral(
            vaultWithVeryLowICR.collateral
              .mul(0.995) // -0.5% gas compensation
              .mulDiv(
                vaultWithVeryLowICR.debt.sub(smallStabilityDeposit),
                vaultWithVeryLowICR.debt
              )
              .add("0.000000000000000001") // tiny imprecision
          ),
      });
    });

    it("total should equal the Vault", async () => {
      const vault = await moneyp.getVault();

      const numberOfVaults = await moneyp.getNumberOfVaults();
      expect(numberOfVaults).to.equal(1);

      const total = await moneyp.getTotal();
      expect(total).to.deep.equal(
        vault.addCollateral("0.000000000000000001") // tiny imprecision
      );
    });

    it("should transfer the gains to the Vault", async () => {
      const details = await moneyp.transferCollateralGainToVault();

      expect(details).to.deep.equal({
        bpdLoss: smallStabilityDeposit,
        newBPDDeposit: Decimal.ZERO,
        mpReward: Decimal.ZERO,

        collateralGain: vaultWithVeryLowICR.collateral
          .mul(0.995) // -0.5% gas compensation
          .mulDiv(smallStabilityDeposit, vaultWithVeryLowICR.debt)
          .sub("0.000000000000000005"), // tiny imprecision

        newVault: initialVaultOfDepositor
          .addDebt(vaultWithVeryLowICR.debt.sub(smallStabilityDeposit))
          .addCollateral(
            vaultWithVeryLowICR.collateral
              .mul(0.995) // -0.5% gas compensation
              .sub("0.000000000000000005") // tiny imprecision
          ),
      });

      const stabilityDeposit = await moneyp.getStabilityDeposit();
      expect(stabilityDeposit.isEmpty).to.be.true;
    });

    describe("when people overstay", () => {
      before(async () => {
        // Deploy new instances of the contracts, for a clean slate
        deployment = await deployMoneyp(deployer);

        const otherUsersSubset = otherUsers.slice(0, 5);
        [deployerMoneyp, moneyp, ...otherLiquities] = await connectUsers([
          deployer,
          user,
          ...otherUsersSubset,
        ]);

        await sendToEach(otherUsersSubset, 21.1);

        let price = Decimal.from(200);
        await deployerMoneyp.setPrice(price);

        // Use this account to print BPD
        await moneyp.openVault({ depositCollateral: 50, borrowBPD: 5000 });

        // otherLiquities[0-2] will be independent stability depositors
        await moneyp.sendBPD(await otherUsers[0].getAddress(), 3000);
        await moneyp.sendBPD(await otherUsers[1].getAddress(), 1000);
        await moneyp.sendBPD(await otherUsers[2].getAddress(), 1000);

        // otherLiquities[3-4] will be Vault owners whose Vaults get liquidated
        await otherLiquities[3].openVault({
          depositCollateral: 21,
          borrowBPD: 2900,
        });
        await otherLiquities[4].openVault({
          depositCollateral: 21,
          borrowBPD: 2900,
        });

        await otherLiquities[0].depositBPDInStabilityPool(3000);
        await otherLiquities[1].depositBPDInStabilityPool(1000);
        // otherLiquities[2] doesn't deposit yet

        // Tank the price so we can liquidate
        price = Decimal.from(150);
        await deployerMoneyp.setPrice(price);

        // Liquidate first victim
        await moneyp.liquidate(await otherUsers[3].getAddress());
        expect((await otherLiquities[3].getVault()).isEmpty).to.be.true;

        // Now otherLiquities[2] makes their deposit too
        await otherLiquities[2].depositBPDInStabilityPool(1000);

        // Liquidate second victim
        await moneyp.liquidate(await otherUsers[4].getAddress());
        expect((await otherLiquities[4].getVault()).isEmpty).to.be.true;

        // Stability Pool is now empty
        expect(`${await moneyp.getBPDInStabilityPool()}`).to.equal("0");
      });

      it("should still be able to withdraw remaining deposit", async () => {
        for (const l of [
          otherLiquities[0],
          otherLiquities[1],
          otherLiquities[2],
        ]) {
          const stabilityDeposit = await l.getStabilityDeposit();
          await l.withdrawBPDFromStabilityPool(stabilityDeposit.currentBPD);
        }
      });
    });
  });

  describe("Redemption", () => {
    const vaultCreations = [
      { depositCollateral: 99, borrowBPD: 4600 },
      { depositCollateral: 20, borrowBPD: 2000 }, // net debt: 2010
      { depositCollateral: 20, borrowBPD: 2100 }, // net debt: 2110.5
      { depositCollateral: 20, borrowBPD: 2200 }, //  net debt: 2211
    ];

    before(async function () {
      if (network.name !== "hardhat") {
        // Redemptions are only allowed after a bootstrap phase of 2 weeks.
        // Since fast-forwarding only works on Hardhat EVM, skip these tests elsewhere.
        this.skip();
      }

      // Deploy new instances of the contracts, for a clean slate
      deployment = await deployMoneyp(deployer);

      const otherUsersSubset = otherUsers.slice(0, 3);
      [deployerMoneyp, moneyp, ...otherLiquities] = await connectUsers([
        deployer,
        user,
        ...otherUsersSubset,
      ]);

      await sendToEach(otherUsersSubset, 20.1);
    });

    it("should fail to redeem during the bootstrap phase", async () => {
      await moneyp.openVault(vaultCreations[0]);
      await otherLiquities[0].openVault(vaultCreations[1]);
      await otherLiquities[1].openVault(vaultCreations[2]);
      await otherLiquities[2].openVault(vaultCreations[3]);

      await expect(moneyp.redeemBPD(4326.5, undefined, { gasPrice: 0 })).to
        .eventually.be.rejected;
    });

    const someBPD = Decimal.from(4326.5);

    it("should redeem some BPD after the bootstrap phase", async () => {
      // Fast-forward 31 days
      increaseTime(60 * 60 * 24 * 31);

      expect(
        `${await otherLiquities[0].getCollateralSurplusBalance()}`
      ).to.equal("0");
      expect(
        `${await otherLiquities[1].getCollateralSurplusBalance()}`
      ).to.equal("0");
      expect(
        `${await otherLiquities[2].getCollateralSurplusBalance()}`
      ).to.equal("0");

      const expectedTotal = vaultCreations
        .map((params) => Vault.create(params))
        .reduce((a, b) => a.add(b));

      const total = await moneyp.getTotal();
      expect(total).to.deep.equal(expectedTotal);

      const expectedDetails = {
        attemptedBPDAmount: someBPD,
        actualBPDAmount: someBPD,
        collateralTaken: someBPD.div(200),
        fee: new Fees(0, 0.99, 2, new Date(), new Date(), false)
          .redemptionRate(someBPD.div(total.debt))
          .mul(someBPD.div(200)),
      };

      const details = await moneyp.redeemBPD(someBPD, undefined, {
        gasPrice: 0,
      });
      expect(details).to.deep.equal(expectedDetails);

      const balance = Decimal.fromBigNumberString(
        `${await provider.getBalance(user.getAddress())}`
      );
      expect(`${balance}`).to.equal(
        `${expectedDetails.collateralTaken.sub(expectedDetails.fee).add(100)}`
      );

      expect(`${await moneyp.getBPDBalance()}`).to.equal("273.5");

      expect(`${(await otherLiquities[0].getVault()).debt}`).to.equal(
        `${Vault.create(vaultCreations[1]).debt.sub(
          someBPD
            .sub(Vault.create(vaultCreations[2]).netDebt)
            .sub(Vault.create(vaultCreations[3]).netDebt)
        )}`
      );

      expect((await otherLiquities[1].getVault()).isEmpty).to.be.true;
      expect((await otherLiquities[2].getVault()).isEmpty).to.be.true;
    });

    it("should claim the collateral surplus after redemption", async () => {
      const balanceBefore1 = await provider.getBalance(
        otherUsers[1].getAddress()
      );
      const balanceBefore2 = await provider.getBalance(
        otherUsers[2].getAddress()
      );

      expect(
        `${await otherLiquities[0].getCollateralSurplusBalance()}`
      ).to.equal("0");

      const surplus1 = await otherLiquities[1].getCollateralSurplusBalance();
      const vault1 = Vault.create(vaultCreations[2]);
      expect(`${surplus1}`).to.equal(
        `${vault1.collateral.sub(vault1.netDebt.div(200))}`
      );

      const surplus2 = await otherLiquities[2].getCollateralSurplusBalance();
      const vault2 = Vault.create(vaultCreations[3]);
      expect(`${surplus2}`).to.equal(
        `${vault2.collateral.sub(vault2.netDebt.div(200))}`
      );

      await otherLiquities[1].claimCollateralSurplus({ gasPrice: 0 });
      await otherLiquities[2].claimCollateralSurplus({ gasPrice: 0 });

      expect(
        `${await otherLiquities[0].getCollateralSurplusBalance()}`
      ).to.equal("0");
      expect(
        `${await otherLiquities[1].getCollateralSurplusBalance()}`
      ).to.equal("0");
      expect(
        `${await otherLiquities[2].getCollateralSurplusBalance()}`
      ).to.equal("0");

      const balanceAfter1 = await provider.getBalance(
        otherUsers[1].getAddress()
      );
      const balanceAfter2 = await provider.getBalance(
        otherUsers[2].getAddress()
      );
      expect(`${balanceAfter1}`).to.equal(
        `${balanceBefore1.add(surplus1.hex)}`
      );
      expect(`${balanceAfter2}`).to.equal(
        `${balanceBefore2.add(surplus2.hex)}`
      );
    });

    it("borrowing rate should be maxed out now", async () => {
      const borrowBPD = Decimal.from(10);

      const { fee, newVault } = await moneyp.borrowBPD(borrowBPD);
      expect(`${fee}`).to.equal(`${borrowBPD.mul(MAXIMUM_BORROWING_RATE)}`);

      expect(newVault).to.deep.equal(
        Vault.create(vaultCreations[0]).adjust(
          { borrowBPD },
          MAXIMUM_BORROWING_RATE
        )
      );
    });
  });

  describe("Redemption (truncation)", () => {
    const vaultCreationParams = { depositCollateral: 20, borrowBPD: 2000 };
    const netDebtPerVault = Vault.create(vaultCreationParams).netDebt;
    const amountToAttempt = Decimal.from(3000);
    const expectedRedeemable = netDebtPerVault.mul(2).sub(BPD_MINIMUM_NET_DEBT);

    before(function () {
      if (network.name !== "hardhat") {
        // Redemptions are only allowed after a bootstrap phase of 2 weeks.
        // Since fast-forwarding only works on Hardhat EVM, skip these tests elsewhere.
        this.skip();
      }
    });

    beforeEach(async () => {
      // Deploy new instances of the contracts, for a clean slate
      deployment = await deployMoneyp(deployer);

      const otherUsersSubset = otherUsers.slice(0, 3);
      [deployerMoneyp, moneyp, ...otherLiquities] = await connectUsers([
        deployer,
        user,
        ...otherUsersSubset,
      ]);

      await sendToEach(otherUsersSubset, 20.1);

      await moneyp.openVault({ depositCollateral: 99, borrowBPD: 5000 });
      await otherLiquities[0].openVault(vaultCreationParams);
      await otherLiquities[1].openVault(vaultCreationParams);
      await otherLiquities[2].openVault(vaultCreationParams);

      increaseTime(60 * 60 * 24 * 15);
    });

    it("should truncate the amount if it would put the last Vault below the min debt", async () => {
      const redemption = await moneyp.populate.redeemBPD(amountToAttempt);
      expect(`${redemption.attemptedBPDAmount}`).to.equal(`${amountToAttempt}`);
      expect(`${redemption.redeemableBPDAmount}`).to.equal(
        `${expectedRedeemable}`
      );
      expect(redemption.isTruncated).to.be.true;

      const { details } = await waitForSuccess(redemption.send());
      expect(`${details.attemptedBPDAmount}`).to.equal(`${expectedRedeemable}`);
      expect(`${details.actualBPDAmount}`).to.equal(`${expectedRedeemable}`);
    });

    it("should increase the amount to the next lowest redeemable value", async () => {
      const increasedRedeemable = expectedRedeemable.add(BPD_MINIMUM_NET_DEBT);

      const initialRedemption = await moneyp.populate.redeemBPD(
        amountToAttempt
      );
      const increasedRedemption =
        await initialRedemption.increaseAmountByMinimumNetDebt();
      expect(`${increasedRedemption.attemptedBPDAmount}`).to.equal(
        `${increasedRedeemable}`
      );
      expect(`${increasedRedemption.redeemableBPDAmount}`).to.equal(
        `${increasedRedeemable}`
      );
      expect(increasedRedemption.isTruncated).to.be.false;

      const { details } = await waitForSuccess(increasedRedemption.send());
      expect(`${details.attemptedBPDAmount}`).to.equal(
        `${increasedRedeemable}`
      );
      expect(`${details.actualBPDAmount}`).to.equal(`${increasedRedeemable}`);
    });

    it("should fail to increase the amount if it's not truncated", async () => {
      const redemption = await moneyp.populate.redeemBPD(netDebtPerVault);
      expect(redemption.isTruncated).to.be.false;

      expect(() => redemption.increaseAmountByMinimumNetDebt()).to.throw(
        "can only be called when amount is truncated"
      );
    });
  });

  describe("Redemption (gas checks)", function () {
    this.timeout("5m");

    const massivePrice = Decimal.from(1000000);

    const amountToBorrowPerVault = Decimal.from(2000);
    const netDebtPerVault = MINIMUM_BORROWING_RATE.add(1).mul(
      amountToBorrowPerVault
    );
    const collateralPerVault = netDebtPerVault
      .add(BPD_LIQUIDATION_RESERVE)
      .mulDiv(1.5, massivePrice);

    const amountToRedeem = netDebtPerVault.mul(_redeemMaxIterations);
    const amountToDeposit = MINIMUM_BORROWING_RATE.add(1)
      .mul(amountToRedeem)
      .add(BPD_LIQUIDATION_RESERVE)
      .mulDiv(2, massivePrice);

    before(async function () {
      if (network.name !== "hardhat") {
        // Redemptions are only allowed after a bootstrap phase of 2 weeks.
        // Since fast-forwarding only works on Hardhat EVM, skip these tests elsewhere.
        this.skip();
      }

      // Deploy new instances of the contracts, for a clean slate
      deployment = await deployMoneyp(deployer);
      const otherUsersSubset = otherUsers.slice(0, _redeemMaxIterations);
      expect(otherUsersSubset).to.have.length(_redeemMaxIterations);

      [deployerMoneyp, moneyp, ...otherLiquities] = await connectUsers([
        deployer,
        user,
        ...otherUsersSubset,
      ]);

      await deployerMoneyp.setPrice(massivePrice);
      await sendToEach(otherUsersSubset, collateralPerVault);

      for (const otherMoneyp of otherLiquities) {
        await otherMoneyp.openVault(
          {
            depositCollateral: collateralPerVault,
            borrowBPD: amountToBorrowPerVault,
          },
          undefined,
          { gasPrice: 0 }
        );
      }

      increaseTime(60 * 60 * 24 * 15);
    });

    it("should redeem using the maximum iterations and almost all gas", async () => {
      await moneyp.openVault({
        depositCollateral: amountToDeposit,
        borrowBPD: amountToRedeem,
      });

      const { rawReceipt } = await waitForSuccess(
        moneyp.send.redeemBPD(amountToRedeem)
      );

      const gasUsed = rawReceipt.gasUsed.toNumber();
      // gasUsed is ~half the real used amount because of how refunds work, see:
      // https://ethereum.stackexchange.com/a/859/9205
      expect(gasUsed).to.be.at.least(4900000, "should use close to 10M gas");
    });
  });

  describe("Liquidity mining", () => {
    before(async () => {
      deployment = await deployMoneyp(deployer);
      [deployerMoneyp, moneyp] = await connectUsers([deployer, user]);
    });

    const someRskSwapTokens = 1000;

    it("should fail to stake UNI LP before approving the spend", async () => {
      await expect(moneyp.stakeRskSwapTokens(someRskSwapTokens)).to.eventually
        .be.rejected;
    });
  });

  describe("Gas estimation", () => {
    const vaultWithICRBetween = (a: Vault, b: Vault) => a.add(b).multiply(0.5);

    let rudeUser: Signer;
    let fiveOtherUsers: Signer[];
    let rudeMoneyp: BitcoinsMoneyp;

    before(async function () {
      if (network.name !== "hardhat") {
        this.skip();
      }

      deployment = await deployMoneyp(deployer);

      [rudeUser, ...fiveOtherUsers] = otherUsers.slice(0, 6);

      [deployerMoneyp, moneyp, rudeMoneyp, ...otherLiquities] =
        await connectUsers([deployer, user, rudeUser, ...fiveOtherUsers]);

      await openVaults(fiveOtherUsers, [
        { depositCollateral: 20, borrowBPD: 2040 },
        { depositCollateral: 20, borrowBPD: 2050 },
        { depositCollateral: 20, borrowBPD: 2060 },
        { depositCollateral: 20, borrowBPD: 2070 },
        { depositCollateral: 20, borrowBPD: 2080 },
      ]);

      increaseTime(60 * 60 * 24 * 15);
    });

    it("should include enough gas for updating lastFeeOperationTime", async () => {
      await moneyp.openVault({ depositCollateral: 20, borrowBPD: 2090 });

      // We just updated lastFeeOperationTime, so this won't anticipate having to update that
      // during estimateGas
      const tx = await moneyp.populate.redeemBPD(1);
      const originalGasEstimate = await provider.estimateGas(
        tx.rawPopulatedTransaction
      );

      // Fast-forward 2 minutes.
      await increaseTime(120);

      // Required gas has just went up.
      const newGasEstimate = await provider.estimateGas(
        tx.rawPopulatedTransaction
      );
      const gasIncrease = newGasEstimate.sub(originalGasEstimate).toNumber();
      expect(gasIncrease).to.be.within(5000, 10000);

      // This will now have to update lastFeeOperationTime
      await waitForSuccess(tx.send());

      // Decay base-rate back to 0
      await increaseTime(100000000);
    });

    it("should include enough gas for one extra traversal", async () => {
      const vaults = await moneyp.getVaults({
        first: 10,
        sortedBy: "ascendingCollateralRatio",
      });

      const vault = await moneyp.getVault();
      const newVault = vaultWithICRBetween(vaults[3], vaults[4]);

      // First, we want to test a non-borrowing case, to make sure we're not passing due to any
      // extra gas we add to cover a potential lastFeeOperationTime update
      const adjustment = vault.adjustTo(newVault);
      expect(adjustment.borrowBPD).to.be.undefined;

      const tx = await moneyp.populate.adjustVault(adjustment);
      const originalGasEstimate = await provider.estimateGas(
        tx.rawPopulatedTransaction
      );

      // A terribly rude user interferes
      const rudeVault = newVault.addDebt(1);
      const rudeCreation = Vault.recreate(rudeVault);
      await openVaults([rudeUser], [rudeCreation]);

      const newGasEstimate = await provider.estimateGas(
        tx.rawPopulatedTransaction
      );
      const gasIncrease = newGasEstimate.sub(originalGasEstimate).toNumber();

      await waitForSuccess(tx.send());
      expect(gasIncrease).to.be.within(10000, 25000);

      assertDefined(rudeCreation.borrowBPD);
      const bpdShortage = rudeVault.debt.sub(rudeCreation.borrowBPD);

      await moneyp.sendBPD(await rudeUser.getAddress(), bpdShortage);
      await rudeMoneyp.closeVault({ gasPrice: 0 });
    });

    it("should include enough gas for both when borrowing", async () => {
      const vaults = await moneyp.getVaults({
        first: 10,
        sortedBy: "ascendingCollateralRatio",
      });

      const vault = await moneyp.getVault();
      const newVault = vaultWithICRBetween(vaults[1], vaults[2]);

      // Make sure we're borrowing
      const adjustment = vault.adjustTo(newVault);
      expect(adjustment.borrowBPD).to.not.be.undefined;

      const tx = await moneyp.populate.adjustVault(adjustment);
      const originalGasEstimate = await provider.estimateGas(
        tx.rawPopulatedTransaction
      );

      // A terribly rude user interferes again
      await openVaults([rudeUser], [Vault.recreate(newVault.addDebt(1))]);

      // On top of that, we'll need to update lastFeeOperationTime
      await increaseTime(120);

      const newGasEstimate = await provider.estimateGas(
        tx.rawPopulatedTransaction
      );
      const gasIncrease = newGasEstimate.sub(originalGasEstimate).toNumber();

      await waitForSuccess(tx.send());
      expect(gasIncrease).to.be.within(15000, 30000);
    });
  });

  describe("Gas estimation (MP issuance)", () => {
    const estimate = (tx: PopulatedBitcoinsMoneypTransaction) =>
      provider.estimateGas(tx.rawPopulatedTransaction);

    before(async function () {
      if (network.name !== "hardhat") {
        this.skip();
      }

      deployment = await deployMoneyp(deployer);
      [deployerMoneyp, moneyp] = await connectUsers([deployer, user]);
    });

    it("should include enough gas for issuing MP", async function () {
      this.timeout("1m");

      await moneyp.openVault({ depositCollateral: 40, borrowBPD: 4000 });
      await moneyp.depositBPDInStabilityPool(19);

      await increaseTime(60);

      // This will issue MP for the first time ever. That uses a whole lotta gas, and we don't
      // want to pack any extra gas to prepare for this case specifically, because it only happens
      // once.
      await moneyp.withdrawGainsFromStabilityPool();

      const claim = await moneyp.populate.withdrawGainsFromStabilityPool();
      const deposit = await moneyp.populate.depositBPDInStabilityPool(1);
      const withdraw = await moneyp.populate.withdrawBPDFromStabilityPool(1);

      for (let i = 0; i < 5; ++i) {
        for (const tx of [claim, deposit, withdraw]) {
          const gasLimit = tx.rawPopulatedTransaction.gasLimit?.toNumber();
          const requiredGas = (await estimate(tx)).toNumber();

          assertDefined(gasLimit);
          expect(requiredGas).to.be.at.most(gasLimit);
        }

        await increaseTime(60);
      }

      await waitForSuccess(claim.send());

      const creation = Vault.recreate(
        new Vault(Decimal.from(11.1), Decimal.from(2000.1))
      );

      await deployerMoneyp.openVault(creation);
      await deployerMoneyp.depositBPDInStabilityPool(creation.borrowBPD);
      await deployerMoneyp.setPrice(198);

      const liquidateTarget = await moneyp.populate.liquidate(
        await deployer.getAddress()
      );
      const liquidateMultiple = await moneyp.populate.liquidateUpTo(40);

      for (let i = 0; i < 5; ++i) {
        for (const tx of [liquidateTarget, liquidateMultiple]) {
          const gasLimit = tx.rawPopulatedTransaction.gasLimit?.toNumber();
          const requiredGas = (await estimate(tx)).toNumber();

          assertDefined(gasLimit);
          expect(requiredGas).to.be.at.most(gasLimit);
        }

        await increaseTime(60);
      }

      await waitForSuccess(liquidateMultiple.send());
    });
  });
});
