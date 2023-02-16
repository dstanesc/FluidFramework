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
    UpPath,
    jsonableTreeFromCursor,
    BrandedType,
} from "@fluid-internal/tree";
import { DeltaVisitor, visitDelta, isLocalKey, ITreeCursorSynchronous, isGlobalFieldKey } from "@fluid-internal/tree/dist/core";

import React, { useState, useEffect } from "react";
import "./App.css";
import { initializeWorkspace, Workspace } from "./workspace";

const valueKeys: LocalFieldKey = brand("valueKeys");

const drawKeys: LocalFieldKey = brand("drawKeys");

export type Int32 = EditableTree & Brand<number, "myApp:Int32-1.0.0">;

export type Dice = EditableTree & Brand<{ valueKeys: Int32[]; }, "myApp:Dice-1.0.0">;

export type Draw = EditableTree & Brand<{ drawKeys: Dice[]; }, "myApp:Draw-1.0.0">;

const int32Schema = namedTreeSchema({
    name: brand("myApp:Int32-1.0.0"),
    value: ValueSchema.Number,
    globalFields: new Set(),
    extraLocalFields: emptyField,
    extraGlobalFields: false,
});

const diceSchema = namedTreeSchema({
    name: brand("myApp:Dice-1.0.0"),
    localFields: {
        [valueKeys]: fieldSchema(FieldKinds.sequence, [int32Schema.name]),
    },
    globalFields: new Set(),
    extraLocalFields: emptyField,
    extraGlobalFields: false,
    value: ValueSchema.Nothing,
});

const drawSchema = namedTreeSchema({
    name: brand("myApp:Draw-1.0.0"),
    localFields: {
        [drawKeys]: fieldSchema(FieldKinds.sequence, [diceSchema.name]),
    },
    globalFields: new Set(),
    extraLocalFields: emptyField,
    extraGlobalFields: false,
    value: ValueSchema.Nothing,
});

const appSchema: SchemaData = {
    treeSchema: new Map([
        [drawSchema.name, drawSchema],
        [diceSchema.name, diceSchema],
        [int32Schema.name, int32Schema]
    ]),
    globalFieldSchema: new Map([
        [rootFieldKey, fieldSchema(FieldKinds.optional, [drawSchema.name])],
    ]),
};

export class PathElem {
    constructor(
        public readonly fieldKey: LocalFieldKey,
        public readonly fieldKind: FieldKindIdentifier | undefined,
        public readonly fieldSchemaIdentifiers: ReadonlySet<TreeSchemaIdentifier>
    ) { }

    get typeArray(): TreeSchemaIdentifier[] {
        return [...this.fieldSchemaIdentifiers];
    }

    public equals(other: PathElem): boolean {
        return this.fieldKey === other.fieldKey;
    }
}

export class Path {
    protected readonly content: PathElem[] = [];
    get length(): number {
        return this.content.length;
    }
    push(pathElem: PathElem): Path {
        this.content.push(pathElem);
        return this;
    }
    get(index: number): PathElem {
        return this.content[index];
    }
    pop(): void {
        this.content.pop();
    }
    last(): PathElem {
        return this.content[this.content.length - 1];
    }
    public equals(other: Path): boolean {
        if (this.length !== other.length)
            return false;

        for (let i = 0; i < this.content.length; i++) {
            const localElem: PathElem = this.content[i];
            const otherElem: PathElem = other.get(i);
            if (!localElem.equals(otherElem))
                return false;
        }
        return true;
    }
    toExpr(): string {
        return this.content.map(pathElem => {
            const typeExpr = `[${pathElem.typeArray.join(',')}]`;
            return `${pathElem.fieldKey}:${typeExpr}`;
        }).join('.');
    }
}

enum Mode {
    Node = 1,
    Field = 2,
}

export abstract class PathVisitor implements DeltaVisitor {
    protected readonly path: Path = new Path();
    protected mode: Mode | undefined;
    constructor(
        protected readonly schemaData: SchemaData,
        protected readonly schemaIdentifiers: ReadonlySet<TreeSchemaIdentifier>
    ) {
        this.mode = undefined;
    }
    currentSchemaIdentifiers(): ReadonlySet<TreeSchemaIdentifier> {
        return this.path.length === 0 ?
            this.schemaIdentifiers : this.path.last().fieldSchemaIdentifiers;
    }
    onDelete(index: number, count: number): void { console.log('onDelete', index, count); }
    onInsert(index: number, content: readonly Delta.ProtoNode[]): void { console.log('onInsert abstract'); }
    onMoveOut(index: number, count: number, id: Delta.MoveId): void { console.log('onMoveOut', index, count); }
    onMoveIn(index: number, count: number, id: Delta.MoveId): void { console.log('onMoveIn', index, count); }
    onSetValue(value: Value): void { console.log('onSetValue', value); }
    enterNode(index: number): void { this.mode = Mode.Node; }
    exitNode(index: number): void { this.mode = undefined; }
    enterField(fieldKey: FieldKey): void {
        this.mode = Mode.Field;
        if (isLocalKey(fieldKey)) {
            const currentIdentifiers: ReadonlySet<TreeSchemaIdentifier> = this.currentSchemaIdentifiers();
            let localFieldSchema: FieldSchema | undefined;
            for (const currentIdentifier of currentIdentifiers) {
                const currentNamedTreeSchema: NamedTreeSchema = this.schemaData.treeSchema
                    .get(currentIdentifier)! as NamedTreeSchema;
                localFieldSchema = currentNamedTreeSchema.localFields.get(fieldKey);
                if (localFieldSchema !== undefined) {
                    break;
                }
            }
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const fieldSchemaIdentifiers = localFieldSchema.types!;
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const fieldKindIdentifier = localFieldSchema.kind;
            this.path.push(new PathElem(fieldKey, fieldKindIdentifier, fieldSchemaIdentifiers));
        } else if (isGlobalFieldKey(fieldKey) && fieldKey === rootFieldKeySymbol) {
            //
        }
    }
    exitField(fieldKey: FieldKey): void {
        if (isLocalKey(fieldKey)) {
            this.path.pop();
        } else if (isGlobalFieldKey(fieldKey) && fieldKey === rootFieldKeySymbol) {
            //
        }
        this.mode = undefined;
    }
}

export class InsertVisitor extends PathVisitor {

    constructor(
        protected readonly schemaData: SchemaData,
        protected readonly filter: Path,
        protected readonly schemaIdentifiers: ReadonlySet<TreeSchemaIdentifier>,
        protected readonly callback: (
            path: Path,
            index: number,
            jsonArray: JsonableTree[]
        ) => void) {
        super(schemaData, schemaIdentifiers);
    }
    onInsert(index: number, content: readonly Delta.ProtoNode[]): void {
        if (this.filter.equals(this.path)) {
            const jsonArray: JsonableTree[] = [];
            for (const node of content) {
                jsonArray.push(jsonableTreeFromCursor(node));
            }
            this.callback(this.path, index, jsonArray);
        }
    }
}


enum Operation {
    Insert = 1, Delete = 2, Set = 3
}

export default function App() {
    const [rollToggle, setRollToggle] = useState<boolean>(false);
    const [workspace, setWorkspace] = useState<Workspace>();
    const [drawValues, setDrawValues] = useState<number[][]>([
        [-1, -1, -1, -1, -1],
        [-1, -1, -1, -1, -1],
        [-1, -1, -1, -1, -1]
    ]);
    const containerId = window.location.hash.substring(1) || undefined;
    useEffect(() => {
        async function initWorkspace() {
            const myWorkspace = await initializeWorkspace(containerId);
            // Update location
            if (myWorkspace.containerId) {
                window.location.hash = myWorkspace.containerId;
            }
            // save workspace to react state
            setWorkspace(myWorkspace);
            myWorkspace.tree.storedSchema.update(appSchema);
            myWorkspace.tree.on("op", (event) => {
                setDrawValues(readDrawValues(myWorkspace));
            });
            myWorkspace.tree.on("error", (event) => {
                console.log(event);
                console.log("Tree error received!");
            });

            const listenPath = buildSchemaPath([drawKeys, valueKeys], appSchema);

            registerDomainPath(
                myWorkspace,
                listenPath,
                Operation.Insert,
                (
                    index: number,
                    values: Int32[]
                ) => {
                    console.log(`Callback on inserting domain ${values.length} values at index ${index}`);
                    for (const value of values) {
                        if (value !== undefined) {
                            console.log(`Callback on inserting domain value ${value[valueSymbol]} type ${value[typeNameSymbol]}`);
                        }
                    }
                });

            insertDrawValues(myWorkspace);
        }
        initWorkspace();
    }, []);

    useEffect(() => {
        if (rollToggle) {
            many();
        }
    }, [drawValues, rollToggle]);

    const many = () => {
        updateDrawValues(workspace!);
    };

    const single = () => {
        updateSingleValue(workspace!);
    };

    const toggleRolling = () => {
        setRollToggle(!rollToggle);
    };

    const registerDomainPath = (
        w: Workspace,
        filter: Path,
        op: Operation,
        domainCallback: (index: number, diceValues: Int32[]) => void,
    ) => {
        registerPath(w, filter, op, (path: Path,
            index: number,
            jsonArray: JsonableTree[]): void => {
            console.log('Callback on Operation.Insert yielding to', path.toExpr(), index);
            const values: Int32[] = jsonArray.map(json => typedInt32(json));
            domainCallback(index, values);
        });
    };

    const registerPath = (w: Workspace, filter: Path, op: Operation, callback: (
        path: Path,
        index: number,
        jsonArray: JsonableTree[]
    ) => void) => {

        w.tree.context.on("afterDelta", (delta: Delta.Root) => {
            switch (op) {
                case Operation.Insert:
                    visitDelta(delta, new InsertVisitor(
                        appSchema,
                        filter,
                        new Set([drawSchema.name]),
                        callback));
                    break;
                default:
                    console.log('op', op);
                    throw new Error('Bad op');
            }
        });
    };

    return (
        <div className="App">
            <div className="dices">
                {
                    drawValues.map((values: number[], i: number) => <div className="dice" key={i}>{
                        values.map((value: number, j: number) => <span className="dice" key={j + j ** i}> {value}</span>)
                    }</div>)
                }
            </div>
            <div className="commit" onClick={() => many()}>
                Many
            </div>
            <div className="commit" onClick={() => single()}>
                One
            </div>
        </div>
    );
}

function buildSchemaPath(fields: LocalFieldKey[], schema: SchemaData): Path {
    const rootSchemaIdentifiers = schema.globalFieldSchema.get(rootFieldKey)?.types;
    let nextSchemaIdentifiers = rootSchemaIdentifiers;
    const out = new Path();
    label: for (const field of fields) {
        let found = false;
        if (nextSchemaIdentifiers !== undefined) {
            const nextSchemaIdentifiersExist = nextSchemaIdentifiers as ReadonlySet<TreeSchemaIdentifier>;
            for (const nextSchemaIdentifier of nextSchemaIdentifiersExist) {
                const treeSchema: TreeSchema | undefined = schema.treeSchema.get(nextSchemaIdentifier);
                if (treeSchema !== undefined) {
                    const localFieldSchema: FieldSchema | undefined = treeSchema.localFields.get(field);
                    if (localFieldSchema !== undefined) {
                        out.push(new PathElem(field, undefined, nextSchemaIdentifiersExist));
                        nextSchemaIdentifiers = localFieldSchema?.types;
                        found = true;
                        continue label;
                    }
                }
            }
        }
        if (!found) throw new Error(`Path error, field ${field} not found`);
    }
    return out;
}

function typedInt32(json: JsonableTree): Int32 {
    return {
        [valueSymbol]: json.value,
        [typeNameSymbol]: int32Schema.name,
    } as unknown as Int32;
}

// ContextuallyTypedNodeData
function drawData(): Draw {
    const draws: Dice[] = [];
    for (let i = 0; i < 3; i++) {
        const dice: Dice = diceData();
        draws.push(dice);
    }
    return {
        [typeNameSymbol]: drawSchema.name,
        [drawKeys]: draws,
    } as unknown as Draw;
}

function diceData(): Dice {
    const dices: Int32[] = int32Data();
    return {
        [typeNameSymbol]: diceSchema.name,
        [valueKeys]: dices,
    } as unknown as Dice;
}

function int32Data() {
    const int32Array: Int32[] = [];
    for (let i = 0; i < 5; i++) {
        const newValue = rnd(100, 999);
        int32Array.push({
            [valueSymbol]: newValue,
            [typeNameSymbol]: int32Schema.name,
        } as unknown as Int32);
    }
    return int32Array;
}

function rnd(min: number, max: number) {
    return Math.floor(Math.random() * (max - min)) + min;
}

function insertDrawValues(workspace: Workspace) {
    const data: Draw = drawData();
    const tree = workspace.tree;
    tree.root = data;
}

function updateDrawValues(workspace: Workspace) {
    console.log(`updateManyValues called`);
    const tree = workspace.tree;
    const draw: Draw = tree.root as Draw;
    // draw.drawKeys[0].valueKeys = int32Data();
    // draw.drawKeys[1].valueKeys = int32Data();
    draw.drawKeys[2].valueKeys = int32Data();
}

function updateSingleValue(workspace: Workspace) {
    console.log(`updateSingleValue called`);
    const tree = workspace.tree;
    const draw: Draw = tree.root as Draw;
    draw.drawKeys[2].valueKeys[3] = {
        [valueSymbol]: rnd(100, 999),
        [typeNameSymbol]: int32Schema.name,
    } as unknown as Int32;
}

function readDrawValues(
    workspace: Workspace,
): number[][] {
    const tree = workspace.tree;
    const draw: Draw = tree.root as Draw;
    const dices: number[][] = [];
    for (const dice of draw.drawKeys) {
        const values: number[] = [];
        for (const value of dice.valueKeys) {
            values.push(value);
        }
        dices.push(values);
    }
    return dices;
}
