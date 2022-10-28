/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable prefer-template */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable import/no-default-export */
/* eslint-disable import/no-internal-modules */
/* eslint-disable import/no-unassigned-import */
/* eslint-disable @typescript-eslint/no-floating-promises */

/* eslint-disable curly */

import {
    brand,
    FieldChangeMap,
    ITreeSubscriptionCursor,
    SchemaData,
    SharedTree,
    TransactionResult,
    TreeNavigationResult,
} from "@fluid-internal/tree";
import {
    DefaultChangeFamily,
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

const initialTable = {
    type: oneTableSchema.name,
    fields: {
        [rowKey]: [
            {
                type: oneRowSchema.name,
                fields: {
                    [cellKey]: [
                        {
                            type: oneCellSchema.name,
                            value: 12,
                        },
                        {
                            type: oneCellSchema.name,
                            value: 10,
                        },
                    ],
                },
            },
            {
                type: oneRowSchema.name,
                fields: {
                    [cellKey]: [
                        {
                            type: oneCellSchema.name,
                            value: 22,
                        },
                        {
                            type: oneCellSchema.name,
                            value: 4,
                        },
                    ],
                },
            },
        ],
    },
};

export default function App() {
    const [workspace, setWorkspace] = useState<Workspace>();
    const [, setIsRender] = useState<number>(0);
    // const [myValue, setMyValue] = useState<number>(0);
    const containerId = window.location.hash.substring(1) || undefined;

    useEffect(() => {
        async function initWorkspace() {
            const myWorkspace = await initializeWorkspace(containerId);
            // Update location
            if (myWorkspace.containerId)
                window.location.hash = myWorkspace.containerId;
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
            <h1>Hello!</h1>
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
                    const mywrk = workspace!;
                    const tree = mywrk.tree as SharedTree;
                    const rootAnchor = tree.rootAnchor();
                    tree.runTransaction((forest, editor) => {
                        tree.context.prepareForEdit();
                        const field = editor.sequenceField(
                            tree.locate(rootAnchor!),
                            rowKey,
                        );
                        const writeCursor = singleTextCursor({
                            type: oneRowSchema.name,
                            fields: {
                                [cellKey]: [
                                    {
                                        type: oneCellSchema.name,
                                        value: 54,
                                    },
                                    {
                                        type: oneCellSchema.name,
                                        value: 24,
                                    },
                                ],
                            },
                        });
                        field.insert(0, writeCursor);
                        return TransactionResult.Apply;
                    });
                    reRender(setIsRender);
                }}
            >
                ADD ROW
            </button>
            <br></br>
            <button
                onClick={() => {
                    console.log("BROWSE clicked BEGIN");
                    const mywrk = workspace!;
                    const tree = mywrk.tree as SharedTree;
                    const { forest } = tree;
                    const readCursor = forest.allocateCursor();
                    try {
                        const destination = forest.root(forest.rootField);
                        const cursorResult = forest.tryMoveCursorTo(
                            destination,
                            readCursor,
                        );
                        readCursor.enterField(rowKey);
                        readCursor.enterField(cellKey);
                        console.log("result : " + cursorResult);
                        reRender(setIsRender);
                    } finally {
                        readCursor.free();
                    }
                    console.log("BROWSE clicked END : ");
                }}
            >
                BROWSE
            </button>
            <br></br>
            <table className="mtable">
                <tbody>{renderRows(workspace)}</tbody>
            </table>
            <br></br>
            <p>BYE</p>
        </div>
    );
}

function renderRows(workspace: Workspace | undefined) {
    const reactElem: any[] = [];
    if (workspace === undefined) {
        return reactElem;
    }
    const mywrk = workspace!;
    const tree = mywrk.tree as SharedTree;
    const { forest } = tree;
    const readCursor = forest.allocateCursor();
    try {
        const destination = forest.root(forest.rootField);
        const moveResult = forest.tryMoveCursorTo(destination, readCursor);
        if (moveResult === TreeNavigationResult.Ok) {
            readCursor.enterField(rowKey);
            if (readCursor.firstNode()) {
                reactElem.push(renderRow(workspace, readCursor));
                readCursor.exitField();
                while (readCursor.nextNode()) {
                    reactElem.push(renderRow(workspace, readCursor));
                    readCursor.exitField();
                }
            }
        }
    } finally {
        readCursor.free();
    }
    console.log("Table Rendered " + reactElem.length);
    return reactElem;
}

function renderRow(workspace: Workspace, readCursor: ITreeSubscriptionCursor) {
    const reactElem: any[] = [];
    reactElem.push(renderCells(workspace, readCursor));
    const rowElem = <tr>{reactElem}</tr>;
    return rowElem;
}

function renderCells(
    workspace: Workspace,
    readCursor: ITreeSubscriptionCursor,
) {
    const reactElem: any[] = [];
    readCursor.enterField(cellKey);
    if (readCursor.firstNode()) {
        reactElem.push(renderCell(workspace, readCursor));
        while (readCursor.nextNode()) {
            reactElem.push(renderCell(workspace, readCursor));
        }
    }
    return reactElem;
}

function renderCell(workspace: Workspace, readCursor: ITreeSubscriptionCursor) {
    const reactElem: any[] = [];
    reactElem.push(<td className="mcell">{readCursor.value}</td>);
    return reactElem;
}

function reRender(setIsRender) {
    setIsRender(2000000000 * Math.random());
}
