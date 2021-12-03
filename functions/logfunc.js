const functions = require("../functions");
const util = require("../util");

// Database table info
const sql_table = {
	name: 'logs',
	content: '( `date` DATE NOT NULL DEFAULT CURRENT_TIMESTAMP, `time` TIME NOT NULL DEFAULT CURRENT_TIMESTAMP, `logged_from` VARCHAR(64) NOT NULL, `log` VARCHAR(256) NOT NULL) ENGINE = MyISAM  DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;'
};

module.exports.OnLoad = async function (client, channels) {
	await util.checkFuncConfig(channels, 'logfunc', {
		enabled: 'true'
	});

	var mysqlfunc = functions.get(`mysqlfunc`);
	await mysqlfunc.loadTable(sql_table, channels);
}

// Logs messages in log channel
module.exports.log = async function (func, msg, conn, channel) {
	const mysqlfunc = functions.get(`mysqlfunc`);
	const connection = conn || await mysqlfunc.connect(null, channel);
	await mysqlfunc.qry(connection, `INSERT INTO ${sql_table.name} (logged_from, log) VALUES ('${func}', '${msg}')`);
	if(!conn)
		await mysqlfunc.end(connection);
}