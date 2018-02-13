const fs = require('fs');

const stream = fs.createReadStream('test.png', {
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

const buffer = new Uint8Array(8);

let i = 0;
stream.on('data', (chunk) => {
    buffer.set(chunk, i);
    i += chunk.length;
});

stream.on('end', () => {
    const isPNG = buffer.every((value, index) => value == PNG_MAGIC[index]);
    console.log(isPNG);
});
