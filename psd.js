const fs = require('fs');

const PSD_SIGNATURE = '8BPS';
const BLOCK_SIGNATURE = '8BIM';

const COLOR_OFFSET = 26;
const RESOURCES_OFFSET = COLOR_OFFSET + 4;
const LAYER_MASK_INFO_OFFSET = 0;
const IMAGE_OFFSET = 0;

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
    if (buffer.length < COLOR_OFFSET) {
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
    constructor(id, name, size) {
        this.id = id;
        this.name = name;
        this.size = size;

        Object.freeze(this);
    }
}

function parseResources(buffer) {
    const index = {};

    const resourcesLength = buffer.readUInt32BE(RESOURCES_OFFSET);

    let cursor = RESOURCES_OFFSET + 4;

    const max = RESOURCES_OFFSET + resourcesLength;

    if (max > buffer.length) {
        throw 'handling multiple chunks for parsing Image Resources not implemented yet';
    }

    while (cursor + 1 < max) {

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

        cursor += blockSize % 2 == 0 ? blockSize : blockSize + 1;

        index[id] = new Block(id, name, blockSize);
    }

    return index;
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
            console.log(resourcesIndex);
        }
    });

    stream.on('end', () => {

    });
}

parsePSD('test.psd');
