<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [StabilityDepositChange](./lib-base.stabilitydepositchange.md)

## StabilityDepositChange type

Represents the change between two Stability Deposit states.

<b>Signature:</b>

```typescript
export declare type StabilityDepositChange<T> = {
    depositBPD: T;
    withdrawBPD?: undefined;
} | {
    depositBPD?: undefined;
    withdrawBPD: T;
    withdrawAllBPD: boolean;
};
```
