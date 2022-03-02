/* eslint-disable prefer-template */
import { getTinyliciousContainer } from "@fluid-experimental/get-container";
import { DataBinder } from "@fluid-experimental/property-binder";
import {
    fetchRegisteredTemplates,
    handlePropertyDataCreation, IDataCreationOptions,
    IInspectorRow,
    IInspectorTableProps,
    InspectorTable,
    ModalManager,
    ModalRoot,
} from "@fluid-experimental/property-inspector-table";
import { ContainerProperty, NodeProperty, PropertyFactory } from "@fluid-experimental/property-properties";
import { PropertyProxy } from "@fluid-experimental/property-proxy";
import { getDefaultObjectFromContainer } from "@fluidframework/aqueduct";
import { assert } from "@fluidframework/common-utils";
import _ from "lodash";
import React from "react";
import ReactDOM from "react-dom";
import { PropertyTreeContainerRuntimeFactory as ContainerFactory } from "./containerCode";
import { IPropertyTree } from "./dataObject";
import { Word } from "./word";
import words from "./word-1.0.0";
import { WordBinding } from "./wordBinding";
import { Words } from "./words";
import word from "./words-1.0.0";
import { WordsBinding } from "./wordsBinding";

export const handlePropertyDataCreationOptionGeneration =
    (rowData: IInspectorRow, nameOnly: boolean): IDataCreationOptions => {
    if (nameOnly) {
        return { name: "property" };
    }
    const templates = fetchRegisteredTemplates();
    return { name: "property", options: templates };
};

const tableProps: Partial<IInspectorTableProps> = {
    columns: ["name", "value", "type"],
    dataCreationHandler: handlePropertyDataCreation,
    dataCreationOptionGenerationHandler: handlePropertyDataCreationOptionGeneration,
    expandColumnKey: "name",
    width: 1000,
    height: 600,
};

async function start(): Promise<void> {
    const shouldCreateNew = location.hash.length === 0;
    const documentId = !shouldCreateNew ? window.location.hash.substring(1) : "";

    PropertyFactory.register(Object.values([word,words]));

    const [container, containerId]  = await getTinyliciousContainer(documentId, ContainerFactory, shouldCreateNew);
    location.hash = containerId;
    document.title = containerId;

    console.log(containerId);
    const propertyTree: IPropertyTree = await getDefaultObjectFromContainer<IPropertyTree>(container);
    const fluidBinder = new DataBinder();
    fluidBinder.attachTo(propertyTree.tree);
    renderButtons(propertyTree);
    renderApp(fluidBinder,propertyTree);
    renderInspector(fluidBinder,propertyTree);
}

function updateRemoteChanges(propertyTree: IPropertyTree) {
    const cell = document.getElementById("ID_RemoteChanges") as HTMLTableCellElement;
    cell.textContent = propertyTree.tree.remoteChanges.length.toString();
}

function renderButtons(propertyTree: IPropertyTree) {
    const div = document.getElementById("wordButtons") as HTMLDivElement;
    const infoTable = (
        <table>
            <tr><td
             style={{borderWidth:"1px", width: "200px",borderStyle:"solid"}}
            >Remote Changes</td>
            <td id="ID_RemoteChanges"
             style={{borderWidth:"1px",  width: "200px",borderStyle:"solid"}}
            >{propertyTree.tree.remoteChanges.length}</td></tr>
        </table>
    );

    const updateInfo = (
        <button id="UpdateInfo" onClick={() => {
            updateRemoteChanges(propertyTree);
        }}>Update Info</button>
    );

    const createWordsButton = (
        <button id="CreateWords" onClick={() => {
            const wordsProp: NodeProperty =  PropertyFactory.create("lujza:words-1.0.0");
            const wordsId = "W_" + Math.random().toString();
            propertyTree.tree.root.insert(wordsId, wordsProp);
 //           propertyTree.commit();
        }}>Create Words</button>
    );
    const commitButton = (
        <button id="Commit" onClick={() => {
            propertyTree.commit();
        }}>Commit</button>
    );
    const cont = (
        <div>{infoTable}<br></br>{createWordsButton} {commitButton} {updateInfo}</div>
        );
    ReactDOM.render(cont, div);
}

function renderApp(fluidBinder: DataBinder, propertyTree: IPropertyTree) {
        initApp(fluidBinder,propertyTree);
}

function initApp(fluidBinder: DataBinder, propertyTree: IPropertyTree) {
    const div = document.getElementById("wordTable") as HTMLDivElement;
    fluidBinder.defineRepresentation("view", "lujza:words-1.0.0", (property) => {
        console.log("\n\n\nwords being created\n\n\n");
        return  new Words([],div, property.getAbsolutePath(),propertyTree);
    });

    fluidBinder.defineRepresentation("view", "lujza:word-1.0.0", (property) => {
        assert(property instanceof ContainerProperty, "Property should always be a ContainerProperty.");

        const values = property.getValues<any>();
        return new Word(values.person, values.noun, values.verb, values.adverb,
            values.negative, property.getAbsolutePath(),propertyTree);
    }, {
            destroyer: (rep: Word) => rep.toString(),
    });
    fluidBinder.register("view", "lujza:word-1.0.0", WordBinding);
    fluidBinder.register("view", "lujza:words-1.0.0", WordsBinding);
}

function renderInspector(fluidBinder: DataBinder, propertyTree: IPropertyTree) {
    fluidBinder.registerOnPath("/", ["insert", "remove", "modify"], _.debounce(() => {
        const proxifiedDDS = PropertyProxy.proxify(propertyTree.tree.root);
        ReactDOM.render(
            <ModalManager>
                <ModalRoot />
                <InspectorTable data={proxifiedDDS} {...tableProps} />
            </ModalManager>,
            document.getElementById("root"));
    }, 20));
}
start().catch((error) => console.error(error));
