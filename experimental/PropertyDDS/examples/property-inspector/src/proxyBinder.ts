import { DataBinder } from "@fluid-experimental/property-binder";
import { ISharedTree, Delta, EditableTreeContext, EditableTree, typeNameSymbol, proxyTargetSymbol, ITreeCursor} from "@fluid-internal/tree";
import { convertCursorToInsertCSet, convertDeltaToCSet } from "./convertDeltaToChangeSet";

class PropertyWrapper {
    constructor(private readonly node: EditableTree,
                private readonly path: string) {

    }

    getAbsolutePath(): string {
        return `/${this.path}`;
    }
    getContext(): string {
        return "single";
    }

    getFullTypeid(): string {
        return this.node[typeNameSymbol];
    }

    get(path: string[]) {
        return new PropertyWrapper(this.node, this.path);

        /*let node = this.node;
        let nodePath = this.path;
        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let i = 0; i < path.length; i++) {
            const field = node[getField](path[i] as FieldKey);
            if (field) {
                if (field.length === 0 ) {
                    return undefined;
                }
                node = field.getNode(0);
                if (!node) {
                    return undefined;
                }
            } else {
                return undefined;
            }

            nodePath = `${nodePath}.${path}`;
        }

        return new PropertyWrapper(node, nodePath);*/
    }
}

class PropertyTreeWrapper {
    constructor(public readonly sharedTree: ISharedTree) {

    }

    get root() {
        return new PropertyWrapper(this.sharedTree.context.root.getNode(0), "");
    }
}
export class ProxyBinder extends DataBinder {

    /**
     * Attaches this DataBinder to the given SharedTree. Any bindings that are registered will be
     * applied to the current contents of the workspace. Future ChangeSets produced by the Workspace
     * will be processed and the corresponding data bindings will be created, updated or removed as
     * appropriate.
     *
     * @param sharedTree - The SharedTree to bind to.
     */
    attachToProxy(sharedTree: ISharedTree) {
        if (this._onModifiedRegistrationKey) {
            // Don't mess with any definitions for bindings / activations
            this.detach(false);
        }

        const eventHandler = (changeContext: EditableTreeContext, delta: Delta.Root | undefined) => {
            if (delta) {
                const CSet = convertDeltaToCSet(delta, changeContext);

                (this as any)._modifyScene(CSet);
            }
        };

        (this as any)._propertyTree = new PropertyTreeWrapper(sharedTree);
        (this as any)._buildDataBindingTree();

        // We have delayed bindings until attaching.
        (this as any)._checkDelayedBindings();

        this._onModifiedRegistrationKey = eventHandler;
        sharedTree.context.attachAfterChangeHandler(eventHandler);

        const cursor = (sharedTree.context.root.getNode(0)[proxyTargetSymbol] as any).cursor as ITreeCursor;
        const initialCSet = convertCursorToInsertCSet(cursor, sharedTree.context)[0];
        (this as any)._modifyScene(initialCSet);

    }
}
