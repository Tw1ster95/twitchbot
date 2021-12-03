const { config } = require('dotenv');
const functions = require('../functions');
const util = require('../util');

// Database table info
const sql_table = {
    name: 'counters',
	content: '( `name` varchar(32) NOT NULL, `count` int DEFAULT 0, PRIMARY KEY(`name`)) ENGINE = MyISAM  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;'
};

const counters = new Map();

module.exports.OnLoad = async function (client, channels) {
	await util.checkFuncConfig(channels, 'counterfunc', {
		enabled: 'true',
		only_mods: 'true',
		allow_vips: 'true',
		max_length: '15',
		blacklist_name: 'counters'
	});

	var mysqlfunc = functions.get(`mysqlfunc`);
	await mysqlfunc.loadTable(sql_table, channels);

	var blacklistfunc = functions.get(`blacklistfunc`);
	var mysqlfunc = functions.get(`mysqlfunc`);
	var func_config, connection, results, arr;
	for(var i = 0; i < channels.length; i++) {
		arr = new Array();
		func_config = await util.getJsonConfig('counterfunc', channels[i].slice(1));
		connection = await mysqlfunc.connect(null, channels[i]);

		if(blacklistfunc && !(await blacklistfunc.exists(func_config.blacklist_name, connection)))
			await blacklistfunc.create(func_config.blacklist_name, connection);
		
		results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_table.name}`);
		await mysqlfunc.end(connection);
		if(results.length > 0)
			results.forEach(r => arr.push({ name: r.name, count: r.count }));
		counters.set(channels[i], arr);
	}
}

module.exports.OnMessage = async function (config, func_config, client, channel, tags, message) {
    if (message.startsWith(config.prefix)) {
		const logfunc = functions.get(`logfunc`);
        const args = message.slice(1).split(' ');
        var command = args.shift().toLowerCase();
        if(command === 'counters') {
			var str = `Counters available: `;
			var arrCounters = counters.get(channel);
			if(arrCounters.length > 0) {
				arrCounters.forEach(c => str += `${c.name}, `);
				str = str.slice(0, -2);
			}
			else
				str += `None`;
			client.say(channel, `@${tags.username}, ${str}.`);
		}
		else if (command === 'counter') {
			if(isMod(tags)) {
				if(args.length > 0) {
					command = args.shift().toLowerCase();
					if(command === 'add') {
						if(args.length > 0) {
							command = args.shift().toLowerCase();
							if(command.length < counterMaxLength) {
								var arrCounters = counters.get(channel);
								if(!arrCounters.find(element => element.name == command)) {
									var mysqlfunc = functions.get(`mysqlfunc`);
									var connection = await mysqlfunc.connect(null, channel);
									await mysqlfunc.qry(connection, `INSERT INTO ${sql_table.name} (name) VALUES ('${command}')`);
									
									arrCounters.push({ name: command, count: 0 });
									client.say(channel, `@${tags.username}, Added a counter: ${command}`);
									await logfunc.log(`counter`, `${tags.username} added counter ${command}.`, connection);
									
									await mysqlfunc.end(connection);
									counters.set(channel, arrCounters);
								}
								else
									client.say(channel, `@${tags.username}, Couner with name ${command} already exists.`);
							}
							else
								client.say(channel, `@${tags.username}, Counter name can't be longer than ${counterMaxLength} symbols.`);
						}
						else
							client.say(channel, `@${tags.username}, Usage: '!counter <add/del> <name>'.`);
					}
					else if(command === 'del') {
						if(args.length > 0) {
							command = args.shift().toLowerCase();
							var arrCounters = counters.get(channel);
							var foundIndex = arrCounters.findIndex(element => element.name == command);
							if(foundIndex > -1) {
								var mysqlfunc = functions.get(`mysqlfunc`);
								var connection = await mysqlfunc.connect(null, channel);
								await mysqlfunc.qry(connection, `DELETE FROM ${sql_table.name} WHERE name = '${command}'`);
								
								arrCounters.splice(foundIndex, 1);
								client.say(channel, `@${tags.username}, Removed counter: ${command}.`);
								await logfunc.log(`counter`, `${tags.username} removed counter ${command}.`, connection);
								
								await mysqlfunc.end(connection);
								counters.set(channel, arrCounters);
							}
							else
								client.say(channel, `@${tags.username}, Couner with name ${command} was not found.`);
						}
						else
							client.say(channel, `@${tags.username}, Usage: '!counter <add/del> <name>'.`);
					}
					else
						client.say(channel, `@${tags.username}, Usage: '!counter <add/del> <name>'.`);
				}
				else
					client.say(channel, `@${tags.username}, Usage: '!counter <add/del> <name>'.`);
			}
        }
		else if(await hasCounterPerm(tags, func_config)) {
			const mysqlfunc = functions.get(`mysqlfunc`);
			const connection = await mysqlfunc.connect(null, channel);
			
			if(!(await checkBlacklist(tags.username, func_config, connection))) {
				var arrCounters = counters.get(channel);
				if(command.endsWith(`+`)) {
					command = command.slice(0, -1);
					if(command.length > 0) {
						var foundIndex = arrCounters.findIndex(element => element.name == command);
						if(foundIndex > -1) {
							arrCounters[foundIndex].count++;
							client.say(channel, `@${tags.username}, Added 1 ${arrCounters[foundIndex].name} for a total of ${arrCounters[foundIndex].count}`);
							await logfunc.log(`counter`, `${tags.username} added 1 count to counter ${arrCounters[foundIndex].name}.`, connection);
							await mysqlfunc.qry(connection, `UPDATE ${sql_table.name} SET count = ${arrCounters[foundIndex].count} WHERE name = '${arrCounters[foundIndex].name}'`);
							counters.set(channel, arrCounters);
						}
					}
				}
				else if(command.endsWith(`-`)) {
					command = command.slice(0, -1);
					if(command.length > 0) {
						var foundIndex = arrCounters.findIndex(element => element.name == command);
						if(foundIndex > -1) {
							arrCounters[foundIndex].count--;
							client.say(channel, `@${tags.username}, Removed 1 ${arrCounters[foundIndex].name}. Counter is at ${arrCounters[foundIndex].count}`);
							await logfunc.log(`counter`, `${tags.username} removed 1 count to counter ${arrCounters[foundIndex].name}.`, connection);
							await mysqlfunc.qry(connection, `UPDATE ${sql_table.name} SET count = ${arrCounters[foundIndex].count} WHERE name = '${arrCounters[foundIndex].name}'`);
							counters.set(channel, arrCounters);
						}
					}
				}
				else {
					var foundIndex = arrCounters.findIndex(element => element.name == command);
					if(foundIndex > -1)
						client.say(channel, `@${tags.username}, ${arrCounters[foundIndex].name} = ${arrCounters[foundIndex].count}`);
				}
			}
			await mysqlfunc.end(connection);
		}
    }
}

async function checkBlacklist(twitch_name, func_config, connection) {
	const blacklistfunc = functions.get(`blacklistfunc`);
	return (blacklistfunc) ? ((await blacklistfunc.isBlacklisted(twitch_name, func_config.blacklist_name, connection)) ? true : false) : false;
}

async function hasCounterPerm(tags, func_config) {
	if(func_config.only_mods.toLowerCase() == 'true') {
		if(!util.isMod(tags)) {
			if(!(func_config.allow_vips.toLowerCase() == 'true') || !util.isVip(tags))
				return false;
		}
	}
	return true;
}