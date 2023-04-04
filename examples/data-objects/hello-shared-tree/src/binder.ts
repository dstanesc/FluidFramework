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
import { assert } from "@fluidframework/common-utils";
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
	FieldUpPath,
	Anchor,
} from "@fluid-internal/tree";
import {
	DeltaVisitor,
	ExtVisitor,
	visitDelta,
	isLocalKey,
	ITreeCursorSynchronous,
	isGlobalFieldKey,
	ChangeFamilyEditor,
	FieldKindSpecifier,
	AnchorNode,
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
	bindOnChange(fn: (path: Step[]) => void): () => void;
}

/**
 * Binding for consistency boundaries, ie transaction completion
 */
export interface BatchBinder {
	bindOnBatch(fn: () => void): () => void;
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

class AnchoredDeltaVisitor implements ExtVisitor {
	constructor(
		protected readonly anchoredNode: AnchorNode,
		protected readonly notifyPaths: Step[][],
		protected readonly changeCallback: (path: Step[]) => void,
	) {}

	onDelete(path: FieldUpPath, start: number, count: number): void {
		const current = this.stepFieldDownPath(path, start);
		console.log(
			`onDelete current:${JSON.stringify(current)} filter: ${this.matchesAny(current)}`,
		);
		if (this.matchesAny(current)) {
			this.changeCallback(this.stepDownPath(this.anchoredNode));
		}
	}
	onInsert(path: FieldUpPath, start: number, content: readonly ITreeCursorSynchronous[]): void {
		const current = this.stepFieldDownPath(path, start);
		console.log(
			`onInsert current:${JSON.stringify(current)} filter: ${this.matchesAny(current)}`,
		);
		if (this.matchesAny(current)) {
			this.changeCallback(this.stepDownPath(this.anchoredNode));
		}
	}

	stepDownPath(upPath: UpPath): Step[] {
		const downPath: UpPath[] = topDownPath(upPath);
		const stepDownPath: Step[] = downPath.map((u) => {
			return { field: u.parentField, index: u.parentIndex };
		});
		stepDownPath.shift(); // remove path to root node
		return stepDownPath;
	}

	stepFieldDownPath(fieldUpPath: FieldUpPath, start: number): Step[] {
		assert(fieldUpPath.parent !== undefined, 0);
		const stepDownPath: Step[] = this.stepDownPath(fieldUpPath.parent);
		stepDownPath.push({ field: fieldUpPath.field, index: start });
		return stepDownPath;
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

	bindOnBatch(fn: () => void): () => void {
		const unregister = this.sharedTree.events.on("afterBatch", (changeDelta: Delta.Root) => {
			fn();
		});
		return () => unregister();
	}

	bindOnChange(fn: (path: Step[]) => void): () => void {
		const unregister = this.anchored.anchor[on](
			"subtree",
			(anchorNode: AnchorNode) =>
				new AnchoredDeltaVisitor(anchorNode, this.anchored.paths, fn),
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
