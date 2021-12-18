const util = require('../util');

const OnLoad = async function (client, channels) {
	await util.checkFuncConfig(channels, 'followagefunc', {
		enabled: 'true'
	});
}

const OnMessage = async function (config, func_config, client, channel, tags, message) {
    if(message.startsWith(config.prefix)) {
        const args = message.slice(1).split(' ');
        const command = args.shift().toLowerCase();
        if(command === 'followage') {
			console.log(`1`);
			if(args.length > 0) {
				var argName = args.shift();
				if(argName[0] == '@')
					argName = argName.replace("@", "");
				const user = await getUserInfo(argName.toLowerCase());
				console.log(user);
				if(user)
					displayInfo(client, channel, tags, user, config);
				else
					client.say(channel, `@${tags.username}, User ${argName} was not found.`);
			}
			else
				displayInfo(client, channel, tags, null, config);
		}
    }
}

async function displayInfo(client, channel, tags, user, config) {
	var url = `https://api.twitch.tv/helix/users/follows?to_id=${config.streamerID}&from_id=${user ? user.id : tags['user-id']}`;
	console.log(url);
	await util.api(url, async function (err, res, body) {
		if (err) return;
		console.log(body);
		if(body.data && body.data[0])
			client.say(channel, `@${user ? user.name : tags.username} has been following the channel for ${util.getTimeStr((new Date().getTime() - Date.parse(new Date(body.data[0].followed_at))) / 1000)}`);
		else// if(channel.slice(1) !== tags['username'])
			client.say(channel, `@${user ? user.name : tags.username} is not following the channel.`);
	});
}

async function getUserInfo(name) {
	var user = null;
	await util.api(`https://api.twitch.tv/helix/users?login=${name}`, async function (err, res, body) {
		if (err) return;
		if(body.data && body.data[0]) {
			user = {
				id: body.data[0].id,
				name: body.data[0].display_name
			};
		}
	});
	return user;
}

module.exports = { OnLoad, OnMessage }