const functions = require('../functions');
const util = require('../util');

// Database table info
const sql_table = {
	items: {
		name: 'shopitems',
		content: '( `itemid` int(11) AUTO_INCREMENT, `connecteditemid` int(11) DEFAULT 0, `name` varchar(64) NOT NULL, `type` varchar(64) NOT NULL, `price` int(11) DEFAULT 0, `amount` int(11) DEFAULT 1, `per_user` int(11) DEFAULT 0, `global_cooldown` int(11) DEFAULT 0, `user_cooldown` int(11) DEFAULT 0, `last_purchase` int(11) DEFAULT 0, `info` varchar(128), PRIMARY KEY(`itemid`)) ENGINE = MyISAM  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;'
	},
	purchases: {
		name: 'shoppurchases',
		content: '( `purch_id` int(11) AUTO_INCREMENT, `twitch_name` varchar(64) NOT NULL, `itemid` int(11) NOT NULL, `info` varchar(128), `time` int(11) NOT NULL, `redeemed` int(11) NOT NULL, PRIMARY KEY(`purch_id`)) ENGINE = MyISAM  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;'
	}
};

module.exports.OnLoad = async function (client, channels) {
	await util.checkFuncConfig(channels, 'pointsshopfunc', {
		enabled: 'true'
	});

	var mysqlfunc = functions.get(`mysqlfunc`);
	await mysqlfunc.loadTable(sql_table.items, channels);
	await mysqlfunc.loadTable(sql_table.purchases, channels);
}

module.exports.OnMessage = async function (config, func_config, client, channel, tags, message) {
	if(message.startsWith(config.prefix)) {
		const pointssysfunc = functions.get(`pointssysfunc`);
		const pointsname = (await pointssysfunc.pointsName(channel.slice(1))).toLowerCase();
		const args = message.slice(1).split(' ');
		var command = args.shift().toLowerCase();
		
		if(command === `${pointsname}shop` || command === `${pointsname}store` || command === `shop` || command === `store`) {
			const mysqlfunc = functions.get(`mysqlfunc`);
			const connection = await mysqlfunc.connect(null, channel);
			var results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_table.items.name}`);

			if(args.length > 0) {
				const command2 = args.shift().toLowerCase();
				if(command2 === `get`) {
					if(args.length > 0) {
						const item_name = args.join(` `).toLowerCase();
						const itemID = Number(item_name);
						var foundItem = -1;
						if(Number.isInteger(itemID))
							foundItem = results.findIndex(r => r.itemid == itemID);
						else {
							for(var i = 0; i < results.length; i++) {
								if(results[i].name.toLowerCase().includes(item_name))
									foundItem = (foundItem == -1 ? i : -2);
							}
						}

						if(foundItem == -2)
							client.say(channel, `@${tags.username}, Found more than one item that includes ${item_name} in it's name. Please use item ID.`);
						else if (foundItem == -1)
							client.say(channel, `@${tags.username}, Item with ` + (Number.isInteger(itemID) ? 'item ID' : 'name') + ` ${item_name} was not found.`);
						else {
							var item = results[foundItem];
							// Check items amount if it's finished or -1 for infinite or it's a game key and check if there are game keys left
							if(item.amount > 0 || (item.type == 'gamekey' && item.info.length > 0)) {
								var points = await pointssysfunc.get(tags.username, connection);
								var curTime = new Date().getTime() / 1000;
								var hasPurchased = 0;
								var lastPurchased = 0;
								
								// Get user has, last got
								results = await mysqlfunc.qry(connection, `SELECT * FROM ${sql_table.purchases.name} WHERE twitch_name = '${tags.username}' AND itemid = ${item.itemid}`);
								hasPurchased = results.length;
								if(hasPurchased > 0)
									lastPurchased = Math.max.apply(Math, results.map(function(o) { return o.time; }));
								
								if(!item.global_cooldown || (!item.last_purchase || ((item.global_cooldown * 60) + item.last_purchase) <= curTime)) {
									if(!item.per_user || hasPurchased >= item.per_user) {
										if(!lastPurchased || !item.user_cooldown || (lastPurchased + (item.user_cooldown * 60)) <= curTime) {
											if(points >= item.price) {
												var purch_info;
												var amount_left;
												
												// Update user points
												await pointssysfunc.take(tags.username, item.price, connection);
												//Update Item Info if needed and send private info to buyer
												if(item.type == 'gamekey')
												{
													var info = item.info;
													var info_args = info.split('#');
													purch_info = info_args[0];
													//client.whisper(tags.username, `Congrats on purchasing ${item.name} Kreygasm. Here's your game key: ${purch_info}`);
													amount_left = info_args.length - 1;
													item.info = (amount_left > 0) ? info_args.splice(1).join('#') : '';
												}
												else {
													purch_info = item.info;
													amount_left = (item.amount > 0) ? (item.amount - 1) : item.amount;
												}
												
												// Update purchased table
												await mysqlfunc.qry(connection, `INSERT INTO ${sql_table.purchases.name} (twitch_name, itemid, time, redeemed, info) VALUES ('${tags.username}', '${item.itemid}', ${curTime}, ${(item.type == 'screencars') ? 1 : 0}, '${purch_info ? GetItemInfo(purch_info) : ``}')`);

												// Update Items amount left, last purchased and info
												await mysqlfunc.qry(connection, `UPDATE ${sql_table.items.name} SET amount = ${amount_left}, last_purchase = ${curTime}, info = '${item.info}' WHERE itemid = '${item.itemid}'`);
												
												client.say(channel, `@${tags.username} got ${item.name} for ${item.price} ${await pointssysfunc.pointsName}. There are ` + (!amount_left ? `no` : amount_left) + ` more left.`);
											}
											else
												client.say(channel, `@${tags.username}, You need ${item.price - points} ${await pointssysfunc.pointsName} more for ${item.name}.`);
										}
										else
											client.say(channel, `@${tags.username}, You have to wait ${util.getTimeStr((lastPurchased + (item.user_cooldown * 60)) - curTime)}(User Cooldown) to get another ${item.name}.`);
									}
									else
										client.say(channel, `@${tags.username}, You've hit the purchase limit of ${item.per_user} for ${item.name}.`);
								}
								else
									client.say(channel, `@${tags.username}, You have to wait ${util.getTimeStr(((item.global_cooldown * 60) + item.last_purchase) - curTime)}(Global Cooldown) to get ${item.name}.`);
							}
							else
								client.say(channel, `@${tags.username}, There are no more ${item.name} available.`);
						}
					}
					else {
						if(results.length > 0)
							client.say(channel, `@${tags.username} Usage: !${command} get <item>. ${listSomeItems(results, await pointssysfunc.pointsName)}.`);
					}
				}
			}
			else if(results.length > 0)
				client.say(channel, `@${tags.username} Usage: !${command} get <item>. ${listSomeItems(results, await pointssysfunc.pointsName)}.`);
			
			await mysqlfunc.end(connection);
		}
	}
}

function listSomeItems(results, pointsName) {
	var str = '';
	var num = (results.length > 3) ? 3 : results.length;
	for(var i = 0; i < num; i++)
		str += ((i > 0) ? `; ` : ``) + `${results[i].itemid}(` + ((results[i].name.length > 15) ? `${results[i].name.substring(0, 15)}..` : results[i].name) + `)${results[i].price}${pointsName} `;
	return (str + ((results.length > 3) ? `. See more here: https://bit.ly/ttvitemshop` : ``));
}

function GetItemInfo(info) {
	if(info.startsWith(`time`)) {
		const time = Number(info.slice(4));
		if(time)
			return (new Date().getTime() / 1000) + (time * 60);
	}
	return info;
}