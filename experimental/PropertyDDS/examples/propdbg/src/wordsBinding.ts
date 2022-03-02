/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import { DataBinding } from "@fluid-experimental/property-binder";
import { Words } from "./words";
import { Word } from "./word";

export class WordsBinding extends DataBinding {
    public words: Words;
    constructor(params: any) {
        super(params);
        this.words = this.getRepresentation<Words>()!;
    }
    addWord(key: any, ctx: any) {
        this.words.addWord(this.getDataBinder().getRepresentation<Word>(ctx.getProperty(), "view")!);
    }
    static initialize() {
        this.registerOnPath("words", ["collectionInsert"], WordsBinding.prototype.addWord);
    }
}

WordsBinding.initialize();
