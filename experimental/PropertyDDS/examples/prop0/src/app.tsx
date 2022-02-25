
import { PropertyFactory, NodeProperty, Int32Property }
    from "@fluid-experimental/property-properties";

import { DataBinder } from "@fluid-experimental/property-binder";

import { getDefaultObjectFromContainer } from "@fluidframework/aqueduct";

import { getTinyliciousContainer } from "@fluid-experimental/get-container";

import { IPropertyTree, registerSchema, PropertyTreeContainerRuntimeFactory } from "./dataObject";

import diceSchema from "./dice-1.0.0";

import { Dice } from "./dice";

import { DiceBinding } from "./diceBinding";

import { SerializedChangeSet, SharedPropertyTree } from "@fluid-experimental/property-dds";

import { copy as deepClone } from "fastest-json-copy";

import _ from 'lodash';

// import { ChangeSet } from "@fluid-experimental/property-changeset";

// import { ChangeSet } from "@fluid-experimental/property-changeset";

// In interacting with the service, we need to be explicit about whether we're creating a new document vs. loading
// an existing one.  We also need to provide the unique ID for the document we are creating or loading from.

// In this app, we'll choose to create a new document when navigating directly to http://localhost:8080.  For the ID,
// we'll choose to use the current timestamp.  We'll also choose to interpret the URL hash as an existing document's
// ID to load from, so the URL for a document load will look something like http://localhost:8080/#1596520748752.
// These policy choices are arbitrary for demo purposes, and can be changed however you'd like.

// Reference to dice div element

const diceDiv = document.getElementById("content") as HTMLDivElement;
const dirtyDiv = document.getElementById("dirty") as HTMLDivElement;
const changesDiv = document.getElementById("changes") as HTMLDivElement;
const commitDiv = document.getElementById("commit") as HTMLDivElement;

async function start(): Promise<void> {

    const shouldCreateNew = location.hash.length === 0;
    const documentId = !shouldCreateNew ? window.location.hash.substring(1) : "";
    // eslint-disable-next-line max-len
    const [container, containerId] = await getTinyliciousContainer(documentId, PropertyTreeContainerRuntimeFactory, shouldCreateNew);

    // update the browser URL and the window title with the actual container ID
    location.hash = containerId;
    document.title = containerId;

    // Register the template which is used to instantiate properties.

    await registerSchema(diceSchema);

    // Initialize the workspace

    const propertyTree: IPropertyTree = await getDefaultObjectFromContainer<IPropertyTree>(
        container,
        /* { options } */
    );
    // Create the binder

    const fluidBinder = new DataBinder();

    // Attach the binder to the SharedPropertyTree

    fluidBinder.attachTo(propertyTree.tree);

    // Configure binding

    configureBinding(fluidBinder, propertyTree);

    const rootProp: NodeProperty = propertyTree.rootProperty;

    // Add a starting value to initialize the tree

    if (shouldCreateNew) {

        rootProp.insert("dice", PropertyFactory.create("hex:dice-1.0.0", undefined, { "diceValue": "0" }));

        // Com-mit in order to reflect changes on the other clients
        propertyTree.commit();
    }

    // Render current value from the tree, either local or remote

    const diceValueProperty: Int32Property = rootProp.resolvePath("dice.diceValue")! as Int32Property;

    const newLocal = diceValueProperty.getValue();

    diceDiv.innerHTML = newLocal.toString();

}


function configureBinding(fluidBinder: DataBinder, workspace: IPropertyTree) {

    // Configure the Dice factory

    fluidBinder.defineRepresentation("view", "hex:dice-1.0.0", (property) => {
        return new Dice(0, diceDiv);
    });

    // Register the DiceBinding

    fluidBinder.register("view", "hex:dice-1.0.0", DiceBinding);

    // Configure function to update the SharedPropertyTree

    diceDiv.onclick = function(ev) {
        const diceValueProperty: Int32Property = workspace.rootProperty.resolvePath("dice.diceValue")! as Int32Property;
        const newLocal = Math.floor(Math.random() * 1024) + 1;
        diceValueProperty.setValue(newLocal);//
        diceDiv.innerHTML = newLocal.toString();
        // workspace.commit();
    };

    commitDiv.onclick = function(ev) {
        workspace.commit();
    };

    dirtyDiv.onclick = function(ev) {
        if (dirtyDiv.innerHTML !== "") {
            const tree: SharedPropertyTree = workspace.tree;
            //const diff = _.differenceWith([tree.remoteTipView], [tree.tipView]);
            //const remoteValue = diff[0].insert["hex:dice-1.0.0"].dice.Int32.diceValue;
            const remoteTip: SerializedChangeSet = tree.remoteTipView;
            const remoteValue = remoteTip.insert["hex:dice-1.0.0"].dice.Int32.diceValue.toString();
            // eslint-disable-next-line max-len
            const diceValueProperty: Int32Property = workspace.rootProperty.resolvePath("dice.diceValue")! as Int32Property;
            diceValueProperty.setValue(remoteValue);
            diceDiv.innerHTML = remoteValue.toString();
        }
    };

    workspace.on("changeSetModified", (cs) => {
        const tree: SharedPropertyTree = workspace.tree;
        if (!_.isEqual(tree.remoteTipView, tree.tipView)) {
            //const diff = _.differenceWith([tree.remoteTipView], [tree.tipView]);
            //const remoteValue = diff[0].insert["hex:dice-1.0.0"].dice.Int32.diceValue.toString();
            const remoteTip: SerializedChangeSet = tree.remoteTipView;
            const remoteValue = remoteTip.insert["hex:dice-1.0.0"].dice.Int32.diceValue.toString();
            dirtyDiv.innerHTML = `*(${remoteValue})`;
            console.log(JSON.stringify(remoteTip, null, 2));
            let changes: string = "";
            const count = tree.remoteChanges.length;
                for (let i = count - 1; i >= 0; i--) {
                    const changeSet = tree.remoteChanges[i].changeSet;
                    const cs = deepClone(changeSet);
                    const diceValue = cs.modify["hex:dice-1.0.0"].dice.Int32.diceValue;
                    const oldValue = diceValue.oldValue;
                    const currentValue = diceValue.value;
                    changes += i + " [old="+ oldValue + ", new=" +currentValue+"]<br/>";
                    console.log(`Remote Changes ${i}`);
                    console.log(JSON.stringify(cs, null, 2));
                }

                changesDiv.innerHTML = `${changes}`;

        } else {
            dirtyDiv.innerHTML = "";
        }
    });

    workspace.on("commit", (cs) => {
        dirtyDiv.innerHTML = "";
    });
}


// Start the application

start().catch((error) => console.error(error));
