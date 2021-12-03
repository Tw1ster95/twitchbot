const util = require('./util');

const arrFunc = Array();

module.exports.load = async function (client, channels) {
	var folder = './functions/';
	var fs = require('fs');

	fs.readdirSync(folder).forEach(file => {
		if(file.endsWith(`.js`)) {
			file = file.replace(`.js`, ``);
			arrFunc.push({ name: file, func: require(`./functions/${file}`) });
		}
		else
			console.log(`[functions] Found a file in the '/functions/' directory that is not a .js file.`);
	});
	
	console.log(`[functions] Loaded ${arrFunc.length} functions from '/functions/' folder.`);
	
	for(var i = 0; i < arrFunc.length; i++)
		if(typeof arrFunc[i].func.OnLoad === "function")
			await arrFunc[i].func.OnLoad(client, channels);
}

module.exports.list = function () {
	var list = Array();
	arrFunc.forEach(func => list.push(func.name));
	return list;
}

module.exports.get = function (func_name) {
	const fID = arrFunc.findIndex(f => f.name == func_name);
	return (fID == -1) ? null : arrFunc[fID].func;
}

module.exports.OnMessage = async function (config, client, channel, tags, message) {
	var func_config;
	for(var i = 0; i < arrFunc.length; i++) {
		func_config = await util.getJsonConfig(arrFunc[i].name, channel.slice(1));
		if(func_config) {
			if(func_config.enabled.toLowerCase() == 'true' && typeof arrFunc[i].func.OnMessage === "function")
				await arrFunc[i].func.OnMessage(config, func_config, client, channel, tags, message);
		}
		else
			console.log(`[functions->OnMessage] Error: could not find config file for channel: '${channel}'; function: '${arrFunc[i].name}'`);
	}
}

module.exports.OnJoin = async function (config, client, channel, nick) {
	var func_config;
	for(var i = 0; i < arrFunc.length; i++) {
		func_config = await util.getJsonConfig(arrFunc[i].name, channel.slice(1));
		if(func_config) {
			if(func_config.enabled.toLowerCase() == 'true' && typeof arrFunc[i].func.OnJoin === "function")
				arrFunc[i].func.OnJoin(config, func_config, client, channel, nick);
		}
		else
			console.log(`[functions->OnJoin] Error: could not find config file for channel: '${channel}'; function: '${arrFunc[i].name}'`);
	}
}

module.exports.OnPart = async function (config, client, channel, nick) {
	var func_config;
	for(var i = 0; i < arrFunc.length; i++) {
		func_config = await util.getJsonConfig(arrFunc[i].name, channel.slice(1));
		if(func_config) {
			if(func_config.enabled.toLowerCase() == 'true' && typeof arrFunc[i].func.OnPart === "function")
				arrFunc[i].func.OnPart(config, func_config, client, channel, nick);
		}
		else
			console.log(`[functions->OnPart] Error: could not find config file for channel: '${channel}'; function: '${arrFunc[i].name}'`);
	}
}

module.exports.task = async function (client, channels) {
	var func_config;
	for(var i = 0; i < arrFunc.length; i++) {
		if(typeof arrFunc[i].func.task === "function") {
			for(var a = 0; a < channels.length; a++) {
				func_config = await util.getJsonConfig(arrFunc[i].name, channels[a].slice(1));
				if(func_config) {
					if(func_config.enabled.toLowerCase() == 'true')
						await arrFunc[i].func.task(func_config, client, channels[a]);
				}
				else
					console.log(`[functions->task] Error: could not find config file for channel: '${channels[a]}'; function: '${arrFunc[i].name}'`);
			}
		}
	}
}