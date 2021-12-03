const functions = require('../functions');
const util = require('../util');

// Do not touch the arrGame type.
const gamesinfo = [
	{
		name: 'Questions',
		type: 'questions',
		sql_table: {
			name: 'game_questions',
			content: '( `info` varchar(64) NOT NULL, `answer` varchar(64) NOT NULL, PRIMARY KEY(`answer`)) ENGINE = MyISAM  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;'
		},
		description: 'Answer the question',
		auto: 1
	},
	{
		name: 'Type Racer',
		type: 'typeracer',
		sql_table: {
			name: 'game_typeracer',
			content: '( `answer` varchar(64) NOT NULL, PRIMARY KEY(`answer`)) ENGINE = MyISAM  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;'
		},
		description: 'Type the text',
		auto: 1
	},
	{
		name: 'Guess My Drawing',
		type: 'guessmydrawing',
		sql_table: {
			name: 'draw_words',
			content: '( `answer` varchar(64) NOT NULL, PRIMARY KEY(`answer`)) ENGINE = MyISAM  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;'
		},
		description: 'Guess what i am drawing',
		auto: 0
	},
	{
		name: 'Hangman',
		type: 'hangman',
		sql_table: {
			name: 'game_hangman',
			content: '( `answer` varchar(64) NOT NULL, PRIMARY KEY(`answer`)) ENGINE = MyISAM  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;'
		},
		description: 'Find the word',
		auto: 1
	}
];

const games = new Map();

module.exports.OnLoad = async function (client, channels) {
	await util.checkFuncConfig(channels, 'pointgamesfunc', {
		enabled: 'true',
		task_min_time: '300',
		task_max_time: '1800',
		win_time: '60',
		min_prize: '5',
		max_prize: '50'
	});

	var mysqlfunc = functions.get(`mysqlfunc`);
	for(var i=0;i < gamesinfo.length; i++)
		await mysqlfunc.loadTable(gamesinfo[i].sql_table, channels);
	
	var config;
	for(var i = 0; i < channels.length; i++) {
		config = await util.getJsonConfig('pointgamesfunc', channels[i].slice(1));
		games.set(channels[i], {
			on: false,
			type: '',
			info: '',
			answer: '',
			prize: 0,
			start: 0,
			next: util.getRngInteger(Number(config.task_min_time), Number(config.task_max_time))
		});
	}
}

module.exports.OnMessage = async function(config, func_config, client, channel, tags, message) {
	var arrGame = games.get(channel);
	if(message.startsWith(config.prefix)) {
		const args = message.slice(1).split(' ');
		const logfunc = functions.get(`logfunc`);
		var command = args.shift().toLowerCase();
		if(command === 'game') {
			if(args.length > 0) {
				if(util.isBroadcaster(tags)) {
					var games_str = '';
					gamesinfo.forEach(g => games_str +=((games_str.length > 0) ? '|' : '') + g.type);
					
					command = args.shift().toLowerCase();
					if(command === 'start') {
						if(!arrGame.on) {
							if(args.length > 0) {
								const game_type = args.shift().toLowerCase();
								const gameID = gamesinfo.findIndex(g => g.type == game_type)
								if(gameID > -1)
									StartGame(func_config, client, channel, gameID, tags.username);
								else
									client.say(channel, `@${tags.username}, Games you can start: ${games_str}`);
							}
							else
								client.say(channel, `@${tags.username}, Games you can start: ${games_str}`);
						}
					}
					else if(command === 'stop') {
						if(arrGame.on) {
							client.say(channel, `@${tags.username} спря играта.`);
							await logfunc.log(`pointgames`, `${tags.username} stopped the arrGame.`);
							resetGame(func_config, channel);
						}
					}
					else if(command == 'add') {
						if(args.length > 0)
							addToGame(client, args.shift().toLowerCase(), args.join(' '));
						else
							client.say(channel, `@${tags.username}, Usage: !game add <${games_str}> <info>`);
					}
				}
			}
			else
				client.say(channel, `@${tags.username}, Usage: !game <add/remove/start/stop>`);
		}
	}
	else if(arrGame.on) {
		if(message == arrGame.answer || (arrGame.type == 'hangman' & InsertSpaces(message) == arrGame.answer)) {
			var mysqlfunc = functions.get(`mysqlfunc`);
			var connection = await mysqlfunc.connect();
			var blacklistfunc = functions.get(`blacklistfunc`);
			var pointssysfunc = functions.get(`pointssysfunc`);
			var pointsName = await pointssysfunc.pointsName(channel.slice(1));
			if(!(await blacklistfunc.isBlacklisted(tags.username, `points`, connection))) {
				await pointssysfunc.add(tags.username, arrGame.prize, connection);
				client.say(channel, `@${tags.username} answered correctly first and won ${arrGame.prize} ${pointsName}!`);
				await logfunc.log(`pointgames`, `${tags.username} answered correctly first and won ${arrGame.prize} ${pointsName}!`, connection);
			}
			else {
				client.say(channel, `@${tags.username} answered correctly first, but is 'points' blacklisted and didn't get any ${pointsName} LUL`);
				await logfunc.log(`pointgames`, `${tags.username} answered correctly first but is blacklisted and didn't get any ${pointsName}`, connection);
			}
			await mysqlfunc.end(connection);
			resetGame(channel);
		} else if(arrGame.type == 'hangman' & message.length == 1) {
			var found = false;
			for(var i = 0; i < arrGame.info.length; i++) {
				if(arrGame.info[i] == '_' && arrGame.answer[i] == message[0]) {
					arrGame.info = replaceAt(arrGame.info, i, message);
					found = true;
				}
			}
			if(found)
				client.say(channel, `@${tags.username} found the letter ${message} in the word! ${arrGame.info}`);
		}
	}
}

async function addToGame(client, game_type, info) {
	var mysqlfunc = functions.get(`mysqlfunc`);
	var connection = await mysqlfunc.connect();
	var gIndex = gamesinfo.findIndex(g => g.type == game_type);
	if(game_type === 'guessmydrawing') {
		var results = await mysqlfunc.qry(connection, `SELECT * FROM ${gamesinfo[gIndex].sql_table.name} WHERE answer = '${info}'`);
		
		if(results.length == 0) {
			await mysqlfunc.qry(connection, `INSERT INTO ${gamesinfo[gIndex].sql_table.name} (answer) VALUES('${info}')`);
			client.say(channel, `@${tags.username}, The word ${info} was added to the arrGame ${game_type}.`);
		}
		else
			client.say(channel, `@${tags.username}, The word ${info} already exists.`);
	}
	else if(game_type === 'hangman') {
		var results = await mysqlfunc.qry(connection, `SELECT * FROM ${gamesinfo[gIndex].sql_table.name} WHERE answer = '${info}'`);
		if(results.length > 0) {
			await mysqlfunc.qry(connection, `INSERT INTO ${gamesinfo[gIndex].sql_table.name} (answer) VALUES('${info}')`);
			client.say(channel, `@${tags.username}, The word${info} was added to the arrGame ${game_type}.`);
		}
		else
			client.say(channel, `@${tags.username}, The word${info} вече съществува.`);
	}
	else if(game_type === 'typeracer') {
		var results = await mysqlfunc.qry(connection, `SELECT * FROM ${gamesinfo[gIndex].sql_table.name} WHERE answer = '${info}'`);
		if(results.length > 0) {
			await mysqlfunc.qry(connection, `INSERT INTO ${gamesinfo[gIndex].sql_table.name} (answer) VALUES('${info}')`);
			client.say(channel, `@${tags.username}, The word${info} was added to the arrGame ${game_type}.`);
		}
		else
			client.say(channel, `@${tags.username}, The word${info} вече съществува.`);
	}
	else if(game_type === 'questions') {
		client.say(channel, `@${tags.username}, Function yet not made.`);
	}
	else
		client.say(channel, `@${tags.username}, Usage: !game add <${games_str}> <info>`);
	await mysqlfunc.end(connection);
}

async function StartGame(func_config, client, channel, gameID, name) {
	game_type = gamesinfo[gameID].type;
	var logfunc = functions.get(`logfunc`);
	var mysqlfunc = functions.get(`mysqlfunc`);
	var connection = await mysqlfunc.connect(null, channel);
	var gIndex = gamesinfo.findIndex(g => g.type == game_type);
	var results = await mysqlfunc.qry(connection, `SELECT * FROM ${gamesinfo[gIndex].sql_table.name}`);
	var config = await util.getJsonConfig('pointgamesfunc', channel.slice(1));

	var arrGame = games.get(channel);
	if(results.length > 0) {
		var game_num = util.getRngInteger(0, results.length - 1);
		arrGame.on = true;
		arrGame.type = game_type;
		arrGame.prize = util.getRngInteger(Number(func_config.min_prize), Number(func_config.max_prize));
		
		if(game_type == 'hangman') {
			arrGame.info = InsertSpaces(InsertLines(results[game_num].answer));
			arrGame.answer = InsertSpaces(results[game_num].answer);
		}
		else if(game_type == `questions`) {
			arrGame.info = results[game_num].info;
			arrGame.answer = results[game_num].answer;
		}
		else {
			arrGame.info = results[game_num].answer;
			arrGame.answer = results[game_num].answer;
		}
	}
	
	if(arrGame.on) {
		arrGame.start = new Date().getTime() / 1000;
		var pointssysfunc = functions.get(`pointssysfunc`);
		var pointsName = await pointssysfunc.pointsName(channel.slice(1));
		console.log(pointsName);
		if(name) {
			client.say(channel, `@${name} started a game of ${gamesinfo[gameID].name}! ` + (Number(func_config.win_time) ? `You have ${Number(func_config.win_time)} second${(Number(func_config.win_time) == 1 ? '' : 's')}` : ``) + `. ${gamesinfo[gameID].description} for ${arrGame.prize} ${pointsName}: ${arrGame.info}`);
			await logfunc.log(`pointgames`, `${name} started game of ${gamesinfo[gameID].name}!`, connection);
		}
		else {
			client.say(channel, `A ${gamesinfo[gameID].name} game has started! ` + (Number(func_config.win_time) ? `You have ${Number(func_config.win_time)} second${(Number(func_config.win_time) == 1 ? '' : 's')}` : ``) + `. ${gamesinfo[gameID].description} for ${arrGame.prize} ${pointsName}: ${arrGame.info}`);
			await logfunc.log(`pointgames`, `A game of ${gamesinfo[gameID].name} has started!`, connection);
		}
		games.set(channel, arrGame);
	}
	await mysqlfunc.end(connection);
}

async function resetGame(func_config, channel) {
	games.set(channel, {
		on: false,
		type: '',
		info: '',
		answer: '',
		prize: 0,
		start: 0,
		next: util.getRngInteger(Number(func_config.task_min_time), Number(func_config.task_max_time))
	});
}

module.exports.task = async function(func_config, client, channel) {
	var arrGame = games.get(channel);
	if(arrGame.on) {
		if(Number(func_config.win_time)) {
			if(((new Date().getTime() / 1000) - arrGame.start) >= Number(func_config.win_time)) {
				client.say(channel, `The arrGame of ${gamesinfo[arrGame.type].name} ended. No one won.`);
				await logfunc.log(`pointgames`, `The arrGame of ${gamesinfo[arrGame.type].name} ended. No one won.`, null, channel);
				resetGame(func_config, channel);
			}
		}
	}
	else {
		if(functions.get(`checkstreamfunc`).isLive) {
			arrGame.next--;
			if(arrGame.next <= 0) {
				var games_filter = gamesinfo.filter(g => g.auto == 1);
				StartGame(func_config, client, channel, util.getRngInteger(0, games_filter.length - 1));
			}
		}
	}
}

function replaceAt(string, index, replacement) { return string.substr(0, index) + replacement + string.substr(index + replacement.length); }
function addAt(string, index, add) { return string.substr(0, index) + add + string.substr(index); }

function InsertLines(string) {
	for(var i = 1; i < string.length - 1; i++)
		if(string[i] != ' ')
			string = replaceAt(string, i, '_');
	return string;
}

function InsertSpaces(string) {
	for(var i = string.length-1; i >=0; i--)
		string = addAt(string, i, i == 0 ? '' : ' ');
	return string;
}