const mysql = require('mysql2');
const util = require('../util');

module.exports.OnLoad = async function (client, channels) {
	await util.checkFuncConfig(channels, 'mysqlfunc', {
		enabled: 'true',
		host: 'localhost',
		user: 'root',
		password: '',
		port: '',
		database: ''
	});

	var config, conn;
	for(var i = 0; i < channels.length; i++) {
		config = await util.getJsonConfig('mysqlfunc', channels[i].slice(1));
		conn = getSqlConn(config);
		for(const [key, value] of Object.entries(conn)) {
			if(key !== 'password' && !value) {
				console.log(`[mysql] Error: channels[i] -> config -> ${key} needs to have a value.`);
				process.exit(1);
			}
		}
	}
}

module.exports.loadTable = async function (info, channels) {
	var connection, sqlconn, config;
	for(var i = 0; i < channels.length; i++) {
		config = await util.getJsonConfig('mysqlfunc', channels[i].slice(1));
		sqlconn = getSqlConn(config);
		connection = await mysql.createConnection(sqlconn);
		await connection.promise().query('CREATE TABLE IF NOT EXISTS `' + info.name + '` ' + info.content)
			.then(([rows, fields]) => {
				if(rows.length > 0)
					console.log(`[mysql] Table ${info.name} was created in database.`);
			})
			.catch(console.log);
		await connection.end();
	}
}

module.exports.connect = async function (conn, channel) {
	const config = await util.getJsonConfig('mysqlfunc', channel.slice(1));
	conn = conn || getSqlConn(config);
	return await mysql.createConnection(conn);
}

module.exports.qry = async function (connection, qry) {
	if(connection) {
		if(connection.state !== 'disconnected') {
			return await connection.promise().query(qry)
				.then(([rows, fields]) => { return rows; })
				.catch(error => { console.log(error) });
		}
		else
			console.log(`[mysql] Error: Connection disconnected.`);
	}
	else
		console.log(`[mysql] Error: Connection not found.`);
	return false;
}

module.exports.end = async function (connection) {
	if(connection && connection.state !== 'disconnected')
		return await connection.end();
	return false;
}

function getSqlConn(config) {
	return {
		host: config.host,
		user: config.user,
		password: config.password,
		port: config.port,
		database: config.database
	}
}