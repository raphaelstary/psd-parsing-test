const canvas = document.getElementById('debug-screen');

const screenWidth = canvas.width = innerWidth * devicePixelRatio;
canvas.height = innerHeight * devicePixelRatio;
canvas.style.width = innerWidth + 'px';
canvas.style.height = innerHeight + 'px';

canvas.style.backgroundColor = 'cornflowerblue';

const ctx = canvas.getContext('2d');

Promise.all([

    new Promise(resolve => window.onload = resolve),

    fetch('output.pixeldata').then()
        .then(response => {
            if (response.ok)
                return response.arrayBuffer();

            throw new Error('could not fetch image-data');
        })
])
    .then(values => {
        const NOT_ENOUGH_CHANNELS = false;
        if (NOT_ENOUGH_CHANNELS) {

            const WIDTH = 10;
            const HEIGHT = 10;
            const pxData = new Uint8ClampedArray(values[1]);
            const rgbaPxData = ctx.createImageData(WIDTH, HEIGHT);
            for (let i = 0; i < WIDTH * HEIGHT; i++) {
                rgbaPxData.data[i * 4] = pxData[i * 3];
                rgbaPxData.data[i * 4 + 1] = pxData[i * 3 + 1];
                rgbaPxData.data[i * 4 + 2] = pxData[i * 3 + 2];

                rgbaPxData.data[i * 4 + 3] = 255;
            }
            ctx.putImageData(rgbaPxData, 50, 50);

            return;
        }
        const pxData = new Uint8ClampedArray(values[1]);

        const WIDTH = 640;
        const HEIGHT = 360;
        const imgData = new ImageData(pxData, WIDTH, HEIGHT);

        ctx.putImageData(imgData, 50, 50);
    });



