const fs = require('fs');

const PSD_SIGNATURE = '8BPS';
const BLOCK_SIGNATURE = '8BIM';

const Offset = Object.freeze({
    COLOR: 26, RESOURCES: 26 + 4, LAYER_MASK_INFO: 0, IMAGE: 0
});

const Resource = Object.freeze({
    LAYER_STATE: 1024,
    LAYERS_GROUP: 1026,
    LAYER_COMPS: 1065,
    MEASUREMENT: 1074,
    TIMELINE: 1075,
    SHEET_DISCLOSURE: 1076,
    ONION_SKINS: 1078,
    COUNT_INFO: 1080,
    PRINT_INFO: 1082,
    PRINT_STYLE: 1083,
    PATH_SELECTION: 1088,
    ORIGIN_PATH: 3000
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

const Unit = Object.freeze({
    ANGLE: '#Ang', DENSITY: '#Rsl', DISTANCE: '#Rlt', NONE: '#Nne', PERCENT: '#Prc', PIXELS: '#Pxl'
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

class EnumeratedItem {
    constructor(type, value) {
        this.type = type;
        this.value = value;

        Object.freeze(this);
    }
}

class UnitItem {
    constructor(type, value) {
        this.type = type;
        this.value = value;

        Object.freeze(this);
    }
}

class EnumeratedRef {
    constructor(name, classID, typeID, value) {
        this.name = name;
        this.classID = classID;
        this.typeID = typeID;
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

function parseID(buffer, cursor) {
    const length = buffer.readUInt32BE(cursor);
    cursor += 4;
    return new ReturnValue(
        length == 0 ? buffer.toString('utf8', cursor, cursor += 4) : buffer.toString('utf8', cursor, cursor += length),
        cursor);
}

function parseEnumerated(buffer, cursor) {
    let type;
    ({value: type, cursor} = parseID(buffer, cursor));

    let value;
    ({value: value, cursor} = parseID(buffer, cursor));

    return new ReturnValue(new EnumeratedItem(type, value), cursor);
}

function parseEnumeratedRef(buffer, cursor) {
    let name;
    ({value: name, cursor} = parseText(buffer, cursor));

    let classID;
    ({value: classID, cursor} = parseID(buffer, cursor));

    let typeID;
    ({value: typeID, cursor} = parseID(buffer, cursor));

    let enumValue;
    ({value: enumValue, cursor} = parseID(buffer, cursor));

    return new ReturnValue(new EnumeratedRef(name, classID, typeID, enumValue), cursor);
}

function parseUnitFloat(buffer, cursor) {
    const type = buffer.toString('utf8', cursor, cursor += 4);

    let value;
    ({value, cursor} = parseDouble(buffer, cursor));

    return new ReturnValue(new UnitItem(type, value), cursor);
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

    } else if (type == Type.ENUMERATED) {
        return parseEnumerated(buffer, cursor);

    } else if (type == Type.UNIT_FLOAT) {
        return parseUnitFloat(buffer, cursor);
    }

    throw type + ' not implemented (yet)';
}

function parseDescriptor(buffer, cursor) {

    let classIDName;
    ({value: classIDName, cursor} = parseText(buffer, cursor));

    let classID;
    ({value: classID, cursor} = parseID(buffer, cursor));

    const itemCount = buffer.readUInt32BE(cursor);
    cursor += 4;

    const items = {};
    for (let i = 0; i < itemCount; i++) {
        let key;
        ({value: key, cursor} = parseID(buffer, cursor));

        const type = buffer.toString('utf8', cursor, cursor += 4);

        let value;
        ({value, cursor} = parseType(buffer, cursor, type));

        items[key] = new MapItem(key, type, value);
    }

    return new ReturnValue(new Descriptor(classIDName, classID, items), cursor);
}

/**
 *
 * @param {Buffer} buffer
 * @param {Block} block
 */
function parseDescriptorBlock(buffer, block) {
    let cursor = block.dataOffset;

    const descriptorVersion = buffer.readUInt32BE(cursor);
    cursor += 4;

    if (descriptorVersion != 16) {
        throw `version ${descriptorVersion} not supported (yet)`;
    }

    return parseDescriptor(buffer, cursor);
}

function parseLayerStateBlock(buffer, block) {
    return buffer.readUInt16BE(block.dataOffset);
}

function parseLayersGroupBlock(buffer, block) {
    let cursor = block.dataOffset;
    const end = cursor + block.dataSize;

    const layersGroupInfo = [];
    while (cursor < end) {
        layersGroupInfo.push(buffer.readUInt16BE(cursor));
        cursor += 2;
    }

    return layersGroupInfo;
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

            if (resourcesIndex[Resource.LAYER_STATE]) {
                const targetLayerIndex = parseLayerStateBlock(chunk, resourcesIndex[Resource.LAYER_STATE]);
                console.log(targetLayerIndex);
            }
            if (resourcesIndex[Resource.LAYERS_GROUP]) {
                const layersGroupInfo = parseLayersGroupBlock(chunk, resourcesIndex[Resource.LAYERS_GROUP]);
                console.log(layersGroupInfo);
            }

            if (resourcesIndex[Resource.LAYER_COMPS]) {
                const {value: layerComps} = parseDescriptorBlock(chunk, resourcesIndex[Resource.LAYER_COMPS]);
                console.log(layerComps);
            }

            if (resourcesIndex[Resource.MEASUREMENT]) {
                const {value: measurementScale} = parseDescriptorBlock(chunk, resourcesIndex[Resource.MEASUREMENT]);
                console.log(measurementScale);
            }

            if (resourcesIndex[Resource.TIMELINE]) {
                const {value: timeline} = parseDescriptorBlock(chunk, resourcesIndex[Resource.TIMELINE]);
                console.log(timeline);
            }

            if (resourcesIndex[Resource.SHEET_DISCLOSURE]) {
                const {value: sheetDisclosure} = parseDescriptorBlock(chunk, resourcesIndex[Resource.SHEET_DISCLOSURE]);
                console.log(sheetDisclosure);
            }

            if (resourcesIndex[Resource.ONION_SKINS]) {
                const {value: onionSkins} = parseDescriptorBlock(chunk, resourcesIndex[Resource.ONION_SKINS]);
                console.log(onionSkins);
            }

            if (resourcesIndex[Resource.PRINT_INFO]) {
                const {value: printInfo} = parseDescriptorBlock(chunk, resourcesIndex[Resource.PRINT_INFO]);
                console.log(printInfo);
            }

            if (resourcesIndex[Resource.PRINT_STYLE]) {
                const {value: printStyle} = parseDescriptorBlock(chunk, resourcesIndex[Resource.PRINT_STYLE]);
                console.log(printStyle);
            }

            if (resourcesIndex[Resource.PATH_SELECTION]) {
                const {value: selectionState} = parseDescriptorBlock(chunk, resourcesIndex[Resource.PATH_SELECTION]);
                console.log(selectionState);
            }

            if (resourcesIndex[Resource.ORIGIN_PATH]) {
                const {value: originPathInfo} = parseDescriptorBlock(chunk, resourcesIndex[Resource.ORIGIN_PATH]);
                console.log(originPathInfo);
            }
        }
    });

    stream.on('end', () => {

    });
}

parsePSD('test-3.psd');
