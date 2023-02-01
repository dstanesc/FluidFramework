import { Delta, CursorLocationType, TreeSchemaIdentifier, EditableTreeContext, getField, EditableField, EditableTree, typeNameSymbol } from '@fluid-internal/tree';
import { SerializedChangeSet } from '@fluid-experimental/property-changeset';
import { DeltaVisitor, FieldKey, ITreeCursorSynchronous, Value, visitDelta, rootFieldKeySymbol, ITreeCursor } from '@fluid-internal/tree/dist/tree';
import { assert } from '@fluidframework/common-utils';

enum EntryType {
    Insert,
    Modify,
    Delete,
    MoveIn,
    MoveOut,
    Unknown
}

const opNames = [
    'insert',
    'modify',
    'remove',
    'moveIn',
    'moveOut',
    'unknown'
];
interface traversalStackEntry {
    keyName: FieldKey;
    type: EntryType;
    typeId: string;
    currentChangeSet: SerializedChangeSet;
    parentChangeSet: SerializedChangeSet;
    value: any;
    treeNode: EditableTree | undefined;
    treeField: EditableField | undefined;
}
function convertCursorToCS(cursor: ITreeCursor, root = true): [SerializedChangeSet, TreeSchemaIdentifier] {
    if (cursor.value !== undefined) {
        return [cursor.value, cursor.type];
    } else {
        if (cursor.mode === CursorLocationType.Nodes) {
            return cursor.firstField() ?
                convertCursorToCS(cursor, false) :
                [{}, cursor.type];
        } else {
            const changes = {

            };

            do {
                if (cursor.firstNode()) {
                    const [nestedCS, nestedType] = convertCursorToCS(cursor, false);
                    cursor.exitNode();
                    changes[nestedType] = changes[nestedType] || {};
                    changes[nestedType][cursor.getFieldKey()] = nestedCS;
                } else {
                    changes[cursor.type] = changes[cursor.type] || {};
                    changes[cursor.type][cursor.getFieldKey()] = {};
                }
            } while (cursor.nextField());

            return [
                {
                    insert: changes
                },
                cursor.type
            ];
        }
    }
}
class DeltaConversionVisitor implements DeltaVisitor {
    public changeSet: SerializedChangeSet = {};
    private readonly currentTraversalStack: traversalStackEntry[] = [];

    constructor(private readonly root: EditableField) {
    }

    onDelete(index: number, count: number): void {
        assert(index === 0, 'arrays not yet supported');
        assert(count === 1, 'arrays not yet supported');

        const stackTop = this.currentTraversalStack[this.currentTraversalStack.length - 1];
        const parentChangeSet = stackTop.parentChangeSet;

        parentChangeSet.remove = parentChangeSet.remove || [];
        parentChangeSet.remove.push(stackTop.keyName);
    }

    onInsert(index: number, content: ITreeCursorSynchronous[]): void {
        assert(content.length === 1, 'arrays not yet supported');
        const insertedNode = content[0];
        const [insertedCS, type] = convertCursorToCS(insertedNode);

        const stackTop = this.currentTraversalStack[this.currentTraversalStack.length - 1];
        const parentChangeSet = stackTop.parentChangeSet;
        const opName = 'insert';
        parentChangeSet[opName] = parentChangeSet[opName] || {};
        parentChangeSet[opName][type] = parentChangeSet[opName][type] || {};
        parentChangeSet[opName][type][stackTop.keyName] = insertedCS;
    }

    onMoveOut(index: number, count: number, id: Delta.MoveId): void {
    }
    onMoveIn(index: number, count: number, id: Delta.MoveId): void {
    }
    onSetValue(value: Value): void {
        // console.log(`Setting: ${value}`);
        const stackTop = this.currentTraversalStack[this.currentTraversalStack.length - 1];
        stackTop.value = value;
    }
    enterNode(index: number): void {
        if (index !== 0) {
            console.log('Unsupported array operation');
        } else {

            const stackTop = this.currentTraversalStack[this.currentTraversalStack.length - 1];
            stackTop.treeNode = stackTop.treeField?.getNode(0);
            stackTop.typeId = stackTop.treeNode?.[typeNameSymbol] ?? "internal:unknown-1.0.0";
            stackTop.value = {};

            if (typeof stackTop.keyName === 'symbol' &&
                    Symbol.keyFor(stackTop.keyName) === Symbol.keyFor(rootFieldKeySymbol)) {
            } else {
                const parentChangeSet = stackTop.parentChangeSet;
                const opName = opNames[stackTop.type];
                parentChangeSet[opName] = parentChangeSet[opName] || {};
                parentChangeSet[opName][stackTop.typeId] = parentChangeSet[opName][stackTop.typeId] || {};
                stackTop.value = parentChangeSet[opName][stackTop.typeId][stackTop.keyName] || {};
                stackTop.currentChangeSet = stackTop.value;
            }

        }
    }
    exitNode(index: number): void {
        const stackTop = this.currentTraversalStack[this.currentTraversalStack.length - 1];

        if (typeof stackTop.keyName === 'symbol' &&
                Symbol.keyFor(stackTop.keyName) === Symbol.keyFor(rootFieldKeySymbol)) {
        } else {
            const parentChangeSet = stackTop.parentChangeSet;
            const opName = opNames[stackTop.type];
            parentChangeSet[opName][stackTop.typeId][stackTop.keyName] = stackTop.value;
        }
    }
    enterField(key: FieldKey): void {
        const stackTop = this.currentTraversalStack[this.currentTraversalStack.length - 1];

        if (typeof key === 'symbol' &&
                   Symbol.keyFor(key) === Symbol.keyFor(rootFieldKeySymbol)) {
            this.currentTraversalStack.push({
                keyName: rootFieldKeySymbol,
                typeId: "type:unknown-1.0.0",
                type: EntryType.Modify,
                currentChangeSet: this.changeSet,
                parentChangeSet: this.changeSet,
                value: undefined,
                treeNode: this.root.getNode(0),
                treeField: this.root
            });
        } else {
            // console.log(`Entering ${String(key)}`);
            this.currentTraversalStack.push({
                keyName: key,
                typeId: "type:unknown-1.0.0",
                type: this.currentTraversalStack[this.currentTraversalStack.length - 1].type,
                parentChangeSet: this.currentTraversalStack[this.currentTraversalStack.length - 1].currentChangeSet,
                currentChangeSet: undefined,
                value: undefined,
                treeField: stackTop.treeNode![getField](key),
                treeNode: undefined
            });
        }
    }
    exitField(key: FieldKey): void {
        this.currentTraversalStack.pop();
        if (typeof key === "string") {
            // console.log(`Leaving ${key}`);
        } else if (typeof key === 'symbol' &&
                   Symbol.keyFor(key) === Symbol.keyFor(rootFieldKeySymbol)) {

        } else {
            console.error('Currently unsported local key.');
        }
    }
};

export function convertDeltaToCSet(delta: Delta.Root, context: EditableTreeContext): SerializedChangeSet {
    const visitor = new DeltaConversionVisitor(context.root);
    visitDelta(delta, visitor);
    return visitor.changeSet;
}

export function convertCursorToInsertCSet(cursor: ITreeCursor,
                                          context: EditableTreeContext): SerializedChangeSet {
    /*const visitor = new DeltaConversionVisitor(context.root);
    visitDelta(delta, visitor);
    return visitor.changeSet;*/

    const CSet = convertCursorToCS(cursor);
    return CSet;
}
