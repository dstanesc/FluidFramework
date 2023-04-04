import { FieldUpPath } from "./pathTree";
import * as Delta from "./delta";

export interface ExtVisitor {
	onDelete(path: FieldUpPath, start: number, count: number): void;
	onInsert(path: FieldUpPath, index: number, content: readonly Delta.ProtoNode[]): void;
}
