import { compute_chunks } from "@dstanesc/wasm-chunking-fastcdc-webpack";

export enum ChunkingStrategy {
    FixedSize,
    ContentDefined,
}

export interface ChunkingConfig {
    avgChunkSize: number;
    chunkingStrategy: ChunkingStrategy;
}

export interface IContentChunker {
    computeChunks: (buffer: Uint8Array) => Uint8Array[];
}

export class FixedSizeContentChunker implements IContentChunker {
    chunkSize: number;
    constructor(chunkSize: number) {
        this.chunkSize = chunkSize;
    }
    public computeChunks(buffer: Uint8Array): Uint8Array[] {
        const blocks: Uint8Array[] = [];
        for (let pos = 0, i = 0; pos < buffer.byteLength; pos += this.chunkSize, i++) {
            const bytes: Uint8Array = buffer.slice(pos, pos + this.chunkSize);
            blocks.push(bytes);
        }
        return blocks;
    }
}

export class FastContentDefinedChunker implements IContentChunker {
    minSize: number;
    avgSize: number;
    maxSize: number;
    constructor(
        avgSize: number,
        sizeRange: (avg: number) => { min: number; max: number; } = function(avg: number) {
            return {
                min: Math.floor(avg / 2),
                max: avg * 2,
            };
        }) {
        const { min, max } = sizeRange(avgSize);
        this.minSize = min;
        this.avgSize = avgSize;
        this.maxSize = max;
    }
    public computeChunks(buffer: Uint8Array): Uint8Array[] {
        const blocks: Uint8Array[] = [];
        if (buffer.byteLength >= 256) {
            const offsets: Uint32Array = compute_chunks(buffer, this.minSize, this.avgSize, this.maxSize);
            let lastOffset: number = 0;
            for (const offset of offsets.subarray(1).values()) {
                console.log(` slicing from last:${lastOffset} to current:${offset}`);
                const bytes = buffer.slice(lastOffset, offset);
                blocks.push(bytes);
                lastOffset = offset;
            }
        } else {
            blocks.push(buffer.slice(0, buffer.byteLength));
        }
        return blocks;
    }
}

export function createChunkingMethod(chunkingConfig: ChunkingConfig): IContentChunker {
    const avgSize = chunkingConfig.avgChunkSize;
    if (!Number.isInteger(avgSize) || avgSize < 256) {
        throw new Error(`avgChunkSize should be a positive integer larger or equal to 256. Wrong input ${avgSize}`);
    }
    let contentChunker: IContentChunker;
    switch (chunkingConfig.chunkingStrategy) {
        case ChunkingStrategy.FixedSize:
            contentChunker = new FixedSizeContentChunker(avgSize); break;
        case ChunkingStrategy.ContentDefined:
            contentChunker = new FastContentDefinedChunker(avgSize); break;
        default: throw new Error(`Unknown chunking strategy ${chunkingConfig.chunkingStrategy}`);
    }
    return contentChunker;
}
