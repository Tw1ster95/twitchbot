const functions = require('../functions');
const util = require('../util');

// Database table info
const sql_table = {
	name: 'simplecmds',
	content: '( `command` varchar(32) NOT NULL, `text` varchar(256), alias int DEFAULT 0, PRIMARY KEY(`command`)) ENGINE = MyISAM  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;'
};

// Banned command names that can't be used for creating commands
const bannedCmdNames = [
	'!iqshop', '!iqstore', '!iq', '!addiq', '!takeiq',
	'!topiq', '!commands', '!aliases', '!addcom', '!delcom',
	'!editcom', '!addalias', '!delalias', '!gw', '!giveaway',
	'!blacklist', '!iq', '!points', '!dice', '!followage',
	'!ticket', '!tickets', '!game', '!shop', '!store',
	'!magazin', '!uptime', '!watchtime', '!msgtimer'
];

const cmds = new Map();

module.exports.OnLoad = async function (client, channels) {
	await util.checkFuncConfig(channels, 'simplecmdfunc', {
		enabled: 'true'
	});

	var mysqlfunc = functions.get(`mysqlfunc`);
	await mysqlfunc.loadTable(sql_table, channels);
	
	var connection, results, arrCmds;
	for(var i = 0; i < channels.length; i++) {
		arrCmds = Array();
		connection = await mysqlfunc.connect(null, channels[i]);
		results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_table.name}`);
		await mysqlfunc.end(connection);
		if(results.length > 0)
			results.forEach(r => arrCmds.push({ cmd: r.command, alias: r.alias }));
		cmds.set(channels[i], arrCmds);
	}
}

module.exports.OnMessage = async function (config, func_config, client, channel, tags, message) {
	const mysqlfunc = functions.get(`mysqlfunc`);
	const logfunc = functions.get(`logfunc`);
	
	var arrCmds = cmds.get(channel);
	const found = arrCmds.find(e => e.cmd == message);
	
	if(found) {
		var connection = await mysqlfunc.connect(null, channel);
		var results;
		if(found.alias == 1) {
			results = await mysqlfunc.qry(connection, `SELECT text FROM ${sql_table.name} WHERE command = '${found.cmd}'`);
			results = await mysqlfunc.qry(connection, `SELECT text FROM ${sql_table.name} WHERE command = '${results[0].text}'`);
		}
		else
			results = await mysqlfunc.qry(connection, `SELECT text FROM ${sql_table.name} WHERE command = '${found.cmd}'`);
		
		if(results.length > 0)
			client.say(channel, `@${tags.username}, ${results[0].text}`);
		
		await mysqlfunc.end(connection);
	}
	else if(message.startsWith(config.prefix)) {
		const args = message.slice(1).split(' ');
		const command = args.shift().toLowerCase();
		if(command === 'commands')
			client.say(channel, `@${tags.username}, ${listCmds(arrCmds, false)}.`);
		else if(command === 'aliases')
			client.say(channel, `@${tags.username}, ${listCmds(arrCmds, true)}.`);
		else if(util.isMod(tags)) {
			if(command === 'addcom') {
				if(args.length > 0) {
					const arg_cmd = args.shift().toLowerCase();
					if(!isBannedCmd(arg_cmd)) {
						if(!isCommand(arg_cmd)) {
							const cmd_execute = message.slice(command.length + arg_cmd.length + 3);
							if(cmd_execute.length > 0) {
								var connection = await mysqlfunc.connect(null, channel);
								await mysqlfunc.qry(connection, `INSERT INTO ${sql_table.name} (command, text) VALUES ('${arg_cmd}', '${cmd_execute}')`);
								arrCmds.push({ cmd: arg_cmd, alias: 0 });
								client.say(channel, `@${tags.username}, Adding command ${arg_cmd} for ${cmd_execute}`);
								await logfunc.log(`simplecmd`, `${tags.username} added command ${arg_cmd} for ${cmd_execute}.`, connection);
								await mysqlfunc.end(connection);
								cmds.set(channel, arrCmds);
							}
							else
								client.say(channel, `@${tags.username}, Failed to add command '${arg_cmd}'. Response to the command is needed.`);
						}
						else
							client.say(channel, `@${tags.username}, Command or Alias with name '${arg_cmd}' allready exists.`);
					}
					else
						client.say(channel, `@${tags.username}, Command ${arg_cmd} is being used for something else.`);
				}
				else
					client.say(channel, `@${tags.username}, Usage: '!addcom <command> <response>'.`);
			}
			else if(command === 'editcom') {
				if(args.length > 0) {
					const arg_cmd = args.shift().toLowerCase();
					if(isCommand(arg_cmd)) {
						const cmd_execute = message.slice(command.length + arg_cmd.length + 3);
						if(cmd_execute.length > 0) {
							var connection = await mysqlfunc.connect(null, channel);
							await mysqlfunc.qry(connection, `UPDATE ${sql_table.name} SET text = '${cmd_execute}' WHERE command = '${arg_cmd}'`);
							client.say(channel, `@${tags.username}, Command ${arg_cmd} was edited successfuly.`);
							await logfunc.log(`simplecmd`, `${tags.username} edited command ${arg_cmd} to ${cmd_execute}.`, connection);
							await mysqlfunc.end(connection);
						}
						else
							client.say(channel, `@${tags.username}, Failed to edit command '${arg_cmd}'. New response to the command is needed.`);
					}
					else
						client.say(channel, `@${tags.username}, Command with name '${arg_cmd}' doesn't exist.`);
				}
				else
					client.say(channel, `@${tags.username}, Usage: '!editcom <command> <response>'.`);
			}
			else if(command === 'delcom') {
				if(args.length > 0) {
					const arg_cmd = args.shift().toLowerCase();
					if(isCommand(arg_cmd)) {
						var connection = await mysqlfunc.connect(null, channel);
						await mysqlfunc.qry(connection, `DELETE FROM ${sql_table.name} WHERE command = '${arg_cmd}'`);
						var cmdIndex = arrCmds.findIndex(e => (e.cmd == arg_cmd && !e.alias));
						if(cmdIndex > -1)
							arrCmds.splice(cmdIndex, 1);
						
						client.say(channel, `@${tags.username}, Command ${arg_cmd} removed.`);
						functions.get(`logfunc`).log(`simplecmd`, `${tags.username} removed command ${arg_cmd}.`);

						// Delete all aliases aswell
						var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_table.name} WHERE text = '${arg_cmd}' AND alias = 1`);
						if(results.length > 0) {
							var qry = '';
							for(var i = 0; i < results.length; i++) {
								cmdIndex = arrCmds.findIndex(e => e.cmd == results[i].command);
								if(cmdIndex > -1)
									arrCmds.splice(cmdIndex, 1);
								qry += `DELETE FROM ${sql_table.name} WHERE command = '${results[i].command}';`;
								
								client.say(channel, `@${tags.username}, Alias ${results[i].command} removed.`);
								await logfunc.log(`simplecmd`, `Removed alias ${results[i].command} because command ${arg_cmd} was removed.`, connection);
							}
							await mysqlfunc.qry(connection, qry);
						}
						await mysqlfunc.end(connection);
						cmds.set(channel, arrCmds);
					}
					else
						client.say(channel, `@${tags.username}, Command ${arg_cmd} does not exist.`);
				}
				else
					client.say(channel, `@${tags.username}, Usage: '!delcom <command>'.`);
			}
			else if(command === 'addalias') {
				if(args.length > 0) {
					const arg_cmd = args.shift().toLowerCase();
					if(!isBannedCmd(arg_cmd)) {
						if(!isCommand(arg_cmd) && !isAlias(arg_cmd)) {
							const cmd_alias = message.slice(command.length + arg_cmd.length + 3);
							if(cmd_alias.length > 0) {
								if(isCommand(cmd_alias)) {
									var connection = await mysqlfunc.connect(null, channel);
									await mysqlfunc.qry(connection, `INSERT INTO ${sql_table.name} (command, text, alias) VALUES ('${arg_cmd}', '${cmd_alias}', 1)`);
									arrCmds.push({ cmd: arg_cmd, alias: 1 });
									client.say(channel, `@${tags.username}, Adding alias ${arg_cmd} for command ${cmd_alias}`);
									await logfunc.log(`simplecmd`, `${tags.username} added alias ${arg_cmd} for ${cmd_alias}.`, connection);
									await mysqlfunc.end(connection);
									cmds.set(channel, arrCmds);
								}
								else
									client.say(channel, `@${tags.username}, Failed to add alias '${arg_cmd}'. Command ${cmd_alias} given for the alias was not found.`);
							}
							else
								client.say(channel, `@${tags.username}, Failed to add alias '${arg_cmd}'. Another existing command needs to be given.`);
						}
						else
							client.say(channel, `@${tags.username}, Command or Alias ${arg_cmd} allready exists.`);
					}
					else
						client.say(channel, `@${tags.username}, Command ${arg_cmd} is being used for something else.`);
				}
				else
					client.say(channel, `@${tags.username}, Usage: '!addalias <alias> <command>'.`);
			}
			else if(command === 'delalias') {
				if(args.length > 0) {
					const arg_cmd = args.shift().toLowerCase();
					if(isAlias(arg_cmd)) {
						var connection = await mysqlfunc.connect(null, channel);
						await mysqlfunc.qry(connection, `DELETE FROM ${sql_table.name} WHERE command = '${arg_cmd}' AND alias = 1`);
						var cmdIndex = arrCmds.findIndex(e => e.cmd == arg_cmd);
						if(cmdIndex > -1)
							arrCmds.splice(cmdIndex, 1);
						client.say(channel, `@${tags.username}, Alias ${arg_cmd} removed.`);
						await logfunc.log(`simplecmd`, `${tags.username} removed alias ${arg_cmd}.`, connection);
						await mysqlfunc.end(connection);
						cmds.set(channel, arrCmds);
					}
					else
						client.say(channel, `@${tags.username}, Alias ${arg_cmd} does not exist.`);
				}
				else
					client.say(channel, `@${tags.username}, Използване: '!delalias <alias>'.`);
			}
		}
	}
}

function listCmds(arrCmds, alias) {
	var filter_cmds = arrCmds.filter(e => e.alias == alias);
	if(filter_cmds.length > 0) {
		var str = '';
		filter_cmds.forEach(e => str += (str ? ', ' : '') + e.cmd);
		return str;
	}
	return 'None';
}

function isBannedCmd(cmd) { return (bannedCmdNames.find(e => e == cmd)) ? true : false; }
function isCommand(cmd) { return (arrCmds.find(e => (e.cmd == cmd && !e.alias))) ? true : false; }
function isAlias(cmd) { return (arrCmds.find(e => (e.cmd == cmd && e.alias))) ? true : false; }