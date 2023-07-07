# Data Binder

The data binder component provides the ability to configure and subscribe to [editable-tree](../../src/feature-libraries/editable-tree/) change notifications. Events are generated when deltas are applied to the tree. Events can be filtered according to binding type and location within the tree.

## Binder Categories

There are two large categories of binders, one emitting the events in realtime as changes are applied to the tree data structure (ie. `DataBinder`), and another that defers emitting the events typically until the tree reaches a state of consistency (ie. `FlushableDataBinder`). It is safe to read the tree state from within the event handler for the deferred events but not for the immediate events.

It is possible to automate the flushing of `FlushableDataBinder` by specifying the view event responsible for triggering the flush, ie.:

```ts
const options: FlushableBinderOptions<ViewEvents> = createFlushableBinderOptions({
	autoFlushPolicy: "afterBatch",
});
```

or by invoking the `Flushable.flush()` method directly based on specific domain consistency heuristics.

More specific binder categories are described below:

### Direct

A direct data binder emits events immediately as changes are applied to the tree data structure. The events are emitted in the order they are applied to the tree.

See also [Match Policy](#match-policy), [Binder Configuration](#binder-configuration).

Example:

```ts
const syntaxTree: BindSyntaxTree = { address: true };
const bindTree: BindTree = compileSyntaxTree(syntaxTree);
const options: BinderOptions = createBinderOptions({
	matchPolicy: "subtree",
});
const dataBinder: DataBinder<OperationBinderEvents> = createDataBinderDirect(tree.events, options);
dataBinder.register(root, BindingType.Insert, [bindTree], (insertContext: InsertBindingContext) => {
	console.log("inserted");
});
```

### Buffering

A buffering data binder is a `FlushableDataBinder` that emits events after the tree reaches a state of consistency. The events can be emitted in the order they are applied to the tree or sorted according to a custom specification.

See also [Match Policy](#match-policy), [Binder Configuration](#binder-configuration), [Event Ordering](#event-ordering).

Example:

```ts
const syntaxTree: BindSyntaxTree = {
	address: true,
};
const bindTree: BindTree = compileSyntaxTree(syntaxTree);
const options: FlushableBinderOptions<ViewEvents> = createFlushableBinderOptions({
	matchPolicy: "subtree",
	autoFlushPolicy: "afterBatch",
});
const dataBinder: FlushableDataBinder<OperationBinderEvents> = createDataBinderBuffering(
	tree.events,
	options,
);
dataBinder.register(root, BindingType.Insert, [bindTree], (insertContext: InsertBindingContext) => {
	console.log("inserted");
});
```

### Batching

A buffering data binder can be operated so that events are emitted in batches. The batch is emitted when the tree reaches a state of consistency, ie. when the `flush()` method if the `FlushableDataBinder` is invoked. The events in the batch can be sorted according to custom specifications.

See also [Match Policy](#match-policy), [Binder Configuration](#binder-configuration), [Event Ordering](#event-ordering).

Example:

```ts
const syntaxTree: BindSyntaxTree = {
	address: true,
};
const bindTree: BindTree = compileSyntaxTree(syntaxTree);
const options: FlushableBinderOptions<ViewEvents> = createFlushableBinderOptions({
	matchPolicy: "subtree",
	autoFlushPolicy: "afterBatch",
});
const dataBinder: FlushableDataBinder<OperationBinderEvents> = createDataBinderBuffering(
	tree.events,
	options,
);
// register interest for insert
dataBinder.register(root, BindingType.Insert, [bindTree]);
// register interest for delete
dataBinder.register(root, BindingType.Delete, [bindTree]);
// register callback for batches of (insert, delete) events
dataBinder.register(root, BindingType.Batch, [bindTree], (batchContext: BatchBindingContext) => {
	console.log("batch received");
});
```

> Note: Batch and incremental notification can be combined. When bind specification overlaps, batch notification is preferred. In the following example, changes to `zip` will be batched, while changes to `street` (which is a possible sibling to `zip` field in the overall logical tree) will be notified incrementally.

Example:

```ts
const syntaxTree: BindSyntaxTree = {
	address: true,
};
const batchSyntaxTree: BindSyntaxTree = {
	address: {
		zip: true,
	},
};
const bindTree: BindTree = compileSyntaxTree(syntaxTree);
const batchBindTree: BindTree = compileSyntaxTree(batchSyntaxTree);
const options: FlushableBinderOptions<ViewEvents> = createFlushableBinderOptions({
	matchPolicy: "subtree",
	autoFlushPolicy: "afterBatch",
});
const dataBinder: FlushableDataBinder<OperationBinderEvents> = createDataBinderBuffering(
	tree.events,
	options,
);
dataBinder.register(root, BindingType.Insert, [bindTree], (insertContext: InsertBindingContext) => {
	console.log("inserted");
});
dataBinder.register(root, BindingType.Delete, [bindTree], (deleteContext: DeleteBindingContext) => {
	console.log("deleted");
});
dataBinder.register(
	root,
	BindingType.Batch,
	[batchBindTree],
	(batchContext: BatchBindingContext) => {
		console.log("batch received");
	},
);
```

### Invalidating

An invalidating data binder is a `FlushableDataBinder` that emits invalidation events, that is, the registered paths have been invalidated by changes to the tree. The invalidation events are emitted after the tree reaches a state of consistency. A typical usage is to re-read based on domain heuristics the tree fragment described by the invalidated path(s).

See also [Match Policy](#match-policy), [Binder Configuration](#binder-configuration).

Example:

```ts
const syntaxTree: BindSyntaxTree = { address: true };
const bindTree: BindTree = compileSyntaxTree(syntaxTree);
const options: FlushableBinderOptions<ViewEvents> = createFlushableBinderOptions({
	autoFlushPolicy: "afterBatch",
	matchPolicy: "subtree",
});
const dataBinder: FlushableDataBinder<InvalidationBinderEvents> = createDataBinderInvalidating(
	tree.events,
	options,
);
dataBinder.register(
	root,
	BindingType.Invalidation,
	[bindTree],
	(invalidStateContext: InvalidationBindingContext) => {
		console.log("invalidated");
	},
);
```

## Syntax Tree

A binding language provides the means to describe conveniently paths of interest in the `editable-tree`. For syntactic compactness, multiple paths can be combined in a single, tree like, binding expression. The binding language is described by the `BindSyntaxTree` type.

Following example describes a binding expression that matches the events (ie. changes) associated with three distinct paths:

-   `address.zip`
-   `address.street`
-   `address.phones`

Example:

```ts
const syntaxTree: BindSyntaxTree = {
	address: {
		zip: true,
		street: true,
		phones: true,
	},
};
```

The expression can also include the position of a node in the containing sequence. To avoid potential collision with custom attribution, an `[indexSymbol]` is provided. For instance, the following expression matches the events associated with the first element of the `phones` sequence:

```ts
const syntaxTree: BindSyntaxTree = {
	address: {
		phones: { [indexSymbol]: 0 },
	},
};
```

Syntax trees are compiled into an internal representation, optimized for processing. The internal representation is described by the `BindTree` type.

Example:

```ts
const syntaxTree: BindSyntaxTree = ...
const bindTree: BindTree = compileSyntaxTree(syntaxTree);
```

## Match Policy

The match policy determines how the events are matched against the binding expression. The match policy is described by the `MatchPolicy` type.

The following matching policies are supported:

-   `path` match policy requires that path filtering would return events matching the _exact_ path only. In this case _exact_ semantics include interpreting the `undefined` _index_ field in any `PathStep` of a `BindPath` as a wildcard for matching.
-   `subtree` match policy requires that path filtering would return events matching the exact path and its subpaths, ie. changes to children would be allowed to bubble up to parent listeners.

The example below is featuring the `path` policy and will only detect changes to the `zip` field, ie. trigger notification when `address.zip = "33428";` assignment occurs.

Example:

```ts
const syntaxTree: BindSyntaxTree = {
	address: {
		zip: true,
	},
};
const options: FlushableBinderOptions<ViewEvents> = createFlushableBinderOptions({
	matchPolicy: "path", // redundant as "path" is the default
	// ...
});
```

Next example is demonstrating the `subtree` policy. The binder will detect changes to the `zip`, `street` and `phones` fields (or any other nodes in the `address` subtree), ie. trigger notification when `address.zip = "33428";` assignment occurs, as well as when `address.phones[0] = "123456789";` assignment occurs.

Example:

```ts
const syntaxTree: BindSyntaxTree = {
	address: true,
};
const options: FlushableBinderOptions<ViewEvents> = createFlushableBinderOptions({
	matchPolicy: "subtree", // needs to be explicitly specified
	// ...
});
```

## Listener Registration

Event listeners are registered using the `register()` method of the `DataBinder` interface:

```ts
/**
 * The data binder interface
 *
 * @alpha
 */
export interface DataBinder<B extends OperationBinderEvents | InvalidationBinderEvents> {
	/**
	 * Register an event listener
	 *
	 * @param anchor - The anchor to register the listener on
	 * @param eventType - The {@link BindingType} to listen for.
	 * @param eventTrees - The {@link BindTree}s to filter on.
	 * @param listener - The listener to register
	 */
	register<K extends keyof Events<B>>(
		anchor: EditableTree,
		eventType: K,
		eventTrees: BindTree[],
		listener?: B[K],
	): void;

	/**
	 * Unregister all listeners.
	 */
	unregisterAll(): void;
}
```

The _anchor_ node can be any node in the tree. The _event type_ is one of the supported binding types. The _event trees_ are the trees describing the paths of interest. The _listener_ is the callback function that will be invoked when an event matching the anchor, event type and event trees is emitted.

Example:

```ts
const dataBinder: FlushableDataBinder<OperationBinderEvents> = createDataBinderBuffering(
	tree.events,
	options,
);
dataBinder.register(root, BindingType.Insert, [bindTree], (insertContext: InsertBindingContext) => {
	console.log("inserted");
});
```

Different binder categories support different event types. The following table describes the supported binding types for each binder category:

| Binder Category | Event Type                 | Description                                      |
| --------------- | -------------------------- | ------------------------------------------------ |
| `Direct`        | `BindingType.Insert`       | Emitted when a new node is inserted in the tree. |
| `Direct`        | `BindingType.Delete`       | Emitted when a node is deleted from the tree.    |
| `Buffering`     | `BindingType.Insert`       | Emitted when a new node is inserted in the tree. |
| `Buffering`     | `BindingType.Delete`       | Emitted when a node is deleted from the tree.    |
| `Batching`      | `BindingType.Batch`        | Emitted when a batch of events is emitted.       |
| `Invalidating`  | `BindingType.Invalidation` | Emitted when a path is invalidated.              |

> Note: the content table above is subject to change. Intentionally left out event types which are in the process of being deprecated.

When invoked, a context argument is provided to the listener. The common context interface is described by the `BindingContext` type. More specialized context interfaces carry change specific attribution: `InsertBindingContext`, `DeleteBindingContext`, `BatchBindingContext`, and `InvalidationBindingContext` types.

To decommission a data binder, the `unregisterAll` method can be used:

Example:

```ts
dataBinder.unregisterAll();
```

## Event Ordering

For the buffering data binders, the order in which events are processed when flushing the buffer can be customized. This becomes useful in cases when the event consumption module requires to:

-   avoid constraint violations when events are applied to constrained models
-   enforce operation sequencing eg. `Delete` before `Insert` on modifications to the same tree node (`shared-tree` delta events are emitted in reverse order, ie. `Insert` before `Delete`)
-   align to structural dependencies, eg. apply changes to children before parents

The buffering data binder is grouping events by the anchor node and sorting them within the group using the `sortFn` provided in the binder options. The event groups are sorted using the `sortAnchorsFn`.

Example:

```ts
/**
 * This example reorders all delete events to be processed before all insert events
 * and reorders all event groups to be processed in depth first order.
 */
const options: FlushableBinderOptions<ViewEvents> = createFlushableBinderOptions({
	matchPolicy: "subtree",
	autoFlush: true,
	autoFlushPolicy: "afterBatch",
	sortFn: deletesFirst,
	sortAnchorsFn: depthFirst,
});

function deletesFirst(a: VisitorBindingContext, b: VisitorBindingContext): number {
	if (a.type === BindingType.Delete && b.type === BindingType.Delete) {
		return 0;
	}
	if (a.type === BindingType.Delete) {
		return -1;
	}
	if (b.type === BindingType.Delete) {
		return 1;
	}
	return 0;
}

function depthFirst(a: UpPath, b: UpPath): number {
	return getDepth(a) - getDepth(b);
}
```

Example:

```ts
const customOrder = [fieldZip, fieldStreet, fieldPhones, fieldSequencePhones];
const options: FlushableBinderOptions<ViewEvents> = createFlushableBinderOptions({
	matchPolicy: "subtree",
	autoFlushPolicy: "afterBatch",
	sortFn: (a: VisitorBindingContext, b: VisitorBindingContext) => {
		const aIndex = customOrder.indexOf(a.path.parentField);
		const bIndex = customOrder.indexOf(b.path.parentField);
		return aIndex - bIndex;
	},
});
```

## Binder Configuration

Current configuration options are:

-   `matchPolicy` specifies the matching policy for the binder. The binder will only emit events for paths that match the policy. Valid values are `path` and `subtree`. The default value is `path`.

-   `autoFlush` is a boolean that specifies whether the binder should automatically flush events. The default value is `true`.
-   `autoFlushPolicy` specifies the policy for automatically flushing events. The following policies are supported:
    -   `afterBatch` flushes events after the `ViewEvents.afterBatch` event is emitted.
-   `sortFn` specifies the sort function for sorting events associated with a given anchor. The default value is `() => 0`, which indicates that no sorting is applied.
-   `sortAnchorsFn` specifies the sort function for sorting event groups associated with given anchors. The default value is `() => 0`, which indicates that no sorting is applied.

Example:

```ts
const options: FlushableBinderOptions<ViewEvents> = createFlushableBinderOptions({
	matchPolicy: "subtree",
	autoFlush: true,
	autoFlushPolicy: "afterBatch",
	sortFn: () => 0,
	sortAnchorsFn: () => 0,
});
```
