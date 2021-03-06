<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-base](./lib-base.md) &gt; [MoneypStore](./lib-base.moneypstore.md)

## MoneypStore class

Abstract base class of Moneyp data store implementations.

<b>Signature:</b>

```typescript
export declare abstract class MoneypStore<T = unknown> 
```

## Remarks

The type parameter `T` may be used to type extra state added to [MoneypStoreState](./lib-base.moneypstorestate.md) by the subclass.

Implemented by [BlockPolledMoneypStore](./lib-ethers.blockpolledmoneypstore.md)<!-- -->.

## Properties

|  Property | Modifiers | Type | Description |
|  --- | --- | --- | --- |
|  [logging](./lib-base.moneypstore.logging.md) |  | boolean | Turn console logging on/off. |
|  [onLoaded?](./lib-base.moneypstore.onloaded.md) |  | () =&gt; void | <i>(Optional)</i> Called after the state is fetched for the first time. |
|  [state](./lib-base.moneypstore.state.md) |  | [MoneypStoreState](./lib-base.moneypstorestate.md)<!-- -->&lt;T&gt; | The current store state. |

## Methods

|  Method | Modifiers | Description |
|  --- | --- | --- |
|  [start()](./lib-base.moneypstore.start.md) |  | Start monitoring the blockchain for Moneyp state changes. |
|  [subscribe(listener)](./lib-base.moneypstore.subscribe.md) |  | Register a state change listener. |

