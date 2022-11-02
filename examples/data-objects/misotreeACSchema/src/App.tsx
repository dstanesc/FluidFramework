/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable prefer-template */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable import/no-default-export */
/* eslint-disable import/no-internal-modules */
/* eslint-disable import/no-unassigned-import */
/* eslint-disable @typescript-eslint/no-floating-promises */

import {
    brand,
    FieldChangeMap,
    IForestSubscription,
    ITreeSubscriptionCursor,
    SchemaData,
    SharedTree,
    TransactionResult,
    TreeNavigationResult,
} from "@fluid-internal/tree";
import {
    DefaultChangeFamily,
    DefaultEditBuilder,
    emptyField,
    FieldKinds,
    singleTextCursor,
} from "@fluid-internal/tree/dist/feature-libraries";
import {
    fieldSchema,
    namedTreeSchema,
    ValueSchema,
} from "@fluid-internal/tree/dist/schema-stored";
import { SharedTreeCore } from "@fluid-internal/tree/dist/shared-tree-core";
import { detachedFieldAsKey, FieldKey } from "@fluid-internal/tree/dist/tree";
import React, { useState, useEffect } from "react";
import "./App.css";
import { initializeWorkspace, Workspace } from "./tracking/workspace2";

const cellKey: FieldKey = brand("cell");
const rowKey: FieldKey = brand("row");

const oneCellSchema = namedTreeSchema({
    name: brand("OneCellSchema"),
    value: ValueSchema.Number,
    extraLocalFields: emptyField,
});
const oneRowSchema = namedTreeSchema({
    name: brand("OneRowSchema"),
    localFields: {
        [cellKey]: fieldSchema(FieldKinds.sequence, [oneCellSchema.name]),
    },
    extraLocalFields: emptyField,
});
const oneTableSchema = namedTreeSchema({
    name: brand("OneTableSchema"),
    localFields: {
        [rowKey]: fieldSchema(FieldKinds.sequence, [oneRowSchema.name]),
    },
    extraLocalFields: emptyField,
});
const tableSchema: SchemaData = {
    treeSchema: new Map([[oneTableSchema.name, oneTableSchema]]),
    globalFieldSchema: new Map(),
};

const tableRows = 24;
const tableCols = 36;
function genInitialTable() {
    const cells: any[] = [];
    const rows: any[] = [];
    for (let i = 0; i < tableCols; i++) {
        cells.push({
            type: oneCellSchema.name,
            value: 0,
        });
    }
    for (let i = 0; i < tableRows; i++) {
        rows.push({
            type: oneRowSchema.name,
            fields: {
                [cellKey]: cells,
            },
        });
    }
    const myTable = {
        type: oneTableSchema.name,
        fields: {
            [rowKey]: rows,
        },
    };
    return myTable;
}

const initialTable = genInitialTable();

function getColor(value: number): string {
    const modulo = value % 10;
    switch (modulo) {
        case 0: {
            return "grey";
            break;
        }
        case 1: {
            return "blue";
            break;
        }
        case 2: {
            return "red";
            break;
        }
        case 3: {
            return "yellow";
            break;
        }
        case 4: {
            return "darkcyan";
            break;
        }
        case 5: {
            return "firebrick";
            break;
        }
        case 6: {
            return "orange";
            break;
        }
        case 7: {
            return "purple";
            break;
        }
        case 8: {
            return "magenta";
            break;
        }
        case 9: {
            return "cyan";
            break;
        }
        default: {
            return "black";
            break;
        }
    }
}

function initSchema(workspace) {
    const tree = workspace.tree as SharedTree;
    const rootAnchor = tree.rootAnchor();
    const colsNr = readColsNumber(workspace);
    const cells: any[] = [];
    for (let i = 0; i < colsNr; i++) {
        cells.push({
            type: oneCellSchema.name,
            value: 0,
        });
    }
    tree.runTransaction((forest, editor) => {
        tree.context.prepareForEdit();
        const field = editor.sequenceField(tree.locate(rootAnchor!), rowKey);
        const writeCursor = singleTextCursor({
            type: oneRowSchema.name,
            fields: {
                [cellKey]: cells,
            },
        });
        const nrRows = readRowsNumber(workspace);
        field.insert(nrRows, writeCursor);
        return TransactionResult.Apply;
    });
}

export default function App() {
    const [workspace, setWorkspace] = useState<Workspace>();
    const [, setIsRender] = useState<number>(0);
    // const [myValue, setMyValue] = useState<number>(0);
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
            myWorkspace.tree.storedSchema.update(tableSchema);
            myWorkspace.tree.on("pre-op", (event) => {
                // console.log(typeof event);
                // console.log("Tree pre-op received!");
            });
            myWorkspace.tree.on("op", (event) => {
                console.log(typeof event);
                console.log("Tree op received!");
                reRender(setIsRender);
            });
            myWorkspace.tree.on("error", (event) => {
                // console.log(typeof event);
                // console.log("Tree error received!");
            });
            (
                myWorkspace.tree as unknown as SharedTreeCore<
                    FieldChangeMap,
                    DefaultChangeFamily
                >
            ).on("updated", (event) => {
                // console.log(typeof event);
                // console.log("Tree updated received!");
            });
            (
                myWorkspace.tree as unknown as SharedTreeCore<
                    FieldChangeMap,
                    DefaultChangeFamily
                >
            ).on("valueChanged", (event) => {
                // console.log(typeof event);
                // console.log("Tree value changed received!");
            });
        }
        initWorkspace();
        setIsRender(0);
    }, []);
    return (
        <div className="App">
            <h1>Shared Tree Table</h1>
            <button
                onClick={() => {
                    workspace!.tree.runTransaction((f, editor) => {
                        const writeCursor = singleTextCursor(initialTable);
                        const field = editor.sequenceField(
                            undefined,
                            detachedFieldAsKey(f.rootField),
                        );
                        field.insert(0, writeCursor);
                        return TransactionResult.Apply;
                    });
                    reRender(setIsRender);
                }}
            >
                INIT SCHEMA
            </button>
            <button
                onClick={() => {
                    initSchema(workspace);
                    reRender(setIsRender);
                }}
            >
                ADD ROW
            </button>
            <button
                onClick={() => {
                    const mywrk = workspace!;
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    const tree = mywrk.tree! as SharedTree;
                    const myRoot = tree.root!;
                    const rowNodes: any[] = myRoot[rowKey];
                    const colsNr = readColsNumber(workspace);
                    tree.runTransaction((forest, editor) => {
                        rowNodes.forEach((rowNode) => {
                            const rowAnchor = rowNode[tree.getAnchorSymbol()];
                            tree.context.prepareForEdit();
                            const field = editor.sequenceField(
                                tree.locate(rowAnchor),
                                cellKey,
                            );
                            const writeCursor = singleTextCursor({
                                type: oneCellSchema.name,
                                value: 0,
                            });
                            field.insert(colsNr, writeCursor);
                        });
                        return TransactionResult.Apply;
                    });
                    reRender(setIsRender);
                }}
            >
                ADD COLUMN
            </button>
            <button
                onClick={() => {
                    plus100AllOneByOne(workspace!);
                    reRender(setIsRender);
                }}
            >
                PLUS 100 (multi-tx)
            </button>
            <button
                onClick={() => {
                    setCellValueDelAdd(workspace, 2, 2, 5);
                    console.log("CELL VALUE");
                    console.log(readCellValue(workspace, 2, 2));
                }}
            >
                DEBUG
            </button>
            <br></br>
            <br></br>
            <table className="mtable">
                <tbody>{renderRows(workspace)}</tbody>
            </table>
            <br></br>
        </div>
    );
}

function readCellValue(
    workspace: Workspace | undefined,
    row: number,
    col: number,
): number {
    if (workspace === undefined) {
        return -1;
    }
    let numvalue = -1;
    const { forest, readCursor } = openReadCursor(workspace);
    try {
        const destination = forest.root(forest.rootField);
        const moveResult = forest.tryMoveCursorTo(destination, readCursor);
        if (moveResult === TreeNavigationResult.Ok) {
            readCursor.enterField(rowKey);
            if (readCursor.firstNode()) {
                if (readCursor.seekNodes(row)) {
                    readCursor.enterField(cellKey);
                    if (readCursor.firstNode()) {
                        if (readCursor.seekNodes(col)) {
                            const strvalue: string =
                                readCursor.value! as string;
                            numvalue = Number(strvalue);
                        }
                    }
                }
            }
        }
    } finally {
        readCursor.free();
    }
    return numvalue;
}
/*
function setCellValueDirect(
    workspace: Workspace | undefined,
    row: number,
    col: number,
    val: number,
) {
    if (workspace === undefined) {
        return -1;
    }
    const tree = workspace.tree as SharedTree;
    const myRoot = tree.root!;
    const rowNodes: any[] = myRoot[rowKey];
    const rowNode = rowNodes[row];
    const cellNodes: any[] = rowNode[cellKey];
    const cellNode = cellNodes[col];
    const cellAnchor = cellNode[tree.getAnchorSymbol()];
    tree.runTransaction((forest, editor) => {
        tree.context.prepareForEdit();
        const field = editor.valueField(tree.locate(cellAnchor), cellKey);
        const writeCursor = singleTextCursor({
            type: oneCellSchema.name,
            value: 22,
        });
        field.set(writeCursor);
        return TransactionResult.Apply;
    });
}
*/

function setCellValueDelAdd(
    workspace: Workspace | undefined,
    row: number,
    col: number,
    val: number,
) {
    if (workspace === undefined) {
        return -1;
    }
    const tree = workspace.tree as SharedTree;
    const myRoot = tree.root!;
    const rowNodes: any[] = myRoot[rowKey];
    const rowNode = rowNodes[row];
    const rowAnchor = rowNode[tree.getAnchorSymbol()];
    tree.runTransaction((forest, editor) => {
        tree.context.prepareForEdit();
        const field = editor.sequenceField(tree.locate(rowAnchor), cellKey);
        const writeCursor = singleTextCursor({
            type: oneCellSchema.name,
            value: val,
        });
        field.delete(col, 1);
        field.insert(col, writeCursor);
        return TransactionResult.Apply;
    });
}

function setCellValueDelAddInTx(
    workspace: Workspace | undefined,
    row: number,
    col: number,
    val: number,
    editor: DefaultEditBuilder,
) {
    if (workspace === undefined) {
        return -1;
    }
    const tree = workspace.tree as SharedTree;
    const myRoot = tree.root!;
    const rowNodes: any[] = myRoot[rowKey];
    const rowNode = rowNodes[row];
    const rowAnchor = rowNode[tree.getAnchorSymbol()];
    tree.context.prepareForEdit();
    const field = editor.sequenceField(tree.locate(rowAnchor), cellKey);
    const writeCursor = singleTextCursor({
        type: oneCellSchema.name,
        value: val,
    });
    field.delete(col, 1);
    field.insert(col, writeCursor);
    return TransactionResult.Apply;
}

function readRowsNumber(workspace: Workspace | undefined): number {
    if (workspace === undefined) {
        return -1;
    }
    let nrRows = 0;
    const { forest, readCursor } = openReadCursor(workspace);
    try {
        const destination = forest.root(forest.rootField);
        const moveResult = forest.tryMoveCursorTo(destination, readCursor);
        if (moveResult === TreeNavigationResult.Ok) {
            readCursor.enterField(rowKey);
            if (readCursor.firstNode()) {
                nrRows++;
                while (readCursor.nextNode()) {
                    nrRows++;
                }
            }
        }
    } finally {
        readCursor.free();
    }
    return nrRows;
}

function readColsNumber(workspace: Workspace | undefined): number {
    if (workspace === undefined) {
        return -1;
    }
    let nrCols = 0;
    const { forest, readCursor } = openReadCursor(workspace);
    try {
        const destination = forest.root(forest.rootField);
        const moveResult = forest.tryMoveCursorTo(destination, readCursor);
        if (moveResult === TreeNavigationResult.Ok) {
            readCursor.enterField(rowKey);
            if (readCursor.firstNode()) {
                readCursor.enterField(cellKey);
                if (readCursor.firstNode()) {
                    nrCols++;
                    while (readCursor.nextNode()) {
                        nrCols++;
                    }
                }
            }
        }
    } finally {
        readCursor.free();
    }
    return nrCols;
}

function openReadCursor(workspace: Workspace): {
    forest: IForestSubscription;
    readCursor: ITreeSubscriptionCursor;
} {
    const tree = workspace.tree as SharedTree;
    const { forest } = tree;
    const readCursor = forest.allocateCursor();
    return { forest, readCursor };
}

function renderRows(workspace: Workspace | undefined) {
    const reactElem: any[] = [];
    if (workspace === undefined) {
        return reactElem;
    }
    const { forest, readCursor } = openReadCursor(workspace);
    try {
        const destination = forest.root(forest.rootField);
        const moveResult = forest.tryMoveCursorTo(destination, readCursor);
        if (moveResult === TreeNavigationResult.Ok) {
            readCursor.enterField(rowKey);
            let row = 0;
            if (readCursor.firstNode()) {
                reactElem.push(renderRow(workspace, readCursor, row));
                readCursor.exitField();
                while (readCursor.nextNode()) {
                    row++;
                    reactElem.push(renderRow(workspace, readCursor, row));
                    readCursor.exitField();
                }
                reactElem.push(renderVerticalPlusRow(workspace));
            }
        }
    } finally {
        readCursor.free();
    }
    console.log("Table Rendered " + reactElem.length);
    return reactElem;
}

function renderRow(
    workspace: Workspace,
    readCursor: ITreeSubscriptionCursor,
    row: number,
) {
    const reactElem: any[] = [];
    reactElem.push(renderCells(workspace, readCursor, row));
    const rowElem = <tr>{reactElem}</tr>;
    return rowElem;
}

function renderCells(
    workspace: Workspace,
    readCursor: ITreeSubscriptionCursor,
    row: number,
) {
    const reactElem: any[] = [];
    readCursor.enterField(cellKey);
    if (readCursor.firstNode()) {
        let col = 0;
        reactElem.push(renderCell(workspace, readCursor, row, col));
        while (readCursor.nextNode()) {
            col++;
            reactElem.push(renderCell(workspace, readCursor, row, col));
        }
        reactElem.push(renderHorizontalPlusCell(workspace, row));
    }
    return reactElem;
}

function renderCell(
    workspace: Workspace,
    readCursor: ITreeSubscriptionCursor,
    row: number,
    col: number,
) {
    const reactElem: any[] = [];
    const strvalue: string = readCursor.value! as string;
    const numvalue: number = Number(strvalue);
    reactElem.push(
        <td
            style={{
                borderWidth: "6px",
                borderColor: getColor(numvalue),
                borderStyle: "solid",
                fontSize: "20px",
            }}
            className="mcell"
            onClick={() => {
                setCellValueDelAdd(workspace, row, col, numvalue + 1);
            }}
        >
            {strvalue}
        </td>,
    );
    return reactElem;
}

function renderHorizontalPlusCell(workspace: Workspace, row: number) {
    const reactElem: any[] = [];
    const colsNr = readColsNumber(workspace);
    reactElem.push(
        <td
            className="mpluscell"
            onClick={() => {
                workspace.tree.runTransaction((_forest, editor) => {
                    for (let i = 0; i < colsNr; i++) {
                        const numvalue = readCellValue(workspace, row, i);
                        setCellValueDelAddInTx(workspace, row, i, numvalue + 1, editor);
                    }
                    return TransactionResult.Apply;
                });
            }}
        >
            {"+"}
        </td>,
    );
    return reactElem;
}
function renderVerticalPlusRow(workspace: Workspace) {
    const reactElem: any[] = [];
    reactElem.push(<tr>{renderVerticalPlusCells(workspace)}</tr>);
    return reactElem;
}

function renderVerticalPlusCells(workspace: Workspace) {
    const reactElem: any[] = [];
    const rowsNr = readRowsNumber(workspace);
    const colsNr = readColsNumber(workspace);
    for (let col = 0; col < colsNr; col++) {
        reactElem.push(
            <td
                className="mpluscell"
                onClick={() => {
                    workspace.tree.runTransaction((_forest, editor) => {
                        for (let i = 0; i < rowsNr; i++) {
                            const numvalue = readCellValue(workspace, i, col);
                            setCellValueDelAddInTx(workspace, i, col, numvalue + 1, editor);
                        }
                        return TransactionResult.Apply;
                    });
                }}
            >
                {"+"}
            </td>,
        );
    }
    reactElem.push(renderAllPlusCell(workspace));
    return reactElem;
}

function renderAllPlusCell(workspace: Workspace) {
    const reactElem: any[] = [];
    const rowsNr = readRowsNumber(workspace);
    const colsNr = readColsNumber(workspace);
    reactElem.push(
        <td
            className="mpluscell"
            onClick={() => {
                workspace.tree.runTransaction((_forest, editor) => {
                    for (let i = 0; i < rowsNr; i++) {
                        for (let j = 0; j < colsNr; j++) {
                            const numvalue = readCellValue(workspace, i, j);
                            setCellValueDelAddInTx(workspace, i, j, numvalue + 1, editor);
                        }
                    }
                    return TransactionResult.Apply;
                });
            }}
        >
            {"+"}
        </td>,
    );
    return reactElem;
}

function plus100AllOneByOne(workspace: Workspace) {
    const rowsNr = readRowsNumber(workspace);
    const colsNr = readColsNumber(workspace);
    for (let k = 0; k < 100; k++) {
        for (let i = 0; i < rowsNr; i++) {
            for (let j = 0; j < colsNr; j++) {
                const numvalue = readCellValue(workspace, i, j);
                setCellValueDelAdd(workspace, i, j, numvalue + 1);
            }
        }
    }
}

function reRender(setIsRender) {
    setIsRender(2000000000 * Math.random());
}
