/* eslint-disable unicorn/consistent-function-scoping */
/* eslint-disable jsdoc/no-bad-blocks */
/* eslint-disable jsdoc/check-indentation */
/* eslint-disable unicorn/no-array-for-each */
/* eslint-disable @typescript-eslint/restrict-plus-operands */

/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable unicorn/prefer-string-slice */
/* eslint-disable unicorn/no-for-loop */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

/* eslint-disable @typescript-eslint/no-unsafe-return */
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
} from "@fluid-internal/tree";
import { fieldSchema } from "@fluid-internal/tree/dist/core";
import { FieldKinds, namedTreeSchema, singleTextCursor } from "@fluid-internal/tree/dist/feature-libraries";

import React, { useState, useEffect } from "react";
import "./App.css";
import { initializeWorkspace, Workspace } from "./workspace";

export type Int32 = Brand<number, "myApp:Int32-1.0.0"> & EditableTree;

export type Dice = EditableTree &
    Brand<{ valueKeys: Int32[]; }, "myApp:Dice-1.0.0">;

export const int32Schema = namedTreeSchema({
    name: brand("myApp:Int32-1.0.0"),
    extraLocalFields: emptyField,
    value: ValueSchema.Number,
});

const diceSchema = namedTreeSchema({
    name: brand("myApp:Dice-1.0.0"),
    localFields: {
        valueKeys: fieldSchema(FieldKinds.sequence, [int32Schema.name]),
    },
    extraLocalFields: emptyField,
});

const appSchema: SchemaData = {
    treeSchema: new Map([[diceSchema.name, diceSchema], [int32Schema.name, int32Schema]]),
    globalFieldSchema: new Map(),
};

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
            myWorkspace.tree.storedSchema.update(appSchema);

            myWorkspace.tree.on("pre-op", (event) => {
                // console.log(event);
                // console.log("Tree pre-op received!");
            });
            myWorkspace.tree.on("op", (event) => {
                appendOps();
                setDiceValues(readDiceValues(myWorkspace));

            });
            myWorkspace.tree.on("error", (event) => {
                console.log(event);
                console.log("Tree error received!");
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
        const newTime = Date.now();
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
        dices.push({
            type: int32Schema.name,
            value: newValue,
        });
    }
    return {
        type: diceSchema.name,
        fields: {
            valueKeys: dices,
        },
    };
}

function insertDiceValues(workspace: Workspace) {
    const data = diceData();
    const tree = workspace.tree;
    const wrappedRoot = tree.context.root;
    wrappedRoot.insertNodes(
        0,
        singleTextCursor(data)
    );
}

function updateDiceValues(workspace: Workspace) {
    const data = diceData();
    const rawData = data.fields.valueKeys.map((value: any) => value.value);
    const tree = workspace.tree;
    const unwrappedRoot = tree.context.unwrappedRoot;
    if (unwrappedRoot !== undefined) {
        const dice: Dice = unwrappedRoot as Dice;
        dice.valueKeys = rawData;
    } else insertDiceValues(workspace);
}

function readDiceValues(
    workspace: Workspace | undefined,
): number[] {
    if (workspace === undefined) {
        return [];
    }
    const tree = workspace.tree;
    const unwrappedRoot = tree.context.unwrappedRoot;
    if (unwrappedRoot === undefined) {
        return [];
    }
    const dice: Dice = unwrappedRoot as Dice;
    const values: number[] = [];
    for (const value of dice.valueKeys) {
        values.push(value);
    }
    return values;
}
