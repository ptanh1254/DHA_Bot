require('dotenv').config();
const { Zalo } = require('zca-js');
const { loadCookie } = require('./src/auth/loadCookie');
const { imageMetadataGetter } = require('./src/media/imageMetadataGetter');

(async () => {
    try {
        const zalo = new Zalo({ imageMetadataGetter });
        // Hack to bypass update check error
        zalo.options = { checkUpdate: false };
        
        const cookies = loadCookie();
        await zalo.loginCookie(cookies);
        
        const result = await zalo.api.uploadAttachment(['wheel_test.mp4'], process.env.ZALO_TEST_THREAD_ID || '9424168019446271926', 1);
        console.log("UPLOAD RESULT:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error(e);
    }
})();
