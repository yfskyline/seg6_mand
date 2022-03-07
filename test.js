const { exec } = require('child_process')
const mysql = require('mysql');
const crypto = require('crypto');



const connection = mysql.createConnection({
	host: 'localhost',
	port: 13306,
	user: 'root',
	password: 'root',
	database: 'rtt_db'
});

connection.connect();
connection.query('SELECT "Hello World!" AS text', (error, results, fields) => {
	if (error) throw error;
	console.log(results[0].text);
});

connection.end();

function md5hex(str) {
	const md5 = crypto.createHash('md5');
	let temp = md5.update(str, 'binary').digest('hex');
	temp = String(parseInt(temp.replace(/[^0-9]/g, '').slice(-8)));
	return temp;
}

let data = md5hex('6e809cbda0732ac4845916a59016f954');
console.log(data);
