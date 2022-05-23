import React from "react";
import { render, fireEvent } from "@testing-library/react";

import { Decimal, BPD_MINIMUM_NET_DEBT, Vault } from "@liquity/lib-base";

import App from "./App";

const params = { depositCollateral: Decimal.from(20), borrowBPD: BPD_MINIMUM_NET_DEBT };
const vault = Vault.create(params);

console.log(`${vault}`);

/*
 * Just a quick and dirty testcase to prove that the approach can work in our CI pipeline.
 */
test("there's no smoke", async () => {
  const { getByText, getAllByText, getByLabelText, findByText } = render(<App />);

  expect(await findByText(/you can borrow bpd by opening a vault/i)).toBeInTheDocument();

  fireEvent.click(getByText(/open vault/i));
  fireEvent.click(getByLabelText(/collateral/i));
  fireEvent.change(getByLabelText(/^collateral$/i), { target: { value: `${vault.collateral}` } });
  fireEvent.click(getByLabelText(/^debt$/i));
  fireEvent.change(getByLabelText(/^debt$/i), { target: { value: `${vault.debt}` } });

  const confirmButton = getAllByText(/confirm/i)[0];
  fireEvent.click(confirmButton);

  expect(await findByText(/adjust/i)).toBeInTheDocument();
});
