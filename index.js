const fs = require('fs');

const headerStream = fs.createReadStream('test.png', {
    start: 0,
    end: 7
});

const PNG_MAGIC = new Uint8Array([
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10
]);

const headerBuffer = new Uint8Array(8);
headerStream.on('data', chunk => {
    headerBuffer.set(chunk);
});

headerStream.on('end', () => {
    const isPNG = headerBuffer.every((value, index) => value == PNG_MAGIC[index]);

    if (isPNG) {
        parseBody();
    } else {
        throw 'file is no PNG';
    }
});

function parseBody() {
    const stream = fs.createReadStream('test.png');

    let firstPass = true;

    stream.on('data', (chunk) => {
        if (firstPass) {
            firstPass = false;

            console.log('length: ' + chunk.readUInt32BE(8));
            console.log('length: ' + chunk.toString('utf8', 8 + 4, 8 + 4 + 4));

            console.log('width: ' + chunk.readUInt32BE(8 + 4 + 4));
            console.log('height: ' + chunk.readUInt32BE(8 + 4 + 4 + 4));
            console.log('bit depth: ' + chunk.readUInt8(8 + 4 + 4 + 4 + 4));
            console.log('color: ' + chunk.readUInt8(8 + 4 + 4 + 4 + 4 + 1));
            console.log('compression: ' + chunk.readUInt8(8 + 4 + 4 + 4 + 4 + 1 + 1));
            console.log('filter: ' + chunk.readUInt8(8 + 4 + 4 + 4 + 4 + 1 + 1 + 1));
            console.log('interlace: ' + chunk.readUInt8(8 + 4 + 4 + 4 + 4 + 1 + 1 + 1 + 1));

            console.log('CRC: ' + chunk.readUInt32BE(29));
        }
    });

    stream.on('end', () => console.log('\n' + 'hope this info helps :)'));
}
