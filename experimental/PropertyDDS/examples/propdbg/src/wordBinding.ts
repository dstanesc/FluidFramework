/* eslint-disable prefer-template */
/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import { DataBinding } from "@fluid-experimental/property-binder";
import { Word } from "./word";

export class WordBinding extends DataBinding {
    private updatePerson(value: string) {
        const word = this.getRepresentation<Word>();
        word?.setPerson(value);
    }
    private updateNoun(value: number) {
        console.log("Noun updated to : " + value.toString());
        const word = this.getRepresentation<Word>();
        word?.setNoun(value);
    }
    private updateVerb(value: string) {
        const word = this.getRepresentation<Word>();
        word?.setVerb(value);
    }
    private updateAdverb(value: string) {
        const word = this.getRepresentation<Word>();
        word?.setAdverb(value);
    }
    private updateNegative(value: string) {
        const word = this.getRepresentation<Word>();
        word?.setNegative(value);
    }
    static initialize() {
        this.registerOnValues("person", ["modify"], this.prototype.updatePerson);
        this.registerOnValues("noun", ["modify"], this.prototype.updateNoun);
        this.registerOnValues("verb", ["modify"], this.prototype.updateVerb);
        this.registerOnValues("adverb", ["modify"], this.prototype.updateAdverb);
        this.registerOnValues("negative", ["modify"], this.prototype.updateNegative);
    }
}
WordBinding.initialize();
