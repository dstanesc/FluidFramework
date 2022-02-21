import { PropertyFactory, NodeProperty, Int32Property }
    from "@fluid-experimental/property-properties";

import { DataBinder } from "@fluid-experimental/property-binder";

import { getDefaultObjectFromContainer } from "@fluidframework/aqueduct";

import { getTinyliciousContainer } from "@fluid-experimental/get-container";

import { IPropertyTree, registerSchema, PropertyTreeContainerRuntimeFactory } from "./dataObject";

import diceSchema from "./dice-1.0.0";

import { Dice } from "./dice";

import { DiceBinding } from "./diceBinding";

import { IContainer } from '@fluidframework/container-definitions';

// In interacting with the service, we need to be explicit about whether we're creating a new document vs. loading
// an existing one.  We also need to provide the unique ID for the document we are creating or loading from.

// In this app, we'll choose to create a new document when navigating directly to http://localhost:8080.  For the ID,
// we'll choose to use the current timestamp.  We'll also choose to interpret the URL hash as an existing document's
// ID to load from, so the URL for a document load will look something like http://localhost:8080/#1596520748752.
// These policy choices are arbitrary for demo purposes, and can be changed however you'd like.

// Reference to dice div element

const diceDiv = document.getElementById("content") as HTMLDivElement;
const commitDiv = document.getElementById("commit") as HTMLDivElement;

async function start(): Promise<void> {

    const shouldCreateNew = location.hash.length === 0;
    const documentId = !shouldCreateNew ? window.location.hash.substring(1) : "";
    // eslint-disable-next-line max-len
    const [container, containerId] = await getTinyliciousContainer(documentId, PropertyTreeContainerRuntimeFactory, shouldCreateNew);

    await waitConnected(container);

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

        // Commit in order to reflect changes on the other clients
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
        roll(workspace, 1000);
    };

    commitDiv.onclick = function(ev) {
        workspace.commit();
    };
}

function roll(workspace: IPropertyTree, cycles: number) {
    const diceValueProperty: Int32Property = workspace.rootProperty.resolvePath("dice.diceValue")! as Int32Property;
    const newLocal = Math.floor(Math.random() * 1024) + 1;
    console.log(`${newLocal}`);
    diceValueProperty.setValue(newLocal);
    diceDiv.innerHTML = newLocal.toString();
    workspace.commit();
    if (cycles > 0) {
        setTimeout(() => roll(workspace, --cycles), 5);
    }
}


function waitConnected(container: IContainer) {
    return new Promise((resolve) =>
        container.once("connected", () => resolve(undefined))
    );
}

// Start the application
start().catch((error) => console.error(error));



