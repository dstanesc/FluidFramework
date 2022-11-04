/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable prefer-template */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable import/no-default-export */
/* eslint-disable import/no-internal-modules */
/* eslint-disable import/no-unassigned-import */
/* eslint-disable @typescript-eslint/no-floating-promises */

import {
    cursorToJsonObject,
    FieldChangeMap,
    IForestSubscription,
    ITreeSubscriptionCursor,
    JsonCompatible,
    JsonCompatibleObject,
    jsonSchemaData,
    SharedTree,
    singleJsonCursor,
    TransactionResult,
    TreeNavigationResult,
} from "@fluid-internal/tree";
import { IEditableForest, initializeForest } from "@fluid-internal/tree/dist/core";

import {
    DefaultChangeFamily,
    jsonableTreeFromCursor,
    singleTextCursor,
} from "@fluid-internal/tree/dist/feature-libraries";
import { SharedTreeCore } from "@fluid-internal/tree/dist/shared-tree-core";
import {
    JsonableTree,
} from "@fluid-internal/tree/dist/tree";
import React, { useState, useEffect } from "react";
import "./App.css";
import { initializeWorkspace, Workspace } from "./workspace";

export default function App() {
    const [ops, setOps] = useState<number[]>([]);
    const [rollToggle, setRollToggle] = useState<boolean>(false);
    const [workspace, setWorkspace] = useState<Workspace>();
    const [diceValues, setDiceValues] = useState<number[]>([-1, -1, -1, -1, -1, -1, -1, -1, -1, -1]);
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
            myWorkspace.tree.storedSchema.update(jsonSchemaData);
            // init();
            myWorkspace.tree.on("pre-op", (event) => {
                // console.log(event);
                // console.log("Tree pre-op received!");
            });
            myWorkspace.tree.on("op", (event) => {
                // console.log(event);
                // console.log("Tree op received!");
                appendOps();
                setDiceValues(readDiceValues(myWorkspace));
            });
            myWorkspace.tree.on("error", (event) => {
                // console.log(event);
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
    }, []);

    useEffect(() => {
        if (rollToggle) {
            roll();
        }
    }, [diceValues, rollToggle]);

    const roll = () => {
        updateDiceValues(workspace!);
    };

    const toggleRolling = () => {
        setRollToggle(!rollToggle);
    };

    const appendOps = () => {
        const newTime = new Date().getTime();
        setOps((arr) => [...arr, newTime].slice(arr.length - 100));
    };

    const readOps = (opss: number[]): number => {
        if (opss.length < 2) {
            return 0;
        } else {
            const last = opss[opss.length - 1];
            const first = opss[0];
            const time = last - first;
            return time > 0 ? Math.round(opss.length * 1000 / time) : -1;
        }
    };

    return (
        <div className="App">
            <div className="dices">
                {
                    diceValues.map((value: number, i: number) => <span className="dice" key={i}>{value}</span>)
                }
            </div>
            <div className="commit" onClick={() => toggleRolling()}>
                Roll
            </div>
            <div className="commit">
                {
                    readOps(ops)
                } ops / sec
            </div>
        </div>
    );
}

function diceData() {
    const dices: any[] = [];
    for (let i = 0; i < 10; i++) {
        const newValue = Math.floor(Math.random() * 1024) + 1;
        dices.push(newValue);
    }
    return { dices };
}

function updateDiceValues(workspace: Workspace) {
    workspace.tree.runTransaction((f, editor) => {
        const data = diceData();
        const insertCursor = singleJsonCursor(data);
        const content: JsonableTree = jsonableTreeFromCursor(insertCursor);
        initializeForest(f as IEditableForest, [singleTextCursor(content)]);
        return TransactionResult.Apply;
    });
}

function readDiceValues(
    workspace: Workspace | undefined,
): number[] {
    if (workspace === undefined) {
        return [];
    }
    let values = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const { forest, readCursor } = openReadCursor(workspace);
    try {
        const destination = forest.root(forest.rootField);
        const moveResult = forest.tryMoveCursorTo(destination, readCursor);
        if (moveResult === TreeNavigationResult.Ok) {
            const dicesJson: JsonCompatible = cursorToJsonObject(readCursor);
            values = (dicesJson! as JsonCompatibleObject).dices! as number[];
        }
    } finally {
        readCursor.free();
    }
    console.log(values);
    return values;
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
