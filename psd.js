const fs = require('fs');

const PSD_SIGNATURE = '8BPS';
const BLOCK_SIGNATURE = '8BIM';

const HEADER_LENGTH = 26;

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

class SectionMarkers {
    constructor(start, end, length, offsetNext, buffering) {
        this.start = start;
        this.end = end;
        this.length = length;
        this.offsetNext = offsetNext;
        this.buffering = buffering;

        Object.freeze(this);
    }
}

class SectionResult {
    constructor(ready, usedChunkLength, data) {
        this.ready = ready;
        this.usedChunkLength = usedChunkLength;
        this.data = data;

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

function indexResources(buffer, start, end) {
    const index = {};
    let cursor = start;

    while (cursor + 1 < end) {

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

function parseHeader(buffer) {

    checkSignature(buffer);

    const header = new Header({
        version: buffer.readUInt16BE(4),
        channels: buffer.readUInt16BE(12),
        height: buffer.readUInt32BE(14),
        width: buffer.readUInt32BE(18),
        depth: buffer.readUInt16BE(22),
        color: buffer.readUInt16BE(24)
    });

    if (header.version != 1) {
        throw `version ${header.version} not supported (yet)`;
    }

    return header;
}

function parseResources(buffer, length, offset) {

    const start = offset || 0;
    const index = indexResources(buffer, start + 4, length || buffer.length);

    const resources = {};

    if (index[Resource.LAYER_STATE]) {
        resources.targetLayerIndex = parseLayerStateBlock(buffer, index[Resource.LAYER_STATE]);
    }
    if (index[Resource.LAYERS_GROUP]) {
        resources.layersGroupInfo = parseLayersGroupBlock(buffer, index[Resource.LAYERS_GROUP]);
    }

    if (index[Resource.LAYER_COMPS]) {
        ({value: resources.layerComps} = parseDescriptorBlock(buffer, index[Resource.LAYER_COMPS]));
    }

    if (index[Resource.MEASUREMENT]) {
        ({value: resources.measurementScale} = parseDescriptorBlock(buffer, index[Resource.MEASUREMENT]));
    }

    if (index[Resource.TIMELINE]) {
        ({value: resources.timeline} = parseDescriptorBlock(buffer, index[Resource.TIMELINE]));
    }

    if (index[Resource.SHEET_DISCLOSURE]) {
        ({value: resources.sheetDisclosure} = parseDescriptorBlock(buffer, index[Resource.SHEET_DISCLOSURE]));
    }

    if (index[Resource.ONION_SKINS]) {
        ({value: resources.onionSkins} = parseDescriptorBlock(buffer, index[Resource.ONION_SKINS]));
    }

    if (index[Resource.PRINT_INFO]) {
        ({value: resources.printInfo} = parseDescriptorBlock(buffer, index[Resource.PRINT_INFO]));
    }

    if (index[Resource.PRINT_STYLE]) {
        ({value: resources.printStyle} = parseDescriptorBlock(buffer, index[Resource.PRINT_STYLE]));
    }

    if (index[Resource.PATH_SELECTION]) {
        ({value: resources.selectionState} = parseDescriptorBlock(buffer, index[Resource.PATH_SELECTION]));
    }

    if (index[Resource.ORIGIN_PATH]) {
        ({value: resources.originPathInfo} = parseDescriptorBlock(buffer, index[Resource.ORIGIN_PATH]));
    }

    return resources;
}

function parseLayerMaskInfo(buffer, length, offset) {
    const start = offset || 0;
    const max = length || buffer.length;

    console.log(buffer.readUInt32BE(0));
}

function getSectionMarkers(buffer, offset) {
    const start = offset || 0;
    const length = buffer.readUInt32BE(start);
    const end = start + length;
    const offsetNext = end % 2 == 0 ? 0 : 1;
    const buffering = end > buffer.length;

    return new SectionMarkers(start, end, length, offsetNext, buffering);
}

const State = Object.freeze({
    NEXT: 1, HEADER: 2, RESOURCES: 3, LAYER_MASK: 4, READY: 5
});

function checkSignature(buffer) {
    const signature = buffer.toString('utf8', 0, 4);
    const isPSD = signature == PSD_SIGNATURE;
    if (!isPSD) {
        throw 'file is no PNG';
    }
}

const parsedData = {};

function parsePSD(file) {
    const stream = fs.createReadStream(file);

    let temp;
    let bufferLength;

    let section;
    let markers;
    let cursor;

    let state = State.NEXT;

    let headerQueued = true;
    let resourcesQueued = true;
    let layerMaskQueued = true;

    function sectionReady(key, result, currentBuffer) {
        parsedData[key] = result.data;

        state = State.NEXT;
        const byteOffset = bufferLength - currentBuffer.length + result.usedChunkLength + markers.offsetNext;
        const buffer = Buffer.from(currentBuffer.buffer, byteOffset, bufferLength - byteOffset);

        if (buffer.length < 4) {
            temp = buffer;
        } else {
            nextSection(buffer);
        }
    }

    function nextSection(chunk) {

        if (headerQueued) {
            headerQueued = false;
            state = State.HEADER;

            const result = startSection(chunk, parseHeader,
                new SectionMarkers(0, HEADER_LENGTH, HEADER_LENGTH, 4, chunk.length < HEADER_LENGTH));
            if (result.ready) {
                sectionReady('header', result, chunk);
            }

        } else if (resourcesQueued) {
            resourcesQueued = false;
            state = State.RESOURCES;

            const result = startSection(chunk, parseResources);
            if (result.ready) {
                sectionReady('resources', result, chunk);
            }

        } else if (layerMaskQueued) {
            layerMaskQueued = false;
            state = State.LAYER_MASK;

            const unaccountedGap = chunk.readUInt32BE(0);
            let nextChunk;
            if (unaccountedGap === 1) {
                const byteOffset = bufferLength - chunk.length + 4;
                nextChunk = Buffer.from(chunk.buffer, byteOffset, bufferLength - byteOffset);
            } else {
                nextChunk = chunk;
            }

            const result = startSection(nextChunk, parseLayerMaskInfo);
            if (result.ready) {
                sectionReady('layerMaskInfo', result, chunk);
            }

        } else {
            state = State.READY;
            ready(parsedData);
        }
    }

    function startSection(chunk, parseSection, sectionMarkers) {
        markers = sectionMarkers || getSectionMarkers(chunk);
        if (markers.buffering) {
            section = Buffer.allocUnsafe(markers.length);
            cursor = chunk.copy(section);

            return new SectionResult(false);
        }
        const buffer = Buffer.from(chunk.buffer, bufferLength - chunk.length, markers.length);
        return new SectionResult(true, markers.length, parseSection(buffer));
    }

    function resumeSection(chunk, parseSection) {
        if (cursor + chunk.length < markers.length) {
            cursor += chunk.copy(section, cursor);
            return new SectionResult(false);
        }

        const sourceEnd = markers.length - cursor;
        chunk.copy(section, cursor, 0, sourceEnd);

        return new SectionResult(true, sourceEnd, parseSection(section));
    }

    function drainBuffer(chunk) {
        let buffer;
        if (temp) {
            buffer = Buffer.concat([temp, chunk], temp.length + chunk.length);
            temp = undefined;
        } else {
            buffer = chunk;
        }
        bufferLength = buffer.length;

        return buffer;
    }

    stream.on('data', chunk => {
        const buffer = drainBuffer(chunk);

        if (buffer.length < 4) {
            temp = buffer;
            return;
        }

        if (state == State.NEXT) {
            nextSection(buffer);

        } else if (state == State.HEADER) {
            const result = resumeSection(buffer, parseHeader);
            if (result.ready) {
                sectionReady('header', result, buffer);
            }

        } else if (state == State.RESOURCES) {
            const result = resumeSection(buffer, parseResources);
            if (result.ready) {
                sectionReady('resources', result, buffer);
            }

        } else if (state == State.LAYER_MASK) {
            const result = resumeSection(buffer, parseLayerMaskInfo);
            if (result.ready) {
                sectionReady('layerMaskInfo', result, buffer);
            }
        }
    });

    stream.on('end', () => {
        console.log('read all data :)');
    });
}

function ready(data) {
    console.log(`parsed data ready: ${JSON.stringify(data, undefined, 4)}`);
}

parsePSD('test-3.psd');
