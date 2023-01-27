/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { Delta } from "../core";
import { Dependee, Dependent, InvalidationToken } from "./dependencies";

/**
 * Simple implementation of {@link Dependee}.
 *
 * @public
 */
export class SimpleDependee implements Dependee {
    private readonly dependents = new Set<Dependent>();

    public constructor(public readonly computationName = "SimpleDependee") {}

    public registerDependent(dependent: Dependent): boolean {
        if (this.dependents.has(dependent)) {
            return false;
        }
        this.dependents.add(dependent);
        return true;
    }

    public removeDependent(dependent: Dependent): void {
        this.dependents.delete(dependent);
    }

    /**
     * Invalidates the dependents that have are dependent on this data.
     */
    public invalidateDependents(token?: InvalidationToken, delta?: Delta.Root): void {
        for (const dependent of this.dependents) {
            dependent.markInvalid(token, delta);
        }
    }

    /**
     * @sealed
     */
    public listDependents() {
        return this.dependents;
    }
}
