/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { assert } from "@fluidframework/common-utils";
import {
	FieldKey,
	PathVisitor,
	ProtoNodes,
	TreeValue,
	UpPath,
	getDepth,
	topDownPath,
} from "../../core";
import { Events, ISubscribable } from "../../events";
import { brand } from "../../util";
import { EditableTree, on } from "./editableTreeTypes";

/**
 * Interface that describes generic binder events
 * @alpha
 */
export interface BinderEvents {}

/**
 * Binder events reflecting atomic data operations
 * @alpha
 */
export interface OperationBinderEvents extends BinderEvents {
	delete(context: DeleteBindingContext): void;
	insert(context: InsertBindingContext): void;
	setValue(context: SetValueBindingContext): void;
	batch(context: BatchBindingContext): void;
}

/**
 * Binder events signaling state invalidation
 * @alpha
 */
export interface InvalidationBinderEvents extends BinderEvents {
	invalidation(context: InvalidationBindingContext): void;
}

export type CompareFunction<T> = (a: T, b: T) => number;

export type BinderEventsCompare = CompareFunction<BindingContext>;

export type AnchorsCompare = CompareFunction<UpPath>;

/**
 * Options to configure binder behavior.
 *
 * TODO: add more options:
 * `filterFn?: (context: BindingContext) => boolean;`
 * `pathPolicy?: "relative" | "absolute";`
 * @alpha
 */
export interface BinderOptions {
	sortFn?: BinderEventsCompare;
	matchPolicy: MatchPolicy;
}

/**
 * Specialized binder options for flushable binders.
 *
 * @alpha
 */
export interface FlushableBinderOptions<E extends Events<E>> extends BinderOptions {
	autoFlush: boolean;
	autoFlushPolicy: keyof Events<E>;
	sortAnchorsFn?: AnchorsCompare;
}

/**
 * Match categories for bind paths.
 *
 * @alpha
 */
export type MatchPolicy = "subtree" | "path";

/**
 * The data binder interface
 *
 * @alpha
 */
export interface DataBinder<B extends BinderEvents> {
	/**
	 * Listen to specific binder events filtered by anchor, event type and path.
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

/**
 * An interface describing the ability to flush.
 *
 * @alpha
 */
export interface Flushable<T> {
	flush(): T;
}

/**
 * An interface describing a flushable data binder.
 *
 * @alpha
 */
export interface FlushableDataBinder<B extends BinderEvents>
	extends DataBinder<B>,
		Flushable<FlushableDataBinder<B>> {}

/**
 * A step in a bind path
 *
 * @alpha
 */
export interface PathStep {
	readonly field: FieldKey;
	readonly index?: number;
}

export type BindTreeDefault = BindTree;
/**
 * A node in a bind path
 *
 * @alpha
 */
export interface BindTree<T = BindTreeDefault> extends PathStep {
	readonly children: Map<FieldKey, T>;
}

/**
 * Index symbol for syntax tree
 *
 * @alpha
 */
export const indexSymbol = Symbol("editable-tree-binder:index");

/**
 * A syntax node for the bind language
 *
 * @alpha
 */
export interface BindSyntaxTree {
	readonly [indexSymbol]?: number;
	readonly [key: string]: boolean | BindSyntaxTree | number | undefined;
}

/**
 * A down path
 *
 * @alpha
 */
export type DownPath = PathStep[];

/**
 * A bind path
 *
 * @alpha
 */
export type BindPath = DownPath;

/**
 * @alpha
 */
export type BindingContext = DeleteBindingContext | InsertBindingContext | SetValueBindingContext;

/**
 * @alpha
 */
export type BindingContextQueue = BindingContext[];

/**
 * @alpha
 */
export const BindingType = {
	Delete: "delete",
	Insert: "insert",
	SetValue: "setValue",
	Invalidation: "invalidation",
	Batch: "batch",
} as const;

/**
 * @alpha
 */
export type BindingContextType = typeof BindingType[keyof typeof BindingType];

/**
 * @alpha
 */
export interface AbstractBindingContext {
	readonly type: BindingContextType;
}

/**
 * @alpha
 */
export interface DeleteBindingContext extends AbstractBindingContext {
	readonly type: typeof BindingType.Delete;
	readonly path: UpPath;
	readonly count: number;
}

/**
 * @alpha
 */
export interface InsertBindingContext extends AbstractBindingContext {
	readonly type: typeof BindingType.Insert;
	readonly path: UpPath;
	readonly content: ProtoNodes;
}

/**
 * @alpha
 */
export interface SetValueBindingContext extends AbstractBindingContext {
	readonly type: typeof BindingType.SetValue;
	readonly path: UpPath;
	readonly value: TreeValue;
}

/**
 * @alpha
 */
export interface InvalidationBindingContext extends AbstractBindingContext {
	readonly type: typeof BindingType.Invalidation;
}

/**
 * @alpha
 */
export interface BatchBindingContext extends AbstractBindingContext {
	readonly type: typeof BindingType.Batch;
	readonly events: BindingContext[];
}

type CallTree = BindTree<CallTree> & { listeners: Set<(...args: unknown[]) => any> };

abstract class AbstractPathVisitor implements PathVisitor {
	protected readonly registeredListeners: Map<BindingContextType, CallTree[]> = new Map();
	public constructor(protected readonly options: BinderOptions) {}
	public abstract onDelete(path: UpPath, count: number): void;
	public abstract onInsert(path: UpPath, content: ProtoNodes): void;
	public abstract onSetValue(path: UpPath, value: TreeValue): void;
	public registerListener(
		contextType: BindingContextType,
		trees: BindTree[],
		listener: (...args: unknown[]) => any,
	): () => void {
		const contextRoots = this.registeredListeners.get(contextType) ?? [];
		if (contextRoots.length === 0) {
			this.registeredListeners.set(contextType, contextRoots);
		}
		trees.forEach((tree) => {
			const currentRoot = this.findRoot(contextType, tree.field);
			if (currentRoot === undefined) {
				const newRoot: CallTree = {
					field: tree.field,
					index: tree.index,
					listeners: new Set(),
					children: new Map(),
				};
				contextRoots.push(newRoot);
				this.bindTree(contextType, tree, listener, newRoot);
			} else {
				this.bindTree(contextType, tree, listener, currentRoot);
			}
		});
		return () => {
			trees.forEach((tree) => this.unregisterListener(contextType, tree, listener));
		};
	}

	private bindTree(
		contextType: BindingContextType,
		tree: BindTree,
		listener: (...args: unknown[]) => any,
		callTree: CallTree,
	) {
		if (tree.children.size === 0) {
			callTree.listeners.add(listener);
		} else {
			tree.children.forEach((childTree, fieldKey) => {
				let childCallTree: CallTree | undefined = callTree.children.get(fieldKey);
				if (childCallTree === undefined) {
					childCallTree = {
						field: fieldKey,
						index: childTree.index,
						listeners: new Set(),
						children: new Map(),
					};
					callTree.children.set(fieldKey, childCallTree);
				}
				this.bindTree(contextType, childTree, listener, childCallTree);
			});
		}
	}

	private findRoot(contextType: BindingContextType, field: FieldKey): CallTree | undefined {
		const contextRoots = this.registeredListeners.get(contextType);
		if (!contextRoots) {
			return undefined;
		}
		return contextRoots.find((root) => root.field === field);
	}

	private unregisterListener(
		contextType: BindingContextType,
		tree: BindTree,
		listener: (...args: unknown[]) => any,
		callTree?: CallTree,
	) {
		let foundTree = callTree;
		if (foundTree === undefined) {
			foundTree = this.findRoot(contextType, tree.field);
		}
		if (foundTree !== undefined) {
			if (tree.children.size === 0) {
				foundTree.listeners.delete(listener);
			} else {
				tree.children.forEach((childTree, fieldKey) => {
					assert(foundTree !== undefined, "foundTree is not undefined");
					const childCallTree = foundTree.children.get(fieldKey);
					if (childCallTree) {
						this.unregisterListener(contextType, childTree, listener, childCallTree);
					}
				});
			}
		}
	}

	protected matchPath(
		contextType: BindingContextType,
		downPath: DownPath,
	): Set<(...args: unknown[]) => any> | undefined {
		const foundRoot = this.findRoot(contextType, downPath[0].field);
		if (foundRoot === undefined) {
			return undefined;
		} else {
			const isMatching = (
				treeNode: CallTree,
				index: number,
				onMatch: (index: number, treeNode: CallTree) => CallTree | undefined,
			): CallTree | undefined => {
				const step = downPath[index];
				if (
					treeNode.field !== step.field ||
					(treeNode.index !== undefined && step.index !== treeNode.index)
				) {
					return undefined;
				}
				for (const child of treeNode.children.values()) {
					const foundNode = isMatching(child, index + 1, onMatch);
					if (foundNode !== undefined) {
						return foundNode;
					}
				}
				return onMatch(index, treeNode);
			};
			const onMatchPath = (index: number, treeNode: CallTree): CallTree | undefined => {
				return index === downPath.length - 1 ? treeNode : undefined;
			};
			const onMatchSubtree = (index: number, treeNode: CallTree): CallTree | undefined => {
				return treeNode;
			};
			const matchedNode =
				this.options.matchPolicy === "subtree"
					? isMatching(foundRoot, 0, onMatchSubtree)
					: isMatching(foundRoot, 0, onMatchPath);

			return matchedNode?.listeners;
		}
	}

	public hasRegisteredContextType(contextType: BindingContextType): boolean {
		return this.registeredListeners.has(contextType);
	}

	public dispose(): void {
		this.registeredListeners.clear();
	}
}

class DirectPathVisitor extends AbstractPathVisitor {
	public constructor(options: BinderOptions) {
		super(options);
	}

	private processCallbacks(
		path: UpPath,
		callbacks: Set<(...args: unknown[]) => any>,
		otherArgs: object,
	): void {
		for (const callback of callbacks) {
			callback({
				path,
				...otherArgs,
			});
		}
	}

	private processRegisteredPaths(
		path: UpPath,
		type: BindingContextType,
		otherArgs: object,
	): void {
		const current = toDownPath<BindPath>(path);
		const callbacks = this.matchPath(type, current);
		if (callbacks !== undefined) {
			this.processCallbacks(path, callbacks, otherArgs);
		}
	}

	public onDelete(path: UpPath, count: number): void {
		this.processRegisteredPaths(path, BindingType.Delete, {
			count,
			type: BindingType.Delete,
		});
	}

	public onInsert(path: UpPath, content: ProtoNodes): void {
		this.processRegisteredPaths(path, BindingType.Insert, {
			content,
			type: BindingType.Insert,
		});
	}

	public onSetValue(path: UpPath, value: TreeValue): void {
		this.processRegisteredPaths(path, BindingType.SetValue, {
			value,
			type: BindingType.SetValue,
		});
	}
}

class InvalidatingPathVisitor
	extends AbstractPathVisitor
	implements Flushable<InvalidatingPathVisitor>
{
	private readonly callbacks: Set<(...args: unknown[]) => any> = new Set();

	public constructor(options: BinderOptions) {
		super(options);
	}

	private processRegisteredPaths(path: UpPath): void {
		const current = toDownPath<BindPath>(path);
		const callbacks = this.matchPath(BindingType.Invalidation, current);
		if (callbacks !== undefined) {
			for (const callback of callbacks) {
				this.callbacks.add(callback);
			}
		}
	}

	public onDelete(path: UpPath, count: number): void {
		this.processRegisteredPaths(path);
	}

	public onInsert(path: UpPath, content: ProtoNodes): void {
		this.processRegisteredPaths(path);
	}

	public onSetValue(path: UpPath, value: TreeValue): void {
		this.processRegisteredPaths(path);
	}

	public flush(): InvalidatingPathVisitor {
		for (const callback of this.callbacks) {
			callback({
				type: BindingType.Invalidation,
			});
		}
		this.callbacks.clear();
		return this;
	}
}

type CallableBindingContext = BindingContext & {
	callbacks: Set<(...args: unknown[]) => any>;
};

class BufferingPathVisitor extends AbstractPathVisitor implements Flushable<BufferingPathVisitor> {
	private readonly eventQueue: CallableBindingContext[] = [];

	public constructor(options: BinderOptions) {
		super(options);
	}
	public onDelete(path: UpPath, count: number): void {
		const current = toDownPath<BindPath>(path);
		const callbacks = this.matchPath(BindingType.Delete, current);
		if (callbacks !== undefined) {
			this.eventQueue.push({
				path,
				count,
				type: BindingType.Delete,
				callbacks,
			});
		}
	}

	public onInsert(path: UpPath, content: ProtoNodes): void {
		const current = toDownPath<BindPath>(path);
		const callbacks = this.matchPath(BindingType.Insert, current);
		if (callbacks !== undefined) {
			this.eventQueue.push({
				path,
				content,
				type: BindingType.Insert,
				callbacks,
			});
		}
	}

	public onSetValue(path: UpPath, value: TreeValue): void {
		const current = toDownPath<BindPath>(path);
		const callbacks = this.matchPath(BindingType.Delete, current);
		if (callbacks !== undefined) {
			this.eventQueue.push({
				path,
				value,
				type: BindingType.SetValue,
				callbacks,
			});
		}
	}

	public flush(): BufferingPathVisitor {
		const sortedQueue: CallableBindingContext[] = nativeSort(
			this.eventQueue,
			this.options.sortFn ?? compareBinderEventsDeleteFirst,
		);
		const batchEventIndices = new Set<number>();
		const batchEvents: CallableBindingContext[] = [];
		const collected = new Set<(...args: unknown[]) => any>();
		if (this.hasRegisteredContextType(BindingType.Batch)) {
			for (let i = 0; i < sortedQueue.length; i++) {
				const event = sortedQueue[i];
				const current = toDownPath<BindPath>(event.path);
				const callbacks = this.matchPath(BindingType.Batch, current);
				if (callbacks !== undefined && callbacks.size > 0) {
					for (const callback of callbacks) {
						collected.add(callback);
					}
					batchEvents.push(event);
					batchEventIndices.add(i);
				}
			}
		}
		if (batchEvents.length > 0) {
			for (const callback of collected) {
				callback({
					type: BindingType.Batch,
					events: batchEvents,
				});
			}
		}
		for (let i = 0; i < sortedQueue.length; i++) {
			if (batchEventIndices.has(i)) {
				continue;
			}
			const { callbacks, ...context } = sortedQueue[i];
			for (const callback of callbacks) {
				callback({ ...context });
			}
		}
		this.eventQueue.length = 0;
		return this;
	}

	public override dispose(): void {
		this.flush();
		super.dispose();
	}
}

class AbstractDataBinder<
	B extends BinderEvents,
	V extends AbstractPathVisitor,
	O extends BinderOptions,
> implements DataBinder<B>
{
	protected readonly visitors = new Map<EditableTree, V>();
	protected readonly visitorLocations = new Map<V, UpPath>();
	protected readonly unregisterHandles: Set<() => void> = new Set();
	public constructor(
		protected readonly options: O,
		protected readonly visitorFactory: (anchor: EditableTree) => V,
	) {}

	public register<K extends keyof Events<B>>(
		anchor: EditableTree,
		eventType: K,
		eventTrees: BindTree[],
		listener: B[K],
	): void {
		// TODO: validate BindPath semantics against the schema
		let visitor = this.visitors.get(anchor);
		if (visitor === undefined) {
			visitor = this.visitorFactory(anchor);
			this.visitors.set(anchor, visitor);
			this.unregisterHandles.add(
				anchor[on]("subtreeChanging", (upPath: UpPath) => {
					assert(visitor !== undefined, "visitor expected to be defined");
					if (!this.visitorLocations.has(visitor)) {
						this.visitorLocations.set(visitor, upPath);
					}
					return visitor;
				}),
			);
		}
		const contextType: BindingContextType = eventType as BindingContextType;
		this.unregisterHandles.add(
			visitor.registerListener(
				contextType,
				eventTrees,
				listener as unknown as (...args: unknown[]) => any,
			),
		);
	}
	public unregisterAll(): void {
		for (const unregisterHandle of this.unregisterHandles) {
			unregisterHandle();
		}
		this.unregisterHandles.clear();
		for (const visitor of this.visitors.values()) {
			visitor.dispose();
		}
		this.visitors.clear();
	}

	public extractBindPaths(root: BindTree): BindPath[] {
		const result: BindPath[] = [];
		const depthFirst = (node: BindTree, path: PathStep[] = [root]): void => {
			if (node.children.size === 0) {
				result.push(path);
				return;
			}
			for (const [field, childNode] of node.children.entries()) {
				depthFirst(childNode, [...path, { field, index: childNode.index }]);
			}
		};
		depthFirst(root);
		return result;
	}
}

class BufferingDataBinder<E extends Events<E>>
	extends AbstractDataBinder<
		OperationBinderEvents,
		BufferingPathVisitor,
		FlushableBinderOptions<E>
	>
	implements FlushableDataBinder<OperationBinderEvents>
{
	protected readonly view: ISubscribable<E>;
	protected readonly autoFlushPolicy: keyof Events<E>;
	public constructor(view: ISubscribable<E>, options: FlushableBinderOptions<E>) {
		super(options, (anchor: EditableTree) => new BufferingPathVisitor(options));
		this.view = view;
		this.autoFlushPolicy = options.autoFlushPolicy;
		if (options.autoFlush) {
			this.enableAutoFlush();
		}
	}

	public flush(): FlushableDataBinder<OperationBinderEvents> {
		const unsortedVisitors: BufferingPathVisitor[] = Array.from(this.visitorLocations.keys());
		const sortFn = this.options.sortAnchorsFn ?? compareAnchorsDepthFirst;
		const compareFn = (a: BufferingPathVisitor, b: BufferingPathVisitor) => {
			const pathA = this.visitorLocations.get(a);
			const pathB = this.visitorLocations.get(b);
			assert(pathA !== undefined, "pathA expected to be defined");
			assert(pathB !== undefined, "pathB expected to be defined");
			return sortFn(pathA, pathB);
		};
		const sortedVisitors: BufferingPathVisitor[] = nativeSort(unsortedVisitors, compareFn);
		for (const visitor of sortedVisitors) {
			visitor.flush();
		}
		return this;
	}

	private enableAutoFlush(): FlushableDataBinder<OperationBinderEvents> {
		const callbackFn = (() => {
			this.flush();
		}) as E[keyof Events<E>];
		const unregisterFlushing = this.view.on(this.autoFlushPolicy, callbackFn);
		this.unregisterHandles.add(unregisterFlushing);
		return this;
	}
}

class DirectDataBinder<E extends Events<E>> extends AbstractDataBinder<
	OperationBinderEvents,
	DirectPathVisitor,
	BinderOptions
> {
	public constructor(view: ISubscribable<E>, options: BinderOptions) {
		super(options, (anchor: EditableTree) => new DirectPathVisitor(options));
	}
}

class InvalidateDataBinder<E extends Events<E>>
	extends AbstractDataBinder<
		InvalidationBinderEvents,
		InvalidatingPathVisitor,
		FlushableBinderOptions<E>
	>
	implements FlushableDataBinder<InvalidationBinderEvents>
{
	protected readonly view: ISubscribable<E>;
	protected readonly autoFlushPolicy;
	public constructor(view: ISubscribable<E>, options: FlushableBinderOptions<E>) {
		super(options, (anchor: EditableTree) => new InvalidatingPathVisitor(options));
		this.view = view;
		this.autoFlushPolicy = options.autoFlushPolicy;
		if (options.autoFlush) {
			this.enableAutoFlush();
		}
	}
	public flush(): FlushableDataBinder<InvalidationBinderEvents> {
		for (const visitor of this.visitors.values()) {
			visitor.flush();
		}
		return this;
	}
	private enableAutoFlush(): FlushableDataBinder<InvalidationBinderEvents> {
		const callbackFn = (() => {
			this.flush();
		}) as E[keyof Events<E>];
		const unregisterFlushing = this.view.on(this.autoFlushPolicy, callbackFn);
		this.unregisterHandles.add(unregisterFlushing);
		return this;
	}
}

/**
 * @alpha
 */
export function toDownPath<T extends DownPath = DownPath>(upPath: UpPath): T {
	const downPath: UpPath[] = topDownPath(upPath);
	const stepDownPath: PathStep[] = downPath.map((u) => {
		return { field: u.parentField, index: u.parentIndex };
	});
	stepDownPath.shift(); // remove last step to the root node
	return stepDownPath as T;
}

/**
 * @alpha
 */
export function createDataBinderBuffering<E extends Events<E>>(
	view: ISubscribable<E>,
	options: FlushableBinderOptions<E>,
): FlushableDataBinder<OperationBinderEvents> {
	return new BufferingDataBinder(view, options);
}

/**
 * @alpha
 */
export function createDataBinderDirect<E extends Events<E>>(
	view: ISubscribable<E>,
	options: BinderOptions,
): DataBinder<OperationBinderEvents> {
	return new DirectDataBinder(view, options);
}

/**
 * @alpha
 */
export function createDataBinderInvalidating<E extends Events<E>>(
	view: ISubscribable<E>,
	options: FlushableBinderOptions<E>,
): FlushableDataBinder<InvalidationBinderEvents> {
	return new InvalidateDataBinder(view, options);
}

/**
 * @alpha
 */
export function createBinderOptions({
	matchPolicy = "path",
	sortFn,
}: {
	matchPolicy?: MatchPolicy;
	sortFn?: BinderEventsCompare;
}): BinderOptions {
	return { matchPolicy, sortFn };
}

/**
 * @alpha
 */
export function createFlushableBinderOptions<E extends Events<E>>({
	matchPolicy = "path",
	sortFn,
	sortAnchorsFn,
	autoFlush = true,
	autoFlushPolicy,
}: {
	matchPolicy?: MatchPolicy;
	sortFn?: BinderEventsCompare;
	sortAnchorsFn?: AnchorsCompare;
	autoFlush?: boolean;
	autoFlushPolicy: keyof Events<E>;
}): FlushableBinderOptions<E> {
	return {
		matchPolicy,
		sortFn,
		sortAnchorsFn,
		autoFlush,
		autoFlushPolicy,
	};
}

export function compareBinderEventsDeleteFirst(a: BindingContext, b: BindingContext): number {
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

export function compareAnchorsDepthFirst(a: UpPath, b: UpPath): number {
	return getDepth(a) - getDepth(b);
}

export function comparePipeline<T>(...fns: CompareFunction<T>[]): CompareFunction<T> {
	return (a: T, b: T): number => {
		for (const fn of fns) {
			const result = fn(a, b);
			if (result !== 0) {
				return result;
			}
		}
		return 0;
	};
}

export function nativeSort<T>(arr: T[], compareFn: CompareFunction<T>): T[] {
	return [...arr].sort(compareFn);
}

export function compileSyntaxTree(syntaxTree: BindSyntaxTree): BindTree {
	const entries = Object.entries(syntaxTree);
	if (entries.length === 1) {
		const [fieldName, childNode] = entries[0];
		const fieldKey: FieldKey = brand(fieldName);
		return compileSyntaxTreeNode(childNode as BindSyntaxTree, fieldKey);
	} else throw new Error("Invalid BindSyntaxTree structure");
}

function compileSyntaxTreeNode(node: BindSyntaxTree, parentField: FieldKey): BindTree {
	const pathStep: PathStep = {
		field: parentField,
		index: node[indexSymbol],
	};
	const children = new Map<FieldKey, BindTree>();
	for (const [key, value] of Object.entries(node)) {
		const fieldKey: FieldKey = brand(key);
		if (typeof value === "object") {
			const childTree = compileSyntaxTreeNode(value, fieldKey);
			if (childTree !== undefined) {
				children.set(fieldKey, childTree);
			}
		} else if (value === true) {
			children.set(fieldKey, { field: fieldKey, children: new Map() });
		}
	}
	return {
		...pathStep,
		children,
	};
}
