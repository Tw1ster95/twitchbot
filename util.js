const fs = require('fs');
const fetch = require('node-fetch');

const checkChannelsConfig = async function (channels) {
	var file, defaultConfig = JSON.stringify({prefix: "!",streamerID: ""});
	for(var i = 0; i < channels.length; i++) {
		file = `./channels/${channels[i].slice(1)}/config.json`;
		if(!fs.existsSync(file))
			fs.writeFileSync(file, defaultConfig);
	}
}

const checkFuncConfig = async function (channels, func, defaultConfig) {
	if(func) {
		var jsonDefault = JSON.stringify(defaultConfig);
		var file;
		var configs = Array();
		for(var i = 0; i < channels.length; i++) {
			file = `./channels/${channels[i].slice(1)}/${func}.json`;
			if(!fs.existsSync(file)) {
				fs.writeFileSync(file, jsonDefault)
				configs.push(defaultConfig);
			}
			else {
				var config = await getJsonConfig(func, channels[i].slice(1));
				configs.push(config);
			}
		}
		return configs;
	}
	return null;
}

const getJsonConfig = async function (func, channel) {
	const file = `./channels/${channel}/${func}.json`;
	if(fs.existsSync(file)) {
		const rawdata = fs.readFileSync(file);
		return JSON.parse(rawdata);
	}
	return null;
}

const api = async function (url, callback) {
	await fetch(url, {
		method: 'GET',
		headers: {
            'Client-ID': process.env.CLIENT_ID,
            'Authorization': process.env.BEARER_TOKEN
        }
	})
	.then(res => {
		response = { statusCode: res.status, headers: res.headers };
		return res.json();
	})
	.then(
		data => callback(null, response, data),
		err => callback(err, response, null)
	);
}

const getTimeStr = function (time) {
	var days = 0;
	var hours = 0;
	var minutes = 0;
	var string = ``;
	while (time >= 86400) {
		days++;
		time -= 86400;
	}
	if (days) string += `${days} day` + ((days == 1) ? `` : `s`);
	while (time >= 3600) {
		hours++;
		time -= 3600;
	}
	if (hours) string += ` ${hours} hour` + ((hours == 1) ? `` : `s`);
	while (time >= 60) {
		minutes++;
		time -= 60;
	}
	string += ` ${minutes} minute` + ((minutes == 1) ? `` : `s`);
	return string;
}

const getRngInteger = function (min, max) { return Math.floor(Math.random() *(max - min + 1)) + min; }

const isMod = function (tags) { return (tags['badges'] && (tags['badges'].broadcaster || tags['badges'].moderator)) ? true : false; }
const isVip = function (tags) { return (tags['badges'] && (tags['badges'].vip)) ? true : false; }
const isBroadcaster = function (tags) { return (tags['badges'] && (tags['badges'].broadcaster)) ? true : false; }

module.exports = { checkChannelsConfig, checkFuncConfig, getJsonConfig, api, getTimeStr, getRngInteger, isMod, isVip, isBroadcaster }