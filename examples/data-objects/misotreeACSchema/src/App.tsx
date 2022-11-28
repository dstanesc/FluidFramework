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
    IForestSubscription,
    ITreeSubscriptionCursor,
    SchemaData,
    SharedTree,
    TransactionResult,
    emptyField,
    FieldKinds,
    singleTextCursor,
    IDefaultEditBuilder,
    FieldKey,
    checkRootSymbol,
    checkSymbol,
    michaelo,
    misoSymbol,
    rootFieldKeySymbol,
    fieldSchema,
    namedTreeSchema,
    ValueSchema,
    moveToDetachedField,
} from "@fluid-internal/tree";
import React, { useState, useEffect } from "react";
import "./App.css";
import { initializeWorkspace, Workspace } from "./tracking/workspace2";

const cellKey: FieldKey = brand("cell");
const rowKey: FieldKey = brand("row");
const cellValueKey: FieldKey = brand("cellValue");

const oneCellValueSchema = namedTreeSchema({
    name: brand("OneCellValueSchema"),
    value: ValueSchema.Number,
    extraLocalFields: emptyField,
});

const oneCellSchema = namedTreeSchema({
    name: brand("OneCellSchema"),
    localFields: {
        [cellValueKey]: fieldSchema(FieldKinds.value, [
            oneCellValueSchema.name,
        ]),
    },
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
    treeSchema: new Map([
        [oneTableSchema.name, oneTableSchema],
        [oneRowSchema.name, oneRowSchema],
        [oneCellSchema.name, oneCellSchema],
        [oneCellValueSchema.name, oneCellValueSchema],
    ]),
    globalFieldSchema: new Map(),
};

const tableRows = 8;
const tableCols = 12;
/*
function addRow(workspace) {
    const tree = workspace.tree as SharedTree;
    const rootAnchor = tree.rootAnchor();
    const colsNr = readColsNumber(workspace);

    const cellValues: any[] = [];
    for (let i = 0; i < colsNr; i++) {
        cellValues.push({
            type: oneCellValueSchema.name,
            value: 0,
        });
    }
    const cells: any[] = [];
    for (let i = 0; i < colsNr; i++) {
        cells.push({
            type: oneCellSchema.name,
            fields: {
                [cellValueKey]: [cellValues[i]],
            },
        });
    }
    tree.runTransaction((forest, editor) => {
        tree.context.prepareForEdit();
        const field = editor.sequenceField(tree.locate(rootAnchor!), rowKey);
        const myRow = {
            type: oneRowSchema.name,
            fields: {
                [cellKey]: cells,
            },
        };
        const writeCursor = singleTextCursor(myRow);
        console.log(myRow);
        const nrRows = readRowsNumber(workspace);
        field.insert(nrRows, writeCursor);
        return TransactionResult.Apply;
    });
}
*/

function genInitialTable() {
    const cellValues: any[] = [];
    const cells: any[] = [];
    const rows: any[] = [];
    for (let i = 0; i < tableCols; i++) {
        cellValues.push({
            type: oneCellValueSchema.name,
            value: 0,
        });
    }
    for (let i = 0; i < tableCols; i++) {
        cells.push({
            type: oneCellSchema.name,
            fields: {
                [cellValueKey]: [cellValues[i]],
            },
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
        }
        case 1: {
            return "blue";
        }
        case 2: {
            return "red";
        }
        case 3: {
            return "yellow";
        }
        case 4: {
            return "darkcyan";
        }
        case 5: {
            return "firebrick";
        }
        case 6: {
            return "orange";
        }
        case 7: {
            return "purple";
        }
        case 8: {
            return "magenta";
        }
        case 9: {
            return "cyan";
        }
        default: {
            return "black";
        }
    }
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
        }
        initWorkspace();
        setIsRender(0);
    }, []);
    return (
        <div className="App">
            <h1>Shared Tree Table</h1>
            <button
                onClick={() => {
                    console.log(checkSymbol(misoSymbol));
                    console.log(checkSymbol(workspace!.tree.getMisoSymbol()));
                    console.log(checkRootSymbol(rootFieldKeySymbol));
                    console.log(
                        checkRootSymbol(workspace!.tree.getRootFieldKeySymbol())
                    );
                    console.log(michaelo);
                    console.log(workspace!.tree.getMichaelo());
                    const tree = workspace!.tree;
                    const forest2 = tree.forest;
                    tree.runTransaction((forest, editor) => {
                        const writeCursor = singleTextCursor({
                            type: brand("LonelyNode"),
                        });
                        const field = editor.sequenceField(
                            undefined,
                            tree.getRootFieldKeySymbol()
                        );
                        field.insert(0, writeCursor);
                        return TransactionResult.Apply;
                    });
                    const readCursor = forest2.allocateCursor();
                    moveToDetachedField(forest2, readCursor);
                    console.log("First Read");
                    console.log(readCursor.firstNode());
                    readCursor.free();
                    console.log(initialTable);
                    reRender(setIsRender);
                }}
            >
                HACK
            </button>
            <button
                onClick={() => {
                    const tree = workspace!.tree;
                    const forest2 = tree.forest;
                    /*
                    tree.runTransaction((forest, editor) => {
                        const writeCursor = singleTextCursor({ type: brand("LonelyNode") });
                        const field = editor.sequenceField(undefined, tree.getRootFieldKeySymbol());
                        field.insert(0, writeCursor);
                        return TransactionResult.Apply;
                    });
                    const readCursor = forest2.allocateCursor();
                    moveToDetachedField(forest2, readCursor);
                    console.log("First Read");
                    console.log(readCursor.firstNode());
                    readCursor.free();
                    console.log(initialTable);
*/
                    console.log("initialTable");
                    console.log(initialTable);
                    tree.runTransaction((forest, editor) => {
                        const writeCursor = singleTextCursor(initialTable);
                        const rootField = editor.sequenceField(
                            undefined,
                            workspace!.tree.getRootFieldKeySymbol()
                        );
                        rootField.insert(0, writeCursor);
                        return TransactionResult.Apply;
                    });
                    const readCursor = forest2.allocateCursor();
                    moveToDetachedField(forest2, readCursor);
                    console.log("First Read");
                    console.log(readCursor.firstNode());
                    readCursor.free();
                    reRender(setIsRender);
                }}
            >
                INIT SCHEMA
            </button>
            <button
                onClick={() => {
                    // addRow(workspace);
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
                            const rowAnchor: any = ""; // = rowNode[tree.getAnchorSymbol()];
                            tree.context.prepareForEdit();
                            const field = editor.sequenceField(
                                tree.locate(rowAnchor),
                                cellKey
                            );
                            const writeCursor = singleTextCursor({
                                type: oneCellSchema.name,
                                fields: {
                                    [cellValueKey]: [
                                        {
                                            type: oneCellValueSchema.name,
                                            value: 0,
                                        },
                                    ],
                                },
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
    col: number
): number {
    if (workspace === undefined) {
        return -1;
    }
    let numvalue = -1;
    const { forest, readCursor } = openReadCursor(workspace);
    try {
        moveToDetachedField(forest, readCursor);
        readCursor.firstNode();
        readCursor.enterField(rowKey);
        if (readCursor.firstNode()) {
            if (readCursor.seekNodes(row)) {
                readCursor.enterField(cellKey);
                if (readCursor.firstNode()) {
                    if (readCursor.seekNodes(col)) {
                        readCursor.enterField(cellValueKey);
                        if (readCursor.firstNode()) {
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

function setCellValueDelAdd(
    workspace: Workspace | undefined,
    row: number,
    col: number,
    val: number
) {
    if (workspace === undefined) {
        return -1;
    }
    const tree = workspace.tree as SharedTree;
    tree.runTransaction((forest, editor) => {
        tree.context.prepareForEdit();

        // const rootField = editor.sequenceField(undefined, rootFieldKeySymbol);
        const rootPath = {
            parent: undefined,
            parentField: tree.getRootFieldKeySymbol(),
            parentIndex: 0,
        };
        // const rowField = editor.sequenceField(rootPath, rowKey);
        const rowPath = {
            parent: rootPath,
            parentField: rowKey,
            parentIndex: row,
        };
        // const cellField = editor.sequenceField(rowPath, cellKey);
        const cellPath = {
            parent: rowPath,
            parentField: cellKey,
            parentIndex: col,
        };
        const cellValueField = editor.valueField(cellPath, cellValueKey);

        const writeCursor = singleTextCursor({
            type: oneCellSchema.name,
            value: val,
        });
        cellValueField.set(writeCursor);
        return TransactionResult.Apply;
    });
}

function setCellValueDelAddInTx(
    workspace: Workspace | undefined,
    row: number,
    col: number,
    val: number,
    editor: IDefaultEditBuilder
) {
    if (workspace === undefined) {
        return -1;
    }
    const tree = workspace.tree as SharedTree;
    //   const cellNode = cellNodes[col];
    tree.context.prepareForEdit();

    // const rootField = editor.sequenceField(undefined, rootFieldKeySymbol);
    const rootPath = {
        parent: undefined,
        parentField: tree.getRootFieldKeySymbol(),
        parentIndex: 0,
    };
    // const rowField = editor.sequenceField(rootPath, rowKey);
    const rowPath = {
        parent: rootPath,
        parentField: rowKey,
        parentIndex: row,
    };
    // const cellField = editor.sequenceField(rowPath, cellKey);
    const cellPath = {
        parent: rowPath,
        parentField: cellKey,
        parentIndex: col,
    };
    const cellValueField = editor.valueField(cellPath, cellValueKey);

    const writeCursor = singleTextCursor({
        type: oneCellSchema.name,
        value: val,
    });
    cellValueField.set(writeCursor);
}

function readRowsNumber(workspace: Workspace | undefined): number {
    if (workspace === undefined) {
        return -1;
    }
    let nrRows = 0;
    const { forest, readCursor } = openReadCursor(workspace);
    try {
        moveToDetachedField(forest, readCursor);
        readCursor.firstNode();
        readCursor.enterField(rowKey);
        if (readCursor.firstNode()) {
            nrRows++;
            while (readCursor.nextNode()) {
                nrRows++;
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
        moveToDetachedField(forest, readCursor);
        readCursor.firstNode();
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
        moveToDetachedField(forest, readCursor);
        if (!readCursor.firstNode()) {
            return reactElem;
        }
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
    } finally {
        readCursor.free();
    }
    console.log("Table Rendered " + reactElem.length);
    return reactElem;
}

function renderRow(
    workspace: Workspace,
    readCursor: ITreeSubscriptionCursor,
    row: number
) {
    const reactElem: any[] = [];
    reactElem.push(renderCells(workspace, readCursor, row));
    const rowElem = <tr>{reactElem}</tr>;
    return rowElem;
}

function renderCells(
    workspace: Workspace,
    readCursor: ITreeSubscriptionCursor,
    row: number
) {
    const reactElem: any[] = [];
    readCursor.enterField(cellKey);
    if (readCursor.firstNode()) {
        let col = 0;
        readCursor.enterField(cellValueKey);
        readCursor.firstNode();
        reactElem.push(renderCell(workspace, readCursor, row, col));
        // because we do not call nextNode with false result which calls this automatically
        readCursor.exitNode();
        readCursor.exitField();
        while (readCursor.nextNode()) {
            col++;
            readCursor.enterField(cellValueKey);
            readCursor.firstNode();
            reactElem.push(renderCell(workspace, readCursor, row, col));
            // because we do not call nextNode with false result which calls this automatically
            readCursor.exitNode();
            readCursor.exitField();
        }
        reactElem.push(renderHorizontalPlusCell(workspace, row));
    }
    return reactElem;
}

function renderCell(
    workspace: Workspace,
    readCursor: ITreeSubscriptionCursor,
    row: number,
    col: number
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
        </td>
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
                        setCellValueDelAddInTx(
                            workspace,
                            row,
                            i,
                            numvalue + 1,
                            editor
                        );
                    }
                    return TransactionResult.Apply;
                });
            }}
        >
            {"+"}
        </td>
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
                            setCellValueDelAddInTx(
                                workspace,
                                i,
                                col,
                                numvalue + 1,
                                editor
                            );
                        }
                        return TransactionResult.Apply;
                    });
                }}
            >
                {"+"}
            </td>
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
                            setCellValueDelAddInTx(
                                workspace,
                                i,
                                j,
                                numvalue + 1,
                                editor
                            );
                        }
                    }
                    return TransactionResult.Apply;
                });
            }}
        >
            {"+"}
        </td>
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
