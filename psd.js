const fs = require('fs');

const testStream = fs.createReadStream('test.psd', {
    start: 0,
    end: 3
});

const PSD_SIGNATURE = '8BPS';

let signature;
testStream.on('data', chunk => {
    signature = chunk.toString();
});

testStream.on('end', () => {
    const isPSD = signature == PSD_SIGNATURE;

    if (isPSD) {
        parsePSD();
    } else {
        throw 'file is no PNG';
    }
});

const COLOR_OFFSET = 26;
const RESOURCES_OFFSET = COLOR_OFFSET + 4;
const LAYER_MASK_INFO_OFFSET = 0;
const IMAGE_OFFSET = 0;

const BLOCK_SIGNATURE = '8BIM';

function parsePSD() {
    const stream = fs.createReadStream('test.psd');

    let headerParsed = false;
    stream.on('data', chunk => {
        if (!headerParsed) {
            headerParsed = true;

            const header = {
                version: chunk.readUInt16BE(4),
                channels: chunk.readUInt16BE(12),
                height: chunk.readUInt32BE(14),
                width: chunk.readUInt32BE(18),
                depth: chunk.readUInt16BE(22),
                color: chunk.readUInt16BE(24)
            };

            const resourcesLength = chunk.readUInt32BE(RESOURCES_OFFSET);
            // for (let i = 4; i < resourcesLength; i++) {
            let i = RESOURCES_OFFSET + 4;
            const max = RESOURCES_OFFSET + resourcesLength;

            const signature = chunk.toString('utf8', i, i += 4);
            if (signature != BLOCK_SIGNATURE) {
                throw 'not a new block';
            }

            const id = chunk.readUInt16BE(i);
            i += 2;

            const nameLength = chunk.readUInt8(i);
            i++;
            let name;
            if (nameLength == 0) {
                i++;
                name = '';
            } else {
                name = chunk.toString('utf8', i, i += nameLength);
            }

            const blockSize = chunk.readUInt32BE(i);
            i+=4;

            i+=blockSize;

            console.log(chunk.toString('utf8', i, i += 4))
            // break;
            // }
        }
    });

    stream.on('end', () => {

    });
}
