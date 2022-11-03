import { SharedTree, ISharedTree } from "@fluid-internal/tree";
import { InsecureTokenProvider } from "@fluidframework/test-client-utils";
import {
    AzureClient,
} from "@fluidframework/azure-client";

export async function initializeWorkspace(containerId: string | undefined): Promise<Workspace> {
    const createNew = containerId === undefined;
    const treeClass: any = SharedTree;
    const containerSchema = {
        initialObjects: { tree: treeClass },
    };
    const azureClient = createAzureClient();
    let containerAndServices;
    if (createNew) {
        containerAndServices = await azureClient.createContainer(containerSchema);
        // eslint-disable-next-line no-param-reassign
        containerId = await containerAndServices.container.attach();
    } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        containerAndServices = await azureClient.getContainer(containerId!, containerSchema);
    }
    const sharedTree = containerAndServices.container.initialObjects.tree as ISharedTree;
    const workspacePromise = {
        containerId,
        tree: sharedTree,
    };
    return workspacePromise;
}

export interface Workspace {
    containerId: string | undefined;
    tree: ISharedTree;
}

function createAzureClient() {
    const myUser: any = {
        id: "miso",
        name: "miso",
    };
    return new AzureClient({
        connection: {
            type: "local",
            tokenProvider: new InsecureTokenProvider("abcd", myUser),
            endpoint: "http://localhost:7070",
        },
    });
}
