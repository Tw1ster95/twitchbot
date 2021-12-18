require('dotenv').config();
const tmi = require('tmi.js');
const fs = require('fs');
const functions = require('./functions');

var channels = Array();

// Gather channels from /channels/
(async ()=>{
    try {
        fs.readdirSync('./channels/').forEach(f => channels.push(f));
    }
    catch(e) {
        console.error("[main] Error:", e);
    }
})();

// If there are no channels exit
if(channels.length < 1)
    process.exit(1);

// Twitch connection
const client = new tmi.Client({
    options: { debug: true },
    connection: {
        secure: true,
        reconnect: true
    },
    identity: {
        username: process.env.BOT_USERNAME,
        password: process.env.AOUTH_TOKEN
    },
    channels: channels
});
client.connect();

// Load Functions
functions.load(client, channels);

console.log("[main] Bot is running.");

var logfunc = functions.get(`logfunc`);
if(logfunc) {
    for(var i = 0; i < channels; i++)
	    logfunc.log('main', `iRobot360 [RE]started.`, null, channels[i]);
}

// Task executed every 60 seconds
function taskFunc () {
    functions.task(client, channels);
};
setInterval(taskFunc, 60000);