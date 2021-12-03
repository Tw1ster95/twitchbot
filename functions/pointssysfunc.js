const functions = require('../functions');
const util = require('../util');

// Database table info
const sql_table = {
    name: 'user_points',
	content: '( `twitch_name` varchar(64) NOT NULL, `points` int(11) DEFAULT 0, PRIMARY KEY(`twitch_name`)) ENGINE = MyISAM  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;'
};

const arrGivePointsTimer = Array();

module.exports.pointsName = async function (channel) {
	var config = await util.getJsonConfig('pointssysfunc', channel);
	return config.points_name;
};

module.exports.OnLoad = async function (client, channels) {
	await util.checkFuncConfig(channels, 'pointssysfunc', {
		enabled: 'true',
		get_amount: '1',
		get_bonus_per_msg: '0.2',
		get_bonus_max: '3',
		give_interval_minutes: '1',
		points_name: 'IQ',
		blacklist_name: 'points'
	});

	var mysqlfunc = functions.get(`mysqlfunc`);
	await mysqlfunc.loadTable(sql_table, channels);
	
	var connection, config;
	var blacklistfunc = functions.get(`blacklistfunc`);
	for(var i = 0; i < channels.length; i++) {
		config = await util.getJsonConfig('pointssysfunc', channels[i].slice(1));
		connection = await mysqlfunc.connect(null, channels[i]);
		if(blacklistfunc) {
			if(!(await blacklistfunc.exists(config.blacklist_name, connection)))
				await blacklistfunc.create(config.blacklist_name, connection);
		}
		await mysqlfunc.end(connection);

		arrGivePointsTimer.push({ channel: channels[i], timer: Number(config.give_interval_minutes) });
	}
}

module.exports.OnMessage = async function (config, func_config, client, channel, tags, message) {
	if(message.startsWith(config.prefix)) {
		const args = message.slice(1).split(' ');
		const command = args.shift().toLowerCase();
		const mysqlfunc = functions.get(`mysqlfunc`);
		const logfunc = functions.get(`logfunc`);
		const pointsname = func_config.points_name.toLowerCase();
		
		if(command === pointsname) {
			const connection = await mysqlfunc.connect(null, channel);
			if(args.length > 0) {
				var cmd_tagged = args.shift().toLowerCase();
				if(cmd_tagged[0] == '@')
					cmd_tagged = cmd_tagged.replace("@", "");
				
				var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_table.name} WHERE twitch_name = '${cmd_tagged}'`);
				if(results.length > 0)
					client.say(channel, `@${tags.username}, @${cmd_tagged} има ${results[0].points} ${func_config.points_name}.`);
				else
					client.say(channel, `@${tags.username}, ${cmd_tagged} не беше намерен в базата данни.`);
			}
			else {
				var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_table.name} WHERE twitch_name = '${tags.username}'`);
				if(results.length > 0)
					client.say(channel, `@${tags.username} има ${results[0].points} ${func_config.points_name}.`);
				else
					client.say(channel, `@${tags.username}, не беше намерен в базата данни.`);
			}
			await mysqlfunc.end(connection);
		}
		else if(command === `add${pointsname}`) {
			if(util.isBroadcaster(tags)) {
				if(args.length > 0) {
					var tagged = args.shift().toLowerCase();
					if(tagged[0] == '@')
						tagged = tagged.replace("@", "");
					
					if(args.length > 0) {
						var number = Number(args.shift().toLowerCase());
						if(Number.isInteger(number) && number > 0) {
							var connection = await mysqlfunc.connect(null, channel);
							var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_table.name} WHERE twitch_name = '${tagged}'`);
							if(results.length > 0) {
								var pts = results[0].points + number;
								await mysqlfunc.qry(connection, `UPDATE ${sql_table.name} SET points = ${pts} WHERE twitch_name = '${tagged}'`);
								client.say(channel, `@${tags.username}, ${number} ${func_config.points_name} were added to ${tagged}. He/She now has ${pts} ${func_config.points_name}.`);
								await logfunc.log(`pointssys`, `${tags.username} added ${number} ${func_config.points_name} to ${tagged}.`, connection);
							}
							else
								client.say(channel, `@${tags.username}, ${tagged} не беше намерен в базата данни.`);
							
							await mysqlfunc.end(connection);
						}
						else
							client.say(channel, `@${tags.username}, ${func_config.points_name} трябва да е положително число.`);
					}
					else
						client.say(channel, `@${tags.username}, Usage: !add${pointsname} <username> <number>.`);
				}
				else
					client.say(channel, `@${tags.username}, Usage: !add${pointsname} <username> <number>.`);
			}
		}
		else if(command === `take${pointsname}`) {
			if(isBroadcaster(tags)) {
				if(args.length > 0) {
					var tagged = args.shift().toLowerCase();
					if(tagged[0] == '@')
						tagged = tagged.replace("@", "");
					
					if(args.length > 0) {
						const number = Number(args.shift().toLowerCase());
						if (number && number > 0) {
							var connection = await mysqlfunc.connect(null, channel);
							var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_table.name} WHERE twitch_name = '${tagged}'`);
							if(results.length > 0) {
								var pts = results[0].points - number;
								if(pts < 0)
									pts = 0;
								await mysqlfunc.qry(connection, `UPDATE ${sql_table.name} SET points = ${pts} WHERE twitch_name = '${tagged}'`);
								client.say(channel, `@${tags.username}, ${number} ${func_config.points_name} were taken from ${tagged}. He/She now has ${pts} ${func_config.points_name}.`);
								await logfunc.log(`pointssys`, `${tags.username} took ${number} ${func_config.points_name} from ${tagged}.`, connection);
							}
							else
								client.say(channel, `@${tags.username}, ${tagged} was not found in the database.`);
							await mysqlfunc.end(connection);
						}
						else
							client.say(channel, `@${tags.username}, ${func_config.points_name} трябва да е положително число.`);
					}
					else
						client.say(channel, `@${tags.username}, Usage: !add${pointsname} <username> <number>.`);
				}
				else
					client.say(channel, `@${tags.username}, Usage: !add${pointsname} <username> <number>.`);
			}
		}
		else if(command === `top${pointsname}`) {
			var connection = await mysqlfunc.connect(null, channel);
			var results = await mysqlfunc.qry(connection, `SELECT twitch_name, points FROM ${sql_table.name} ORDER BY points DESC LIMIT 5`);
			if(results.length > 0) {
				var string = ' ';
				for(var i = 0; i < results.length; i++)
					string = `${string}${i + 1}: ${results[i].twitch_name}(${results[i].points}), `;
				
				client.say(channel, `@${tags.username}, Top 5 ${func_config.points_name}:${string}`);
			}
			await mysqlfunc.end(connection);
		}
	}
	
	const viewersinfofunc = functions.get(`viewersinfofunc`);
	const arrViewerInfo = await viewersinfofunc.get(tags.username, channel);
	if(arrViewerInfo.bonuspoints) {
		if(arrViewerInfo.bonuspoints < Number(func_config.get_bonus_max))
			viewersinfofunc.set(arrViewerInfo.twitch_name, channel, { bonuspoints: (arrViewerInfo.bonuspoints + Number(func_config.get_bonus_per_msg)) });
	}
	else
		viewersinfofunc.set(arrViewerInfo.twitch_name, channel, { bonuspoints: Number(func_config.get_bonus_per_msg) });
}

module.exports.add = async function (twitch_name, channel, points, conn) {
	if(Number.isInteger(points) && points > 0) {
		var mysqlfunc = functions.get(`mysqlfunc`);
		var connection = conn || await mysqlfunc.connect(null, channel);
		await mysqlfunc.qry(connection, `UPDATE ${sql_table.name} SET points = points + ${points} WHERE twitch_name = '${twitch_name}'`);
		if(!conn)
			await mysqlfunc.end(connection);
	}
}

module.exports.take = async function (twitch_name, channel, points, conn) {
	if(Number.isInteger(points) && points > 0) {
		var mysqlfunc = functions.get(`mysqlfunc`);
		var connection = conn || await mysqlfunc.connect(null, channel);
		var results = await mysqlfunc.qry(connection, `SELECT points FROM ${sql_table.name} WHERE twitch_name = '${twitch_name}'`);
		if(results.length > 0) {
			if(results[0].points < points)
				points = results[0].points;
			await mysqlfunc.qry(connection, `UPDATE ${sql_table.name} SET points = points - ${points} WHERE twitch_name = '${twitch_name}'`);
		}
		if(!conn)
			await mysqlfunc.end(connection);
	}
}

module.exports.get = async function (twitch_name, channel, conn) {
	var mysqlfunc = functions.get(`mysqlfunc`);
	var connection = conn || await mysqlfunc.connect(null, channel);
	var results = await mysqlfunc.qry(connection, `SELECT points FROM ${sql_table.name} WHERE twitch_name = '${twitch_name}'`);
	if(!conn)
		await mysqlfunc.end(connection);
	if(results.length > 0)
		return results[0].points;
	return 0;
}

module.exports.task = async function (func_config, client, channel) {
	var index = arrGivePointsTimer.findIndex(e => e.channel == channel);
	
	if(index > -1) {
		arrGivePointsTimer[index].timer--;
		if(arrGivePointsTimer[index].timer <= 0) {
			arrGivePointsTimer[index].timer = Number(func_config.give_interval_minutes);
			
			var checkstreamfunc = functions.get(`checkstreamfunc`);
			if(checkstreamfunc.isLive) {
				var mysqlfunc = functions.get(`mysqlfunc`);
				var viewersinfofunc = functions.get(`viewersinfofunc`);
				var connection = await mysqlfunc.connect(null, channel);
				var arrViewers = await viewersinfofunc.get(null, channel, connection);
				arrViewers = arrViewers.filter(v => !v.bot);
				if(arrViewers.length > 0) {
					var pts;
					for(var i = 0; i < arrViewers.length; i++) {
						if(!(await checkBlacklist(func_config, arrViewers[i].twitch_name, connection))) {
							pts = (arrViewers[i].bonuspoints) ? (Number(func_config.get_amount) + arrViewers[i].bonuspoints) : Number(func_config.get_amount);
							await mysqlfunc.qry(connection, `UPDATE ${sql_table.name} SET points=points+${pts} WHERE twitch_name='${arrViewers[i].twitch_name}'`);
							viewersinfofunc.set(arrViewers[i].twitch_name, channel, { bonuspoints: 0 });
						}
					}
				}
				await mysqlfunc.end(connection);
			}
		}
	}
}

async function checkBlacklist(config, twitch_name, connection) {
	const blacklistfunc = functions.get(`blacklistfunc`);
	return (blacklistfunc) ? ((await blacklistfunc.isBlacklisted(twitch_name, config.blacklist_name, connection)) ? true : false) : false;
}