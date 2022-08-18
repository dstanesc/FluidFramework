export class BlobHeader {
    public static readonly ENCODING = "ascii";
    public static readonly HEADER_PREFIX = Buffer.from("f4e72832a5bd47d7a2f35ed47ed94a3c", "hex");
    constructor(private readonly _fields: { [key: string]: string; }) { }
    public getValue(key: string): string {
        return this._fields[key];
    }
    public toBinary(): Buffer {
        const contentStr = JSON.stringify(this._fields);
        const contentBinary: Buffer = Buffer.from(contentStr, BlobHeader.ENCODING);
        const contentBinaryLength = contentBinary.byteLength;
        const contentBinaryLengthBuf = new ArrayBuffer(4);
        const view = new DataView(contentBinaryLengthBuf);
        view.setUint32(0, contentBinaryLength, false);
        return Buffer.concat([BlobHeader.HEADER_PREFIX, Buffer.from(contentBinaryLengthBuf), contentBinary]);
    }

    public static fromBinary(buffer: Buffer): BlobHeader | undefined {
        const possibleHeader = buffer.slice(0, BlobHeader.HEADER_PREFIX.byteLength);
        if (!possibleHeader.equals(BlobHeader.HEADER_PREFIX)) {
            return undefined;
        }
        const view = new DataView(buffer);
        const contentBinaryLength = view.getUint32(BlobHeader.HEADER_PREFIX.byteLength, false);
        const contentPos = BlobHeader.HEADER_PREFIX.byteLength + 4;
        const contentBinary = buffer.slice(contentPos, contentPos + contentBinaryLength);
        const contentStr = contentBinary.toString(BlobHeader.ENCODING);
        return new BlobHeader(JSON.parse(contentStr));
    }

    public static readRest(buffer: Buffer): Buffer {
        if (!this.fromBinary(buffer)) {
            return buffer;
        } else {
            return buffer.slice(BlobHeader.HEADER_PREFIX.byteLength + 4);
        }
    }
}

export function writeBlobHeader(header: BlobHeader, buffer: ArrayBufferLike): ArrayBufferLike {
    const binaryHeader = header.toBinary();
    const totalLength = buffer.byteLength + binaryHeader.byteLength;
    const contentBuffer = Buffer.from(buffer);
    const newBuffer = Buffer.concat([binaryHeader, contentBuffer], totalLength);
    return newBuffer;
}

export function readBlobHeader(buffer: ArrayBufferLike): BlobHeader | undefined {
    return BlobHeader.fromBinary(Buffer.from(buffer));
}

export function skipHeader(buffer: ArrayBufferLike): ArrayBufferLike {
    return BlobHeader.readRest(Buffer.from(buffer));
}

export class BlobHeaderBuilder {
    private readonly _fields = {};
    public addField(key: string, value: string) {
        this._fields[key] = value;
    }
    public build(): BlobHeader {
        return new BlobHeader(this._fields);
    }
}
