const functions = require('../functions');
const util = require("../util");

// Database table info
const sql_table = {
    name: 'userinfo',
	content: '( `twitch_name` varchar(64) NOT NULL, `userid` int(11) DEFAULT 0, `bot` int(11) DEFAULT 0, `has_followed` int(11) DEFAULT 0, `has_subscribed` int(11) DEFAULT 0, `subs_gifted` int(11) DEFAULT 0, PRIMARY KEY(`twitch_name`)) ENGINE = MyISAM  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;'
};

const viewers = new Map();

const OnLoad = async function (client, channels) {
	await util.checkFuncConfig(channels, 'viewersinfofunc', {
		enabled: 'true'
	});

	var mysqlfunc = functions.get(`mysqlfunc`);
	await mysqlfunc.loadTable(sql_table, channels);

	for(var i = 0; i < channels.length; i++)
		viewers.set(channels[i], Array());
}

const OnJoin = async function (config, func_config, client, channel, nick) {
	const arrViewersInfo = viewers.get(channel);
	if(arrViewersInfo && !arrViewersInfo.find(v => v.twitch_name == nick)) {
		const mysqlfunc = functions.get(`mysqlfunc`);
		const connection = await mysqlfunc.connect(null, channel);
		const results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_table.name} WHERE twitch_name = '${nick}'`);
		if(results.length > 0)
			arrViewersInfo.push(results[0]);
		else {
			await mysqlfunc.qry(connection, `INSERT INTO ${sql_table.name} (twitch_name) VALUES ('${nick}')`);
			arrViewersInfo.push({twitch_name: nick});
		}
		const logfunc = functions.get(`logfunc`);
		await logfunc.log(`viewersinfo`, `${nick} joined the stream.`, connection);
		await mysqlfunc.end(connection);
	}
}

const OnPart = async function (config, func_config, client, channel, nick) {
	const arrViewersInfo = viewers.get(channel);
	const vIndex = arrViewersInfo.findIndex(v => v.twitch_name == nick);
	arrViewersInfo.splice(vIndex, 1);
	const logfunc = functions.get(`logfunc`);
	await logfunc.log(`viewersinfo`, `${nick} left the stream.`, null, channel);
}

const get = async function getViewerInfo(twitch_name, channel) {
	const arrViewersInfo = viewers.get(channel);
	if(twitch_name) {
		const info = arrViewersInfo.find(v => v.twitch_name == twitch_name);
		if(info)
			return info;
		else {
			const mysqlfunc = functions.get(`mysqlfunc`);
			const connection = await mysqlfunc.connect(null, channel);
			const results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_table.name} WHERE twitch_name = '${twitch_name}'`);
			if(results.length > 0) {
				arrViewersInfo.push(results[0]);
				await mysqlfunc.end(connection);
				return arrViewersInfo[arrViewersInfo.length-1];
			}
			else {
				await mysqlfunc.qry(connection, `INSERT INTO ${sql_table.name} (twitch_name) VALUES ('${twitch_name}')`);
				arrViewersInfo.push({twitch_name: twitch_name});
				await mysqlfunc.end(connection);
				return { twitch_name: twitch_name };
			}
		}
	}
	else
		return arrViewersInfo;
}

const set = async function setViewerInfo(twitch_name, channel, arrData) {
	const arrViewersInfo = viewers.get(channel);
	const vIndex = arrViewersInfo.findIndex(v => v.twitch_name == twitch_name);
	if(vIndex > -1)
		for(const [key, value] of Object.entries(arrData))
			arrViewersInfo[vIndex][key] = value;
	else {
		const mysqlfunc = functions.get(`mysqlfunc`);
		const connection = await mysqlfunc.connect(null, channel);
		const results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_table.name} WHERE twitch_name = '${twitch_name}'`);
		await mysqlfunc.end(connection);
		for(const [key, value] of Object.entries(arrData))
			results[0][key] = value;
		arrViewersInfo.push(results[0]);
	}
}

module.exports = { OnLoad, OnJoin, OnPart, get, set }