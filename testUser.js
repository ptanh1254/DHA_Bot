require("dotenv").config({ path: ".env" });
const { Zalo } = require("zca-js");
const { loadCookie } = require("./src/auth/loadCookie");

async function run() {
    try {
        const api = await new Zalo({ selfListen: true, checkUpdate: true, logging: false }).login({ cookie: loadCookie(), imei: process.env.ZALO_IMEI, userAgent: process.env.ZALO_USER_AGENT });
        
        const gInfo = await api.getGroupInfo("949266396692033934");
        const gridInfoMap = gInfo?.gridInfoMap || {};
        const groupInfo = gridInfoMap["949266396692033934"] || Object.values(gridInfoMap)[0];
        
        if (groupInfo && groupInfo.memVerList && groupInfo.memVerList.length > 0) {
            const uid = groupInfo.memVerList[0].split("_")[0];
            console.log("Fetching info for UID:", uid);
            const uInfo = await api.getUserInfo(uid);
            console.log(JSON.stringify(uInfo, null, 2));
        }
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
run();
