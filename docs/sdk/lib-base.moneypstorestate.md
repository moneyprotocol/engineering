<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [MoneypStoreState](./lib-base.moneypstorestate.md)

## MoneypStoreState type

Type of [MoneypStore](./lib-base.moneypstore.md)<!-- -->'s [state](./lib-base.moneypstore.state.md)<!-- -->.

<b>Signature:</b>

```typescript
export declare type MoneypStoreState<T = unknown> = MoneypStoreBaseState & MoneypStoreDerivedState & T;
```
<b>References:</b> [MoneypStoreBaseState](./lib-base.moneypstorebasestate.md)<!-- -->, [MoneypStoreDerivedState](./lib-base.moneypstorederivedstate.md)

## Remarks

It combines all properties of [MoneypStoreBaseState](./lib-base.moneypstorebasestate.md) and [MoneypStoreDerivedState](./lib-base.moneypstorederivedstate.md) with optional extra state added by the particular `MoneypStore` implementation.

The type parameter `T` may be used to type the extra state.

