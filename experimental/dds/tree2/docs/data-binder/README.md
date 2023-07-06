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

### Direct Data Binder

Is a `DataBinder` that emits events immediately as changes are applied to the tree data structure. The events are emitted in the order they are applied to the tree.

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

### Buffering Data Binder

Is a `FlushableDataBinder` that emits events after the tree reaches a state of consistency. The events can be emitted in the order they are applied to the tree or sorted according to custom specifications.

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

### Buffering Data Binder, Batching

Is a `FlushableDataBinder` that emits events after the tree reaches a state of consistency. The events are emitted in batches describing the unit of consistency.

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

### Invalidating Data Binder

Is a `FlushableDataBinder` that emits invalidation events, that is, the described paths have been invalidated by changes to the tree. The invalidation events are emitted after the tree reaches a state of consistency. A typical usage is to re-read based on domain heuristics the tree fragment described by the invalidated path(s).

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

## Binder Configuration

Current configuration options are described below:

-   `matchPolicy` specifies the matching policy for the binder. The binder will only emit events for paths that match the policy. The default value is `path`. The following policies are supported:

    -   `subtree` match policy means that path filtering would return events matching the exact path and its subpaths, ie. changes to children would be allowed to bubble up to parent listeners.
    -   `path` match policy means that path filtering would return events matching the _exact_ path only. In this case _exact_ semantics include interpreting an `undefined` _index_ field in any `PathStep` of a `BindPath` as a wildcard.

-   `autoFlush` specifies whether the binder should automatically flush events. The default value is `true`.
-   `autoFlushPolicy` specifies the policy for automatically flushing events. The default value is `afterBatch`. The following policies are supported:
    -   `afterBatch` flushes events after the `ViewEvents.afterBatch` event is emitted.
-   `sortFn` specifies the sort function for sorting events associated with a given anchor. The default value is `() => 0`, which means no sorting is applied. Interesting examples are sorting events by their type, ie. `Delete` before `Insert`, or custom based on parent fields.
-   `sortAnchorsFn` specifies the sort function for sorting event groups associated with given anchors. The default value is `() => 0`, which means no sorting is applied. Interesting application is depth-first ordering, ie. triggering first events for the deepest anchors in the tree.

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

## Bind Syntax Tree

A binding language provides the means for an application to describe paths of interest in the `editable-tree`. For syntactic compactness, multiple paths can be combined in a single, tree like, binding expression. The binding language is described by the `BindSyntaxTree` type.

For instance, following example describes a binding expression that matches the events (ie. changes) associated with three distinct paths:

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

For precise matching, the expression can include the position of a node in the containing sequence. To avoid the collision with custom attribution, an `[indexSymbol]` is provided. For instance, the following expression matches the events associated with the first element of the `phones` sequence:

```ts
const syntaxTree: BindSyntaxTree = {
	address: {
		phones: { [indexSymbol]: 0 },
	},
};
```

Syntax trees are compiled into an internal representation optimized for processing. The internal representation is described by the `BindTree` type.

Example:

```ts
const syntaxTree: BindSyntaxTree = ...
const bindTree: BindTree = compileSyntaxTree(syntaxTree);
```

## Event Listener Registration

Event listeners are registered using the `register` method of the `DataBinder` interface:

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

| Binder Category | Binding Type               | Description                                      |
| --------------- | -------------------------- | ------------------------------------------------ |
| `Direct`        | `BindingType.Insert`       | Emitted when a new node is inserted in the tree. |
| `Direct`        | `BindingType.Delete`       | Emitted when a node is deleted from the tree.    |
| `Buffering`     | `BindingType.Insert`       | Emitted when a new node is inserted in the tree. |
| `Buffering`     | `BindingType.Delete`       | Emitted when a node is deleted from the tree.    |
| `Batching`      | `BindingType.Batch`        | Emitted when a batch of events is emitted.       |
| `Invalidating`  | `BindingType.Invalidation` | Emitted when a path is invalidated.              |

> Note: the content table above is subject to change. Intentionally left out event types which are in the process of being deprecated.
