const functions = require('../functions');
const util = require('../util');

// Database table info
const sql_table = {
	name: 'timed_messages',
	content: '( `id` int AUTO_INCREMENT, `time` int DEFAULT 300, `message` varchar(128) NOT NULL, PRIMARY KEY(`id`)) ENGINE = MyISAM  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;'
};

const msgs = new Map();

module.exports.OnLoad = async function (client, channels) {
	await util.checkFuncConfig(channels, 'timedmessagesfunc', {
		enabled: 'true'
	});

	var mysqlfunc = functions.get(`mysqlfunc`);
	await mysqlfunc.loadTable(sql_table, channels);

	for(var i = 0; i < channels.length; i++)
		await LoadTimers(channels[i]);
}

async function LoadTimers(channel) {
	var mysqlfunc = functions.get(`mysqlfunc`);
	var connection = await mysqlfunc.connect(null, channel);
	var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_table.name}`);
	await mysqlfunc.end(connection);
	
	msgs.set(channel, Array())
    if(results.length > 0) {
		results.forEach(r => {
			if(!isLoaded(channel, r.id))
				loadTimer(channel, r.id, ((new Date().getTime() / 1000) + (util.getRngInteger(1, r.time) * 60)));
		});
	}
}

module.exports.task = function(func_config, client, channel) {
	const checkstreamfunc = functions.get(`checkstreamfunc`);
	if(checkstreamfunc.isLive(channel))
		CheckAllTimers(client, channel);
}

async function CheckAllTimers(client, channel) {
	var arrMsgs = msgs.get(channel);
	if(arrMsgs.length > 0) {
		const time = new Date().getTime() / 1000;
		const mysqlfunc = functions.get(`mysqlfunc`);
		var results, connection;
		
		for(var i=0; i < arrMsgs.length; i++) {
			if(time >= arrMsgs[i].time) {
				connection = await mysqlfunc.connect(null, channel);
				results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_table.name} WHERE id = ${arrMsgs[i].id}`);
				if(results.length > 0) {
					client.say(channel, results[0].message);
					arrMsgs[i].time = ((new Date().getTime() / 1000) + (results[0].time * 60));
				}
				else {
					arrMsgs.splice(i, 1);
					i--;
				}
				await mysqlfunc.end(connection);
			}
		}
	}
}

module.exports.OnMessage = async function (config, func_config, client, channel, tags, message) {
    if(message.startsWith(config.prefix)) {
        const args = message.slice(1).split(` `);
        var command = args.shift().toLowerCase();
        if(command === 'msgtimer') {
			if(util.isBroadcaster(tags)) {
				if(args.length > 0) {
					command = args.shift().toLowerCase();
					if(command === 'add') {
						if(args.length > 0) {
							command = args.shift().toLowerCase();
							var minutes = Number(command);
							if(Number.isInteger(minutes) && minutes >= 0) {
								if(args.length > 0) {
									var timer_msg = args.join(` `);
									var mysqlfunc = functions.get(`mysqlfunc`);
									var connection = await mysqlfunc.connect();
									await mysqlfunc.qry(connection, `INSERT INTO ${sql_table.name} (time, message) VALUES (${minutes}, '${timer_msg}')`);
									
									client.say(channel, `@${tags.username}, Added a message timer ${minutes} minutes: ${timer_msg}`);
									await logfunc.log(`timedmessages`, `${tags.username} added message timer every ${minutes} minutes: ${timer_msg}.`, connection);
									await mysqlfunc.end(connection);
									LoadTimers();
								}
								else
									client.say(channel, `@${tags.username}, Usage: '!msgtimer add <minutes> <message>'.`);
							}
							else
								client.say(channel, `@${tags.username}, Timer minutes has to be a positive number.`);
						}
						else
							client.say(channel, `@${tags.username}, Usage: '!msgtimer add <minutes> <message>'.`);
					}
					else if(command === 'del') {
						if(args.length > 0) {
							var timer_msg = args.join(` `);
							var mysqlfunc = functions.get(`mysqlfunc`);
							var connection = await mysqlfunc.connect();
							var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_table.name}`);
							
							if(results.length > 0) {
								var count = 0;
								for(var i=0; i < results.length; i++) {
									if(results[i].message.includes(timer_msg)) {
										count++;
										await mysqlfunc.qry(connection, `DELETE FROM ${sql_table.name} WHERE id = ${results[i].id}`);
										unloadTimer(channel, getMsgFromID(channel, results[i].id));
									}
								}
								if(count > 0) {
									client.say(channel, `@${tags.username}, Removed ${count} timed messages containing: ${timer_msg}`);
									await logfunc.log(`timedmessages`, `${tags.username} removed ${count} timed messages containing: £{timer_msg}`, connection);
								}
							}
							else
								client.say(channel, `@${tags.username}, No timed messages found containing: ${timer_msg}`);
							
							await mysqlfunc.end(connection);
							
						}
						else
							client.say(channel, `@${tags.username}, Usage: '!msgtimer del <part of message>'.`);
					}
					else
						client.say(channel, `@${tags.username}, Usage: '!msgtimer <add/del>'.`);
				}
				else
					client.say(channel, `@${tags.username}, Usage: '!msgtimer <add/del>'.`);
			}
        }
    }
}

function isLoaded(channel, msg_id) {
	const arrMsgs = msgs.get(channel);
	return (arrMsgs.find(element => element.id == msg_id)) ? true : false;
}

function loadTimer(channel, id, time) {
	const arrMsgs = msgs.get(channel);
	arrMsgs.push({ id: id, time: time });
}

function unloadTimer(channel, i) {
	const arrMsgs = msgs.get(channel);
	arrMsgs.splice(i, 1);
}

function getMsgFromID(msg_id) {
	const arrMsgs = msgs.get(channel);
	return arrMsgs.find(element => element.id == msg_id);
}