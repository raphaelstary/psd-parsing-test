const fs = require('fs');

const PSD_SIGNATURE = '8BPS';
const BLOCK_SIGNATURE = '8BIM';

const Offset = Object.freeze({
    COLOR: 26, RESOURCES: 26 + 4, LAYER_MASK_INFO: 0, IMAGE: 0
});

const Type = Object.freeze({
    REFERENCE: 'obj ',
    DESCRIPTOR: 'Objc',
    LIST: 'VlLs',
    DOUBLE: 'doub',
    UNIT_FLOAT: 'UntF',
    STRING: 'TEXT',
    ENUMERATED: 'enum',
    INTEGER: 'long',
    LARGE_INTEGER: 'comp',
    BOOLEAN: 'bool',
    GLOBAL_OBJECT: 'GlbO',
    CLASS: 'type',
    CLASS_TOO: 'GlbC',
    ALIAS: 'alis',
    RAW_DATA: 'tdta'
});

class Header {
    constructor({version, channels, height, width, depth, color}) {
        this.version = version;
        this.channels = channels;
        this.height = height;
        this.width = width;
        this.depth = depth;
        this.color = color;

        Object.freeze(this);
    }
}

function parseHeader(buffer) {
    if (buffer.length < Offset.COLOR) {
        throw 'handling multiple chunks for parsing File Header not implemented yet';
    }

    return new Header({
        version: buffer.readUInt16BE(4),
        channels: buffer.readUInt16BE(12),
        height: buffer.readUInt32BE(14),
        width: buffer.readUInt32BE(18),
        depth: buffer.readUInt16BE(22),
        color: buffer.readUInt16BE(24)
    });
}

class Block {
    constructor(id, name, offset, length, dataOffset, dataSize) {
        this.id = id;
        this.name = name;
        this.offset = offset;
        this.length = length;
        this.dataOffset = dataOffset;
        this.dataSize = dataSize;

        Object.freeze(this);
    }
}

function parseResources(buffer) {
    const index = {};

    const resourcesLength = buffer.readUInt32BE(Offset.RESOURCES);

    let cursor = Offset.RESOURCES + 4;

    const max = Offset.RESOURCES + resourcesLength;

    if (max > buffer.length) {
        throw 'handling multiple chunks for parsing Image Resources not implemented yet';
    }

    while (cursor + 1 < max) {

        const start = cursor;

        const signature = buffer.toString('utf8', cursor, cursor += 4);
        if (signature != BLOCK_SIGNATURE) {
            throw 'not a new block';
        }

        const id = buffer.readUInt16BE(cursor);
        cursor += 2;

        const nameLength = buffer.readUInt8(cursor);
        cursor++;
        let name;
        if (nameLength == 0) {
            name = '';
            cursor++;
        } else {
            name = buffer.toString('utf8', cursor, cursor + nameLength);
            if (nameLength % 2 == 0) {
                cursor += nameLength;
            } else {
                cursor += nameLength + 1;
            }
        }

        const blockSize = buffer.readUInt32BE(cursor);
        cursor += 4;

        const end = cursor + (blockSize % 2 == 0 ? blockSize : blockSize + 1);
        index[id] = new Block(id, name, start, end - start, cursor, blockSize);

        cursor = end;
    }

    return index;
}

class Descriptor {
    constructor(classIDName, classID, items) {
        this.classIDName = classIDName;
        this.classID = classID;
        this.items = items;

        Object.freeze(this);
    }
}

class MapItem {
    constructor(key, type, value) {
        this.key = key;
        this.type = type;
        this.value = value;

        Object.freeze(this);
    }
}

class ListItem {
    constructor(type, value) {
        this.type = type;
        this.value = value;

        Object.freeze(this);
    }
}

class ReturnValue {
    constructor(value, cursor) {
        this.value = value;
        this.cursor = cursor;

        Object.freeze(this);
    }
}

/**
 *
 * @param {Buffer} buffer
 * @param {Block} block
 */
function parseTimeline(buffer, block) {
    let cursor = block.dataOffset;

    const descriptorVersion = buffer.readUInt32BE(cursor);
    cursor += 4;

    if (descriptorVersion != 16) {
        throw `version ${descriptorVersion} not supported (yet)`;
    }

    return parseDescriptor(buffer, cursor);
}

function parseDouble(buffer, cursor) {
    return new ReturnValue(buffer.readDoubleBE(cursor), cursor + 8);
}

function parseInteger(buffer, cursor) {
    return new ReturnValue(buffer.readUInt32BE(cursor), cursor + 4);
}

function parseBoolean(buffer, cursor) {
    return new ReturnValue(buffer.readUInt8(cursor) == 1, cursor + 1);
}

function parseText(buffer, cursor) {
    const length = buffer.readUInt32BE(cursor);
    cursor += 4;

    const text = buffer.toString('utf8', cursor, cursor += length * 2);

    return new ReturnValue(text, cursor);
}

function parseList(buffer, cursor) {
    const length = buffer.readUInt32BE(cursor);
    cursor += 4;

    const list = [];
    let value;
    for (let i = 0; i < length; i++) {
        const type = buffer.toString('utf8', cursor, cursor += 4);
        ({value, cursor} = parseType(buffer, cursor, type));
        list.push(new ListItem(type, value));
    }

    return new ReturnValue(list, cursor);
}

function parseType(buffer, cursor, type) {
    if (type == Type.INTEGER) {
        return parseInteger(buffer, cursor);

    } else if (type == Type.BOOLEAN) {
        return parseBoolean(buffer, cursor);

    } else if (type == Type.DESCRIPTOR) {
        return parseDescriptor(buffer, cursor);

    } else if (type == Type.DOUBLE) {
        return parseDouble(buffer, cursor);

    } else if (type == Type.LIST) {
        return parseList(buffer, cursor);

    } else if (type == Type.STRING) {
        return parseText(buffer, cursor);
    }

    throw type + ' not implemented (yet)';
}

function parseDescriptor(buffer, cursor) {

    let classIDName;
    ({value: classIDName, cursor} = parseText(buffer, cursor));

    const length = buffer.readUInt32BE(cursor);
    cursor += 4;
    const classID = length == 0 ?
        buffer.toString('utf8', cursor, cursor += 4) :
        buffer.toString('utf8', cursor, cursor += length);

    const itemCount = buffer.readUInt32BE(cursor);
    cursor += 4;

    const items = {};
    for (let i = 0; i < itemCount; i++) {
        const length = buffer.readUInt32BE(cursor);
        cursor += 4;

        const key = length == 0 ?
            buffer.toString('utf8', cursor, cursor += 4) :
            buffer.toString('utf8', cursor, cursor += length);

        const type = buffer.toString('utf8', cursor, cursor += 4);

        let value;
        ({value, cursor} = parseType(buffer, cursor, type));

        items[key] = new MapItem(key, type, value);
    }

    return new ReturnValue(new Descriptor(classIDName, classID, items), cursor);
}

function parsePSD(file) {
    const stream = fs.createReadStream(file);

    let firstChunk = true;
    stream.on('data', chunk => {
        if (firstChunk) {
            firstChunk = false;

            const signature = chunk.toString('utf8', 0, 4);
            const isPSD = signature == PSD_SIGNATURE;
            if (!isPSD) {
                throw 'file is no PNG';
            }

            const header = parseHeader(chunk);
            console.log(header);

            const resourcesIndex = parseResources(chunk);

            if (resourcesIndex[1075]) {
                const {value: timeline} = parseTimeline(chunk, resourcesIndex[1075]);
                console.log(timeline);
            }
        }
    });

    stream.on('end', () => {

    });
}

parsePSD('test-2.psd');
