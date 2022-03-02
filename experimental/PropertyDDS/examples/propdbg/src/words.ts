import { MapProperty, NodeProperty, PropertyFactory } from "@fluid-experimental/property-properties";
import { IPropertyTree } from "./dataObject";
import { Word } from "./word";

export class Words {
    static HEIGHT = 400;
    static WIDTH = 500;

    table: HTMLTableElement;
    wordList: Word[];
    absolutePath: string;
    _propTree: IPropertyTree;

    constructor(readonly wordListArg: Word[], readonly elm: HTMLElement, absolutePath: string,
        propTree: IPropertyTree) {
        this._propTree = propTree;
        if(elm.hasChildNodes()) {
            const hrLine = document.createElement("HR");
            hrLine.style.height = "4px";
            hrLine.style.color = "#000";
            hrLine.style.backgroundColor = "#000";
            elm.appendChild(hrLine);
        }
        this.table = document.createElement("table");
        this.table.style.tableLayout = "fixed";
        this.table.style.width = "1200px";
        this.wordList = wordListArg;
        this.absolutePath = absolutePath;
        this.drawHeader();

        const addWordButton: HTMLButtonElement = document.createElement("button");
        addWordButton.name = "AddWord";
        addWordButton.textContent = "Add Word";
        addWordButton.onclick = () => {
            const wordsProp = propTree.tree.root.resolvePath(absolutePath) as NodeProperty;
            const wordProp: NodeProperty =  PropertyFactory.create("lujza:word-1.0.0");
            const wordsMapProp = wordsProp.get("words")! as MapProperty;
            const wordId = wordsMapProp.getIds().length;
            (wordsMapProp).insert(wordId.toString(), wordProp);
        };
        elm.appendChild(addWordButton);
        elm.appendChild(this.table);
    }

    drawHeader() {
        const headRow = this.table.insertRow();
        headRow.style.border = "4px solid #000";
        let cell = headRow.insertCell(0);
        cell.textContent = "Change";
        cell.style.border = "2px solid #000";
        cell.style.textAlign = "center";
        cell = headRow.insertCell(1);
        cell.textContent = "PERSON";
        cell.style.border = "2px solid #000";
        cell.style.textAlign = "center";
        cell = headRow.insertCell(2);
        cell.textContent = "NOUN";
        cell.style.border = "2px solid #000";
        cell.style.textAlign = "center";
        cell = headRow.insertCell(3);
        cell.textContent = "VERB";
        cell.style.border = "2px solid #000";
        cell.style.textAlign = "center";
        cell = headRow.insertCell(4);
        cell.textContent = "ADVERB";
        cell.style.border = "2px solid #000";
        cell.style.textAlign = "center";
        cell = headRow.insertCell(5);
        cell.textContent = "NEGATIVE";
        cell.style.border = "2px solid #000";
        cell.style.textAlign = "center";
    }

    draw() {
        if (!this.table) {
            throw new Error("The table is not set.");
        }
        while(this.table.hasChildNodes()) {
            this.table.removeChild(this.table.firstChild!);
        }
        this.drawHeader();
        for (const word of this.wordList) {
            word.draw();
        }
    }

    addWord(word: Word) {
        word.setTable(this.table);
        word.setWords(this);
        this.wordList.push(word);
        this.draw();
    }
}
