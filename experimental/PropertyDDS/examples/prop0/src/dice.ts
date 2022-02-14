export class Dice {

    diceValue: number;

    diceElement: HTMLElement;

    constructor(diceValue: number, diceElement: HTMLElement){
        this.diceValue = diceValue;
        this.diceElement = diceElement;
    }

    public updateValue(diceValue: number){
        this.diceValue = diceValue;
        this.diceElement.innerHTML=diceValue.toString();
    }
}
