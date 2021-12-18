const functions = require('../functions');
const util = require('../util');

// Database table info
const sql_tables = {
	main: {
        name: 'giveaway',
        content: '( `id` int(11) AUTO_INCREMENT, `name` varchar(64) NOT NULL, `time` int(11) NOT NULL, `status` varchar(16) NOT NULL, `cost` int(11) NOT NULL, `free_entry` int(11) NOT NULL, `limit_entry` int(11) NOT NULL, PRIMARY KEY(`id`)) ENGINE = MyISAM  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;'
    },
    entries: {
        name: 'giveaway_entries',
        content: '( `id` int(11) AUTO_INCREMENT, `name` varchar(64) NOT NULL, `winner` int(11) DEFAULT 0, PRIMARY KEY(`id`)) ENGINE = MyISAM  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;'
    }
};

const arrGwEndTime = Array();

const OnLoad = async function (client, channels) {
	await util.checkFuncConfig(channels, 'giveawayfunc', {
		enabled: 'true'
	});

	var mysqlfunc = functions.get(`mysqlfunc`);
	await mysqlfunc.loadTable(sql_tables.main, channels);
	await mysqlfunc.loadTable(sql_tables.entries, channels);

	var connection;
	for(var i = 0; i < channels.length; i++) {
		connection = await mysqlfunc.connect(null, channels[i]);
		var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_tables.main.name} WHERE status = 'running'`);
		if(results.length > 0)
			arrGwEndTime.push({ channel: channel, time: results[0].time });
		await mysqlfunc.end(connection);
	}
}

const OnMessage = async function (config, func_config, client, channel, tags, message) {
    if(message.startsWith(config.prefix)) {
		const mysqlfunc = functions.get(`mysqlfunc`);
		const logfunc = functions.get(`logfunc`);
		
        const args = message.slice(1).split(' ');
		var gw_name = message.slice(1);
        var command = args.shift().toLowerCase();
        if(command === 'giveaway' || command === 'gw') {
			gw_name = gw_name.slice(command.length+1);
			if(args.length > 0) {
				if(util.isBroadcaster(tags)) {
					command = args.shift().toLowerCase();
					if(command === 'add') {
						gw_name = gw_name.slice(command.length+1);
						if(args.length > 0) {
							command = args.shift().toLowerCase();
							var time = Number(command);
							if(Number.isInteger(time) && time >= 0) {
								gw_name = gw_name.slice(command.length+1);
								if(args.length > 0) {
									command = args.shift().toLowerCase();
									var cost = Number(command);
									if(Number.isInteger(cost) && cost >= 0) {
										gw_name = gw_name.slice(command.length+1);
										if(args.length > 0) {
											command = args.shift().toLowerCase();
											var free = Number(command);
											if(Number.isInteger(free) && free >= 0) {
												gw_name = gw_name.slice(command.length+1);
												if(args.length > 0) {
													command = args.shift().toLowerCase();
													var limit = Number(command);
													if(Number.isInteger(limit) && limit >= 0) {
														gw_name = gw_name.slice(command.length+1);
														if(gw_name.length > 0) {
															var connection = await mysqlfunc.connect(null, channel);
															var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_tables.main.name} WHERE status = 'running' OR status = 'stopped'`);
															if(!results.length) {
																gwEndTime = getTimeEnd(time);
																await mysqlfunc.qry(connection, `INSERT INTO ${sql_tables.main.name} (name, time, status, cost, free_entry, limit_entry) VALUES ('${gw_name}', ${gwEndTime}, 'running', ${cost}, ${free}, ${limit})`);
																
																await logfunc.log('giveaway', `${tags.username} started giveaway: ${gw_name}.`, connection);
																client.say(channel, `@${tags.username}, Giveaway started: ${gw_name}`);
															}
															else
																client.say(channel, `@${tags.username}, There's still an active Giveaway.`);
															await mysqlfunc.end(connection);
														}
														else
															client.say(channel, `@${tags.username}, Usage: !giveaway add <time> <cost> <free> <limit> <name>.`);
													}
													else
														client.say(channel, `@${tags.username}, Limit for tickets must be a positive number or 0 for unlimited.`);
												}
												else
													client.say(channel, `@${tags.username}, Usage: !giveaway add <time> <cost> <free> <limit> <name>.`);
											}
											else
												client.say(channel, `@${tags.username}, Number of free tickets must be a positive number or 0 for none.`);
										}
										else
											client.say(channel, `@${tags.username}, Usage: !giveaway add <time> <cost> <free> <limit> <name>.`);
									}
									else
										client.say(channel, `@${tags.username}, Ticket cost must be a positive number or 0 for free.`);
								}
								else
									client.say(channel, `@${tags.username}, Usage: !giveaway add <time> <cost> <free> <limit> <name>.`);
							}
							else
								client.say(channel, `@${tags.username}, Giveaway time must be a positive number in minutes or 0 for unlimited.`);
						}
						else
							client.say(channel, `@${tags.username}, Usage: !giveaway add <time> <cost> <free> <limit> <name>.`);
					}
					else if(command === 'stop') {
						var connection = await mysqlfunc.connect(null, channel);
						var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_tables.main.name} WHERE status = 'running'`);
						if(results.length > 0) {
							await mysqlfunc.qry(connection, `UPDATE ${sql_tables.main.name} SET status = 'stopped' WHERE status = 'running'`);
							
							await logfunc.log('giveaway', `${tags.username} stopped the current giveaway.`, connection);
							client.say(channel, `@${tags.username}, Giveaway ${results[0].name} has been stopped.`);
						}
						else
							client.say(channel, `@${tags.username}, There is no running giveaway to be stopped.`);
						await mysqlfunc.end(connection);
					}
					else if(command === 'close') {
						var connection = await mysqlfunc.connect(null, channel);
						var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_tables.main.name} WHERE status = 'running' OR status = 'stopped'`);
						if(results.length > 0) {
							var id = results[0].id;
							var name = results[0].name;
							if(results[0].status == 'stopped') {
								results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_tables.entries.name} WHERE winner = 1`);
								if(results.length > 0) {
									await mysqlfunc.qry(connection, `UPDATE ${sql_tables.main.name} SET status = 'closed' WHERE id = '${id}'`);
									await mysqlfunc.qry(connection, `TRUNCATE TABLE ${sql_tables.entries.name}`);
									client.say(channel, `@${tags.username}, Giveaway ${name} was closed.`);
									await logfunc.log('giveaway', `${tags.username} closed the current giveaway for ${name}.`, connection);
								}
								else
									client.say(channel, `@${tags.username}, There is no winner drawn for ${name}! You can use '!gw refund' to give back users points or '!gw forceclose'.`);
							}
							else
								client.say(channel, `@${tags.username}, Giveaway ${name} must first be stopped and then closed.`);
						}
						await mysqlfunc.end(connection);
					}
					else if(command === 'refund') {
						var connection = await mysqlfunc.connect(null, channel);
						var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_tables.main.name} WHERE status = 'running' OR status = 'stopped'`);
						if(results.length > 0) {
							var gwName = results[0].name;
							var gwCost = results[0].cost;
							var gwFree = results[0].free_entry;
							
							var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_tables.entries.name}`);
							
							if(results.length > 0) {
								var pointssysfunc = functions.get(`pointssysfunc`);
								var arrEntries = Array();
								var index;
								
								for(var i=0; i < results.length; i++) {
									index = arrEntries.findIndex(e => e.name == results[i].name);
									if(index > -1)
										arrEntries[index].tickets++;
									else
										arrEntries.push({ name: results[i].name, tickets: 1 });
								}
								
								for(var i=0; i < arrEntries.length; i++)
									await pointssysfunc.add(arrEntries[i].name, ((arrEntries[i].tickets - gwFree) * gwCost), connection);
							}
							
							await mysqlfunc.qry(connection, `TRUNCATE TABLE ${sql_tables.entries.name}`);
							
							await logfunc.log('giveaway', `${tags.username} refunded all tickets for giveaway ${gwName}.`, connection);
							client.say(channel, `@${tags.username}, All tickets for the Giveaway ${gwName} were refunded.`);
						}
						else
							client.say(channel, `@${tags.username}, Could not find an active Giveaway.`);
						
						await mysqlfunc.end(connection);
					}
					else if(command === 'forceclose') {
						var connection = await mysqlfunc.connect(null, channel);
						var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_tables.main.name} WHERE status = 'running' OR status = 'stopped'`);
						
						if(results.length > 0) {
							var gwID = results[0].id;
							var gwName = results[0].name;
							
							await mysqlfunc.qry(connection, `UPDATE ${sql_tables.main.name} SET status = 'closed' WHERE id = '${gwID}'`);
							await mysqlfunc.qry(connection, `TRUNCATE TABLE ${sql_tables.entries.name}`);
							
							await logfunc.log('giveaway', `${tags.username} force closed the current giveaway for ${gwName}.`, connection);
							client.say(channel, `@${tags.username}, Giveaway ${gwName} was force closed.`);
						}
						else
							client.say(channel, `@${tags.username}, Could not find an active Giveaway.`);
						await mysqlfunc.end(connection);
					}
					else if(command === 'winner') {
						var connection = await mysqlfunc.connect(null, channel);
						var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_tables.main.name} WHERE status = 'running' OR status = 'stopped'`);
						
						if(results.length > 0) {
							var gwName = results[0].name;
							if(results[0].status == 'running')
								client.say(channel, `@${tags.username}, Giveaway ${results[0].name} must first be stopped.`);
							else {
								var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_tables.entries.name} WHERE winner = 0 ORDER BY RAND() LIMIT 1`);
								if(results.length > 0) {
									await mysqlfunc.qry(connection, `UPDATE ${sql_tables.entries.name} SET winner = 1 WHERE id = '${results[0].id}'`);
									
									await logfunc.log('giveaway', `${results[0].name} was drawn by ${tags.username} as a winner for the ${gwName} Giveaway.`, connection);
									client.say(channel, `${results[0].name} won in the ${gwName} Giveaway`);
								}
								else
									client.say(channel, `@${tags.username}, No available entries were found for the Giveaway.`);
							}
						}
						await mysqlfunc.end(connection);
					}
				}
			}
			else {
				var connection = await mysqlfunc.connect(null, channel);
				var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_tables.main.name} WHERE status = 'running' OR status = 'stopped'`);
				
				if(results.length > 0) {
					var pointssysfunc = functions.get(`pointssysfunc`);
					if(results[0].status === 'stopped')
						client.say(channel, `@${tags.username}, Giveaway ${results[0].name} is stopped. Waiting for winner(s) to be drawn.`);
					else if(results[0].time > 0) {
						if(getTimeLeft(results[0].time) <= 0) {
							gwEndTime = null;
							await mysqlfunc.qry(connection, `UPDATE ${sql_tables.main.name} SET status = 'stopped' WHERE status = 'running'`);
							
							await logfunc.log('giveaway', `Time expired for Giveaway ${results[0].name}.`, connection);
							client.say(channel, `@${tags.username}, Time expired for Giveaway ${results[0].name} and it's now stopped. Waiting for winner(s) to be drawn.`);
						}
						else
							client.say(channel, `@${tags.username}, There's an active Giveaway for ${results[0].name}. Ends in ${util.getTimeStr(getTimeLeft(results[0].time))}. Ticket cost: ${results[0].cost} ${pointssysfunc.pointsName}`);
					}
					else
						client.say(channel, `@${tags.username}, There's an active Giveaway for ${results[0].name}. Ticket cost: ${results[0].cost} ${pointssysfunc.pointsName}`);
				}
				else
					client.say(channel, `@${tags.username}, There is no active Giveaway at the moment.`);
				
				await mysqlfunc.end(connection);
			}
        }
		else if(command === 'ticket') {
			var numTickets = 1;
			if(args.length > 0) {
				numTickets = Number(args.shift().toLowerCase());
				if(!Number.isInteger(numTickets) || numTickets < 1)
					numTickets = 1;
			}
			
			var connection = await mysqlfunc.connect(null, channel);
			var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_tables.main.name} WHERE status = 'running' OR status = 'stopped'`);
			
			if(results.length > 0) {
				if(results[0].status == 'running') {
					var gwInfo = results[0];
					if(getTimeLeft(results[0].time) <= 0) {
						gwEndTime = null;
						await mysqlfunc.qry(connection, `UPDATE ${sql_tables.main.name} SET status = 'stopped' WHERE status = 'running'`);
						
						await logfunc.log('giveaway', `Time expired for Giveaway ${results[0].name}.`, connection);
						client.say(channel, `@${tags.username}, Time expired for Giveaway ${results[0].name} and it's now stopped. Waiting for winner(s) to be drawn.`);
					}
					else {
						var userInfo = {
							points: 0,
							tickets: 0,
							free_tickets: 0
						}
						
						var pointssysfunc = functions.get(`pointssysfunc`);
						userInfo.points = await pointssysfunc.get(tags.username, connection);
						
						results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_tables.entries.name} WHERE name = '${tags.username}'`);
						userInfo.tickets = results.length;
						
						if(!gwInfo.limit_entry || gwInfo.limit_entry >= (userInfo.tickets + numTickets)) {
							if(gwInfo.free_entry > userInfo.tickets) {
								if(numTickets > gwInfo.free_entry - userInfo.tickets) {
									userInfo.free_tickets = gwInfo.free_entry - userInfo.tickets;
									numTickets -= userInfo.free_tickets;
								}
								else {
									userInfo.free_tickets = numTickets;
									numTickets = 0;
								}
							}
							if(userInfo.points >= (numTickets * gwInfo.cost)) {
								await pointssysfunc.take(tags.username, (numTickets * gwInfo.cost), connection);
								var allTickets = userInfo.free_tickets + numTickets;
								for(var i = 0; i < allTickets; i++)
									await mysqlfunc.qry(connection, `INSERT INTO ${sql_tables.entries.name} (name) VALUES ('${tags.username}')`);
								
								await logfunc.log('giveaway', `${tags.username} got ${userInfo.free_tickets} free tickets and paid for ${numTickets} tickets for the Giveaway.`, connection);
								client.say(channel, `@${tags.username} got ${getTicketsStr(userInfo.free_tickets, numTickets)} for the ${gwInfo.name} Giveaway`);
							}
							else
								client.say(channel, `@${tags.username} You need ${(numTickets * gwInfo.cost) - userInfo.points} more ${pointssysfunc.pointsName} for those tickets.`);
						}
						else
							client.say(channel, `@${tags.username}, Giveaway has a limit of ${gwInfo.limit_entry} tickets per user. You have ${userInfo.tickets}/${gwInfo.limit_entry}.`);
					}
				}
				else
					client.say(channel, `@${tags.username}, Giveaway ${results[0].name} is stopped. Waiting for winner(s) to be drawn.`);
			}
			else
				client.say(channel, `@${tags.username}, There is no active Giveaway at the moment.`);
			
			await mysqlfunc.end(connection);
		}
		else if(command === 'tickets') {
			var connection = await mysqlfunc.connect(null, channel);
			var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_tables.main.name} WHERE status = 'running' OR status = 'stopped'`);
			
			if(results.length > 0) {
				var limitEntry = results[0].limit_entry;
				var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_tables.entries.name} WHERE name = '${tags.username}'`);
				
				client.say(channel, `@${tags.username}, You have ${results.length}` + (limitEntry ? `/${limitEntry}` : `/∞`) + ` ticket` + (results.length == 1 ? `s` : ``) + `.`);
			}
			else
				client.say(channel, `@${tags.username}, There is no active Giveaway at the moment.`);
			await mysqlfunc.end(connection);
		}
    }
}

const task = async function (func_config, client, channel) {
	var index = arrGwEndTime.findIndex(e => (e.channel == channel && getTimeLeft(e.time) <= 0));
	if(index > -1) {
		if(getTimeLeft(arrGwEndTime[index].time) <= 0) {
			var mysqlfunc = functions.get(`mysqlfunc`);
			var connection = await mysqlfunc.connect(null, channel);
			var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_tables.main.name} WHERE status = 'running'`);
			if(results.length > 0) {
				if(getTimeLeft(results[0].time) <= 0) {
					await mysqlfunc.qry(connection, `UPDATE ${sql_tables.main.name} SET status = 'stopped' WHERE status = 'running'`);
					
					await logfunc.log('giveaway', `Time expired for Giveaway ${results[0].name} and is now stopped.`, connection);
					client.say('#tw1stybg', `Time expired for Giveaway ${results[0].name} and it's now stopped. Waiting for winner(s) to be drawn.`);
				}
			}
			await mysqlfunc.end(connection);
			arrGwEndTime.splice(index, 1);
		}
	}
}

function getTimeEnd(minutes)	{ return (new Date().getTime() / 1000) + (minutes * 60); }

function getTimeLeft(time)	{ return (time - (new Date().getTime() / 1000)); }

function getTicketsStr(free, normal) { return ((`${free+normal} ticket`) + (((free+normal) > 1) ? `s` : ``) + ((free > 0) ? `, ${free} of which ${(free > 1) ? 'were free' : 'was free'}` : ``)); }

module.exports = { OnLoad, OnMessage, task }