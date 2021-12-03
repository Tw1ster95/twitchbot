require('dotenv').config();
const fs = require('fs');
const tmi = require('tmi.js');
const functions = require('./functions');
const util = require('./util');

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

// Twitch on message event
client.on('message', async (channel, tags, message, self) => {
	if(self) return;
	const config = await util.getJsonConfig('config', channel.slice(1));
	functions.OnMessage(config, client, channel, tags, message);
})
// Twitch on viewer join event
.on('join', async (channel, nick) => {
    const config = await util.getJsonConfig('config', channel.slice(1));
	functions.OnJoin(config, client, channel, nick);
})
// Twitch on viewer leave event
.on('part', async (channel, nick) => {
    const config = await util.getJsonConfig('config', channel.slice(1));
	functions.OnPart(config, client, channel, nick);
});

// Task executed every 60 seconds
function taskFunc () {
    functions.task(client, channels);
};
setInterval(taskFunc, 60000);