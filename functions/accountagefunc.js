const util = require('../util');

module.exports.OnLoad = async function (client, channels) {
	await util.checkFuncConfig(channels, 'accountagefunc', {
		enabled: 'true'
	});
}

module.exports.OnMessage = async function (config, func_config, client, channel, tags, message) {
	if(message.startsWith(config.prefix)) {
		const args = message.slice(1).split(' ');
		const command = args.shift().toLowerCase();
		
		if(command === 'accountage') {
			var accName;
			if(args.length > 0) {
				accName = args.shift().toLowerCase();
				if(accName[0] == '@')
					accName = accName.replace("@", "");
			}
			else
				accName = tags.username;

			await util.api(`https://api.twitch.tv/helix/users?login=${accName}`, function (err, res, body) {
				if(err) return;
				if(body.data && body.data[0]) {
					if(accName == process.env.BOT_USERNAME)
						client.say(channel, `@tw1stybg made me on ${new Date(Date.parse(new Date(body.data[0].created_at))).toLocaleDateString('en-EN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}`);
					else
						client.say(channel, `@${accName}'s account was created on ${new Date(Date.parse(new Date(body.data[0].created_at))).toLocaleDateString('en-EN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}`);
				}
				else
					client.say(channel, `${tags.username}, User ${accName} was not found.`);
			});
		}
	}
}