const functions = require('../functions');
const util = require('../util');

// Database table info
const sql_table = {
	name: 'blacklists',
	content: '( `twitch_name` varchar(64) NOT NULL, PRIMARY KEY(`twitch_name`)) ENGINE = MyISAM  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;'
};

const OnLoad = async function (client, channels) {
	await util.checkFuncConfig(channels, 'blacklistfunc', {
		enabled: 'true'
	});

	var mysqlfunc = functions.get(`mysqlfunc`);
	await mysqlfunc.loadTable(sql_table, channels);
}

const OnMessage = async function (config, func_config, client, channel, tags, message) {
	if (message.startsWith(config.prefix)) {
		const args = message.slice(1).split(' ');
		const command = args.shift().toLowerCase();
		const logfunc = functions.get(`logfunc`);
		if(command === 'blacklist') {
			if(util.isMod(tags)) {
				if(args.length > 0) {
					const func = args.shift().toLowerCase();
					if(func == 'add' || func == 'remove') {
						if(args.length > 0) {
							const mysqlfunc = functions.get(`mysqlfunc`);
							const connection = await mysqlfunc.connect(null, channel);
							const column = args.shift().toLowerCase();
							var results = await mysqlfunc.qry(connection, `SHOW COLUMNS FROM ${sqltable.name}`);
							
							if(results.find(r => r.Field == column)) {
								if(args.length > 0) {
									var tagged = args.shift().toLowerCase();
									if(tagged[0] == '@')
										tagged = tagged.replace("@", "");
									const viewersinfofunc = functions.get(`viewersinfofunc`);
									const tagged_info = await viewersinfofunc.get(tagged, connection);
									if(tagged_info) {
										var found = false;
										var blacklisted = false;
										results = await mysqlfunc.qry(connection, `SELECT ${key} FROM ${sql_table.name} WHERE twitch_name = '${tagged}'`);
										if(results.length > 0) {
											found = true;
											if(results[0][key] == 1)
												blacklisted = true;
										}

										if(func == 'add') {
											if(blacklisted)
												client.say(channel, `@${tags.username}, User ${tagged} is allready in the ${column} blacklist.`);
											else {
												if(found)
													await mysqlfunc.qry(connection, `UPDATE ${sql_table.name} SET ${column} = 1 WHERE twitch_name = '${tagged}'`);
												else
													await mysqlfunc.qry(connection, `INSERT INTO ${sql_table.name} (twitch_name, ${column}) VALUES ('${tagged}', '1')`);
												
												await logfunc.log(`blacklist`, `${tags.username} added ${tagged} to the ${column} blacklist.`, connection);
												client.say(channel, `@${tags.username}, User ${tagged} was added to the ${column} blacklist.`);
											}
										}
										else {
											if(blacklisted)
												client.say(channel, `@${tags.username}, User ${tagged} is not in the ${column} blacklist.`);
											else {
												if(found) {
													await mysqlfunc.qry(connection, `UPDATE ${sql_table.name} SET ${column} = 0 WHERE twitch_name = '${tagged}'`);
													await logfunc.log(`blacklist`, `${tags.username} removed ${tagged} from the ${column} blacklist.`, connection);
													client.say(channel, `@${tags.username}, User ${tagged} was removed from the ${column} blacklist.`);
												}
												else
													client.say(channel, `@${tags.username}, User ${tagged} was not found in the blacklist database.`);
											}
										}
									}
									else
										client.say(channel, `@${tags.username}, User ${tagged} was not found in the database.`);
								}
								else
									client.say(channel, `@${tags.username}, You need to tag a name to be added to the ${column} blacklist.`);
							}
							else {
								results = await mysqlfunc.qry(connection, `SHOW COLUMNS FROM ${sql_table.name}`);
								var blacklists_str;
								for(var i = 1; i < results.length; i++)
									blacklists_str += (blacklists_str ? (blacklists_str + ',') : '') + results[i].Field;
								client.say(channel, `@${tags.username}, Blacklist tables: ${blacklists_str}`);
							}
							await mysqlfunc.end(connection);
						}
						else
							client.say(channel, `@${tags.username}, Usage !blacklist <add/remove> <blacklist> <username>`);
					}
					else
						client.say(channel, `@${tags.username}, Usage !blacklist <add/remove> <blacklist> <username>`);
				}
				else
					client.say(channel, `@${tags.username}, Usage !blacklist <add/remove> <blacklist> <username>`);
			}
		}
	}
}

const isBlacklisted = async function (twitch_name, table, connection) {
	const mysqlfunc = functions.get(`mysqlfunc`);
	var results = await mysqlfunc.qry(connection, `SELECT ${table} FROM ${sql_table.name} WHERE twitch_name = '${twitch_name}'`);
	if(results.length > 0) {
		if(results[0][table] == 1)
			return true;
	}
	return false;
}

const exists = async function (table, connection) {
	var mysqlfunc = functions.get(`mysqlfunc`);
	var results = await mysqlfunc.qry(connection, `SHOW COLUMNS FROM ${sql_table.name}`);
	if(results.length > 0) {
		if(results.find(r => r.Field == table))
			return true;
	}
	return false;
}

const create = async function (table, connection) {
	var mysqlfunc = functions.get(`mysqlfunc`);
	await mysqlfunc.qry(connection, `ALTER TABLE ${sql_table.name} ADD COLUMN ${table} int NOT NULL DEFAULT 0`);
}

module.exports = { OnLoad, OnMessage, isBlacklisted, exists, create }