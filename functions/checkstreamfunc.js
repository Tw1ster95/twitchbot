const functions = require('../functions');
const util = require('../util');

// Database table info
const sql_table = {
    name: 'sessioninfo',
	content: '( `type` varchar(64) NOT NULL, `value` varchar(64) NOT NULL) ENGINE = MyISAM  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;'
};

var streams = new Map();

module.exports.OnLoad = async function (client, channels) {
	await util.checkFuncConfig(channels, 'checkstreamfunc', {
		enabled: 'true',
		check_interval: '5'
	});

	var mysqlfunc = functions.get(`mysqlfunc`);
	await mysqlfunc.loadTable(sql_table, channels);
	
	var config;
	for(var i = 0; i < channels.length; i++) {
		config = await util.getJsonConfig('checkstreamfunc', channels[i].slice(1));
		streams.set(channels[i], {
			setTimer: Number(config.check_interval),
			checkTimer: Number(config.check_interval),
			isLive: false,
			streamStart: null,
			followersCount: null
		});
	};
}

// Check is Stream online task
module.exports.task = function (client, func_config, channel) {
	checkStream(client, func_config, channel);
}

async function checkStream(client, func_config, channel) {
	arrStreamData = streams.get(channel);
	if(arrStreamData) {
		arrStreamData.checkTimer--;
		if(arrStreamData.checkTimer <= 0) {
			arrStreamData.checkTimer = arrStreamData.setTimer;

			const logfunc = functions.get(`logfunc`);
			const config = await util.getJsonConfig('config', channel.slice(1));

			await util.api(`https://api.twitch.tv/helix/search/channels?query=${channel.slice(1)}`, function (err, res, body) {
				if (err) return;
				if(body && body.data) {
					var index = body.data.findIndex(element => element.id == Number(config.streamerID));
					if(index > -1) {
						var data = body.data[index];
						if(data.is_live) {
							if(arrStreamData.isLive == false) {
								logfunc.log(`checkstream`, `Stream went LIVE.`, null, config);
								client.say(channel, `${data.display_name} started a stream: '${data.title}'`);
								arrStreamData.isLive = true;
								
								// New mysql session
								StartNewSQLSession(channel);
							}
							else
								SetStreamInfo(client, channel, config, false);
						}
						else if(arrStreamData.isLive == true) {
							logfunc.log(`checkstream`, `Stream ended.`, null, config);
							client.say(channel, `${data.display_name} ended the stream. See you all next time!'`);
							arrStreamData.isLive = false;
							SetStreamInfo(client, channel, config, true);
						}
						else
							SetStreamInfo(client, channel, config, false);
					}
				}
			});
		}
	}
}

async function StartNewSQLSession(channel) {
	// Clearing Session Info
	var mysqlfunc = functions.get(`mysqlfunc`);
	var connection = await mysqlfunc.connect(null, channel);
	await mysqlfunc.qry(connection, `TRUNCATE TABLE ${sql_table.name}`);
	
	// Adding session info
	var data = [
		['start', (new Date().getTime() / 1000).toString()],
		['followers', '0'],
		['viewers', '0']
	];
	
	for(var i = 0; i < data.length; i++)
		await mysqlfunc.qry(connection, `INSERT INTO ${sql_table.name} (type, value) VALUES ('${data[i][0]}', '${data[i][1]}')`);
	await mysqlfunc.end(connection);
}

async function SetStreamInfo(client, channel, config, end_session) {
	await util.api(`https://api.twitch.tv/helix/users/follows?to_id=${Number(config.streamerID)}`, function (err, res, body) {
		if (err) return;
		if(body)
			UpdateSQLInfo(channel, end_session, body.total);
	});
}

async function UpdateSQLInfo(channel, end_session, follows) {
	const arrViewersInfo = functions.get(`viewersinfofunc`).get();
	const mysqlfunc = functions.get(`mysqlfunc`);
	const connection = await mysqlfunc.connect(null, channel);
	
	const viewers = arrViewersInfo.length || 0;
	const followers = follows || 0;
	
	await mysqlfunc.qry(connection, `UPDATE ${sql_table.name} SET value = '${followers}' WHERE type = 'followers';`);
	await mysqlfunc.qry(connection, `UPDATE ${sql_table.name} SET value = '${viewers}' WHERE type = 'viewers';`);
	if(end_session)
		await mysqlfunc.qry(connection, `INSERT INTO ${sql_table.name} (type, value) VALUES ('end', '${new Date().getTime() / 1000}')`);

	await mysqlfunc.end(connection);
}

module.exports.isLive = function (channel) {
	var arrStreamData = streams.get(channel);
	return arrStreamData.isLive;
}