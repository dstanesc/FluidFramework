/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable unused-imports/no-unused-imports */
/* eslint-disable unicorn/prefer-string-slice */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable import/no-default-export */
/* eslint-disable import/no-internal-modules */
/* eslint-disable import/no-unassigned-import */
/* eslint-disable @typescript-eslint/no-floating-promises */

import {
	brand,
	SchemaData,
	emptyField,
	ValueSchema,
	EditableTree,
	Brand,
	Delta,
	fieldSchema,
	JsonableTree,
	FieldKey,
	Value,
	LocalFieldKey,
	rootFieldKey,
	rootFieldKeySymbol,
	ContextuallyTypedNodeData,
	FieldKinds,
	FieldSchema,
	FieldKindIdentifier,
	namedTreeSchema,
	singleTextCursor,
	typeNameSymbol,
	valueSymbol,
	TreeSchemaIdentifier,
	TreeSchema,
	TreeTypeSet,
	NamedTreeSchema,
	jsonableTreeFromCursor,
	BrandedType,
	ModularChangeset,
	on,
	getField,
	ISharedTree,
	UpPath,
	Anchor,
} from "@fluid-internal/tree";
import {
	DeltaVisitor,
	visitDelta,
	isLocalKey,
	ITreeCursorSynchronous,
	isGlobalFieldKey,
	ChangeFamilyEditor,
	FieldKindSpecifier,
} from "@fluid-internal/tree/dist/core";
import { topDownPath } from "@fluid-internal/tree/dist/core/tree/pathTree";

// ======= API Start ==========

/**
 * Categories of changes, such node local, subtree
 */
// export enum ChangeCategory {
// 	LOCAL,
// 	SUBTREE,
// }

/**
 * Binding for changes, local or subtree, see {@link AnchoredPathBinder}
 */
export interface ChangeBinder {
	bindOnChange(fn: (path: Step[], delta: Delta.Root) => void): () => void;
}

/**
 * Binding for consistency boundaries, ie transaction completion
 */
export interface BatchBinder {
	bindOnBatch(fn: (changeDelta: Delta.Root) => void): () => void;
}

interface Step {
	readonly field: FieldKey;
	readonly index: number;
}

interface Anchored {
	readonly anchor: EditableTree;
	readonly paths: Step[][];
}

// ======= API End ==========

class AnchoredDeltaVisitor implements DeltaVisitor {
	protected readonly indices: number[] = [];
	protected readonly path: FieldKey[] = [];

	constructor(
		protected readonly changeDelta: Delta.Root,
		protected readonly nodePath: Step[],
		protected readonly notifyPaths: Step[][],
		protected fn: (path: Step[], delta: Delta.Root) => void,
	) {}

	onDelete(index: number, count: number): void {
		this.indices.push(index);
		const current = this.currentDownPath();
		if (this.isSubPath(current, this.nodePath) && this.matchesAny(current)) {
			console.log(`onDelete current:${JSON.stringify(this.currentDownPath())}`);
			console.log(`onDelete node:${JSON.stringify(this.nodePath)}`);
			console.log(`onDelete notify: ${JSON.stringify(this.notifyPaths)}`);
			this.fn(current, this.changeDelta);
		}
		this.indices.pop();
	}
	onInsert(index: number, content: readonly ITreeCursorSynchronous[]): void {
		this.indices.push(index);
		const current = this.currentDownPath();
		if (this.isSubPath(current, this.nodePath) && this.matchesAny(current)) {
			console.log(`onDelete current:${JSON.stringify(this.currentDownPath())}`);
			console.log(`onDelete node:${JSON.stringify(this.nodePath)}`);
			console.log(`onDelete notify: ${JSON.stringify(this.notifyPaths)}`);
			this.fn(current, this.changeDelta);
		}
		this.indices.pop();
	}
	onMoveOut(index: number, count: number, id: Delta.MoveId): void {
		throw new Error("Method not implemented.");
	}
	onMoveIn(index: number, count: number, id: Delta.MoveId): void {
		throw new Error("Method not implemented.");
	}
	onSetValue(value: Value): void {
		throw new Error("Method not implemented.");
	}
	enterNode(index: number): void {
		this.indices.push(index);
	}
	exitNode(index: number): void {
		this.indices.pop();
	}
	enterField(key: FieldKey): void {
		this.path.push(key);
	}
	exitField(key: FieldKey): void {
		this.path.pop();
	}
	currentDownPath(): Step[] {
		const steps: Step[] = [];
		for (let i = 1; i < this.indices.length; i++) {
			// skip root
			const index = this.indices[i];
			const field = this.path[i];
			steps.push({ index, field });
		}

		return steps;
	}
	isSubPath(path: Step[], subPath: Step[]): boolean {
		if (subPath.length > path.length) {
			return false;
		}
		for (let i = 0; i < subPath.length; i++) {
			if (subPath[i].field !== path[i].field || subPath[i].index !== path[i].index) {
				return false;
			}
		}
		return true;
	}
	isEqual(current: Step[], other: Step[]): boolean {
		return (
			current.length === other.length &&
			current.every(
				(step, i) => step.index === other[i].index && step.field === other[i].field,
			)
		);
	}
	// impl match policy - such SUBPATH, EQUAL
	matchesAny(current: Step[]): boolean {
		if (this.notifyPaths.length === 0) return true;
		for (const path of this.notifyPaths) {
			if (this.isEqual(current, path)) {
				return true;
			}
		}
		return false;
	}
}

/**
 * Anchored binder, eg. impl. both {@link ChangeBinder} , {@link BatchBinder} interfaces
 */
class AnchoredPathBinder implements ChangeBinder, BatchBinder {

	constructor(public readonly sharedTree: ISharedTree, public readonly anchored: Anchored) {}

	stepDownPath(upPath: UpPath): Step[] {
		const downPath: UpPath[] = topDownPath(upPath);
		const stepDownPath: Step[] = downPath.map((u) => {
			return { field: u.parentField, index: u.parentIndex };
		});
		stepDownPath.shift(); // remove path to root node
		return stepDownPath;
	}

	bindOnBatch(fn: (changeDelta: Delta.Root) => void): () => void {
		const unregister = this.sharedTree.events.on("afterBatch", (changeDelta: Delta.Root) => {
			fn(changeDelta);
		});
		return () => unregister();
	}

	bindOnChange(fn: (path: Step[], delta: Delta.Root) => void): () => void {
		const unregister = this.anchored.anchor[on](
			"subtreeChanging",
			(anchor: Anchor, upPath: UpPath, changeDelta: Delta.Root) => {
				const downPath: Step[] = this.stepDownPath(upPath);
				visitDelta(
					changeDelta,
					new AnchoredDeltaVisitor(changeDelta, downPath, this.anchored.paths, fn),
				);
			},
		);
		return () => {
			unregister();
		};
	}
}

function replacer(key, value) {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return value instanceof Map
		? {
				mapped: [...value.entries()],
		  }
		: value;
}

/**
 * Simple expression parser, strict in the following format `field[index].field[index].field[index]`
 *
 * @param expression - expression text
 * @returns syntax validated Step[]
 */
function parseSteps(expression: string): Step[] {
	const steps: Step[] = [];
	const regex = /(\w+)\[(\d+)]/g;
	let match;
	while ((match = regex.exec(expression)) !== null) {
		const field = match[1] as string;
		const branded: LocalFieldKey = brand(field);
		const index = Number(match[2]);
		steps.push({ field: branded, index });
	}
	return steps;
}

/**
 * Simple semantic validation
 * @param steps - a schema path
 * @param schema - a schema
 * @returns semantically validated Step[]
 */
function validate(steps: Step[], schema: SchemaData): Step[] {
	const rootSchemaIdentifiers = schema.globalFieldSchema.get(rootFieldKey)?.types;
	let nextSchemaIdentifiers = rootSchemaIdentifiers;
	const out: Step[] = [];
	label: for (const step of steps) {
		let found = false;
		if (nextSchemaIdentifiers !== undefined) {
			const nextSchemaIdentifiersExist =
				nextSchemaIdentifiers as ReadonlySet<TreeSchemaIdentifier>;
			for (const nextSchemaIdentifier of nextSchemaIdentifiersExist) {
				const treeSchema: TreeSchema | undefined =
					schema.treeSchema.get(nextSchemaIdentifier);
				if (treeSchema !== undefined && isLocalKey(step.field)) {
					const localFieldSchema: FieldSchema | undefined = treeSchema.localFields.get(
						step.field,
					);
					if (localFieldSchema !== undefined) {
						out.push(step);
						nextSchemaIdentifiers = localFieldSchema?.types;
						found = true;
						continue label;
					}
				}
			}
		}
		if (!found) throw new Error(`Path error, field ${step.field.toString()} not found`);
	}
	return out;
}

const drawKeys: LocalFieldKey = brand("drawKeys");
/**
 * Anchored binder factory
 *
 * @returns binder instance
 */
export function createAnchoredBinder(
	tree: ISharedTree,
	anchor: EditableTree,
	schema: SchemaData,
	expressions: string[],
): AnchoredPathBinder {
	const paths: Step[][] = expressions.map((expr) => validate(parseSteps(expr), schema));
	const anchored: Anchored = { anchor, paths };
	return new AnchoredPathBinder(tree, anchored);
}
