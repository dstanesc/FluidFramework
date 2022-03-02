import { NodeProperty } from "@fluid-experimental/property-properties";
import { IPropertyTree } from "./dataObject";
import { Words } from "./words";

export class Word {
    words: Words | undefined;
    table: HTMLTableElement | undefined;
    person: string;
    noun: number;
    verb: string;
    adverb: string;
    negative: string;
    absolutePath: string;
    propTree: IPropertyTree;
    constructor(
        person: string,
        noun: number,
        verb: string,
        adverb: string,
        negative: string,
        absolutePath: string,
        propTree: IPropertyTree,
    )
        {
            this.person = person;
            this.noun = noun;
            this.verb = verb;
            this.adverb = adverb;
            this.negative = negative;
            this.absolutePath = absolutePath;
            this.propTree = propTree;
        }

    public draw() {
        if (!this.table) {
            throw new Error("The table is not set.");
        }

        const row: HTMLTableRowElement = this.table.insertRow();

        const personChnCell: HTMLTableCellElement = row.insertCell(0);
        personChnCell.style.textAlign = "center";
        personChnCell.style.border = "1px solid #000";
        const personChnButton: HTMLButtonElement = document.createElement("BUTTON") as HTMLButtonElement;
        const personChnButton2: HTMLButtonElement = document.createElement("BUTTON") as HTMLButtonElement;
        const personChnButtonCommit: HTMLButtonElement = document.createElement("BUTTON") as HTMLButtonElement;
        const personChnButtonMultiCommit: HTMLButtonElement = document.createElement("BUTTON") as HTMLButtonElement;
        const personChnButtonMultiCommitX: HTMLButtonElement = document.createElement("BUTTON") as HTMLButtonElement;
        personChnButton.textContent = "-P";
        personChnButton2.textContent = "-N";
        personChnButtonCommit.textContent = "-C";
        personChnButtonMultiCommit.textContent = "-M";
        personChnButtonMultiCommitX.textContent = "-X";
        personChnButton.onclick = () => {
            const wordProp = this.propTree.tree.root.resolvePath(this.absolutePath) as NodeProperty;
            wordProp.get("person")!.value = Math.round(Math.random() * 1000000).toString();
        };
        personChnButton2.onclick = () => {
            const wordProp = this.propTree.tree.root.resolvePath(this.absolutePath) as NodeProperty;
            wordProp.get("noun")!.value = Math.round(Math.random() * 1000000);
        };
        personChnButtonCommit.onclick = () => {
            const wordProp = this.propTree.tree.root.resolvePath(this.absolutePath) as NodeProperty;
            wordProp.get("person")!.value = Math.round(Math.random() * 1000000).toString();
            this.propTree.commit();
        };

        personChnButtonMultiCommit.onclick = () => {
            for(let i = 0; i < 100; i++) {
                const wordProp = this.propTree.tree.root.resolvePath(this.absolutePath) as NodeProperty;
                wordProp.get("person")!.value = Math.round(Math.random() * 1000000).toString();
                this.propTree.commit();
            }
        };

        personChnButtonMultiCommitX.onclick = () => {
            for(let i = 0; i < 1000; i++) {
                const wordProp = this.propTree.tree.root.resolvePath(this.absolutePath) as NodeProperty;
                wordProp.get("person")!.value = Math.round(Math.random() * 1000000).toString();
                this.propTree.commit();
            }
        };

        personChnCell.appendChild(personChnButton);
        personChnCell.appendChild(personChnButton2);
        personChnCell.appendChild(personChnButtonCommit);
        personChnCell.appendChild(personChnButtonMultiCommit);
        personChnCell.appendChild(personChnButtonMultiCommitX);
        const personCell: HTMLTableCellElement = row.insertCell(1);
        personCell.innerText = this.person;
        personCell.style.textAlign = "center";
        personCell.style.border = "1px solid #000";
        const nounCell: HTMLTableCellElement = row.insertCell(2);
        nounCell.innerText = this.noun.toString();
        nounCell.style.textAlign = "center";
        nounCell.style.border = "1px solid #000";
        const verbCell: HTMLTableCellElement = row.insertCell(3);
        verbCell.innerText = this.verb;
        verbCell.style.textAlign = "center";
        verbCell.style.border = "1px solid #000";
        const adverbCell: HTMLTableCellElement = row.insertCell(4);
        adverbCell.innerText = this.adverb;
        adverbCell.style.textAlign = "center";
        adverbCell.style.border = "1px solid #000";
        const negationCell: HTMLTableCellElement = row.insertCell(5);
        negationCell.innerText = this.negative;
        negationCell.style.textAlign = "center";
        negationCell.style.border = "1px solid #000";
    }

    public setWords(words: Words) {
        this.words = words;
    }

    public setTable(table: HTMLTableElement) {
        this.table = table;
    }

    private drawWords() {
        if (!this.words) {
            throw new Error("The words is not set.");
        }
        this.words.draw();
    }

    public setPerson(person: string) {
        this.person = person;
        this.drawWords();
    }
    public setNoun(noun: number) {
        this.noun = noun;
        this.drawWords();
    }
    public setVerb(verb: string) {
        this.verb = verb;
        this.drawWords();
    }
    public setAdverb(adverb: string) {
        this.adverb = adverb;
        this.drawWords();
    }
    public setNegative(negative: string) {
        this.negative = negative;
        this.drawWords();
    }
}
