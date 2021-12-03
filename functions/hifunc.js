const util = require('../util');

const welcomeMsgs = {
	bg: [
		`Как е USER`,
		`ООО здравей USER HeyGuys`,
		`Пак ли ти е USER LUL`,
		`Ко прайм USER`,
		`Здравей USER VoHiYo`
	],
	en: [
		`Hi USER HeyGuys`,
		`Yoo USER`,
		`Whatsup USER`,
		`Hay USER and welcome to the stream! VoHiYo`
	]
}

const welcomeTriggers = {
	bg: [ `zdr`, `zdravei`, `zdrasti`, `здр`, `здравей`, `здрасти` ],
	en: [ `hi`, `hay`, `hey`, `hello` ]
}

module.exports.OnLoad = async function (client, channels) {
	await util.checkFuncConfig(channels, 'hifunc', {
		enabled: 'true'
	});
}

module.exports.OnMessage = function (config, func_config, client, channel, tags, message) {
    const args = message.split(' ');
    const command = args.shift().toLowerCase();
	var found = welcomeTriggers.bg.find(m => m == command) ? true : false;
	if(found)
		client.say(channel, welcomeMsgs.bg[util.getRngInteger(0, welcomeMsgs.bg.length-1)].replace(`USER`, `@${tags.username}`));
	else {
		found = welcomeTriggers.en.find(m => m == command) ? true : false;
		if(found)
			client.say(channel, welcomeMsgs.en[util.getRngInteger(0, welcomeMsgs.en.length-1)].replace(`USER`, `@${tags.username}`));
	}
}