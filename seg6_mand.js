const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const { execSync } = require('child_process');
const fs = require('fs');
const mysql = require('mysql');
const { Etcd3 } = require('etcd3');
const client = new Etcd3({ hosts: ['http://epe-manager.fujisawa.vsix.wide.ad.jp:2379'] });
const crypto = require('crypto');

const optionDefinitions = [
        {
                name: 'help',
                alias: 'h',
                type: Boolean,
                description: 'show help'
        },
        {
                name: 'debug',
                alias: 'd',
                type: Boolean,
                description: 'Debug Mode'
        },
		{
			name: 'epsilon',
			alias: 'e',
			type: Number,
			description: 'epsilon for epsilon-greedy algorithm',
			defaultValue: 0.6
		},
		{
			name: 'sid',
			alias: 's',
			type: Number,
			description: 'default SID used before RTT data acquisition',
			defaultValue: 100
		},
];

const sections = [
        {
                header: 'seg6_mand.js',
                content: 'obtain a route and update the FIB with the route with the smallest RTT'
        },
        {
                header: 'Options',
                optionList: optionDefinitions
        }
];

const options = commandLineArgs(optionDefinitions);
if(options.help) {
        const usage = commandLineUsage(sections);
        console.log(usage);
        process.exit(0);
}

if (options.debug) { console.log("*******DEBUG MODE********"); }

// Variable Declaration
// epsilong greedy algorithm's parameter
if (options.debug) {console.log('epsilon: ' + options.epsilon);}

// PassiveRTTが何も取得できていない場合に用いるデフォルトSID
if (options.debug) {console.log('default SID: ' + options.sid);}

// read the last rtt_db id got from file
const lastId = parseInt(fs.readFileSync("lastId.txt", {encoding: 'utf-8'}));
if (options.debug) { console.log('lastId: ' + lastId); }

// Current Routes
const stdout = execSync('ip -6 route show');
if (options.debug) { console.log("*******CURRENT ROUTE********"); }
if (options.debug) { console.log(`$ ip -6 route show: \n${stdout.toString()}`); }


// Get new prefix/sid/rtt from rtt_db
// Connect to MySQL
const connection = mysql.createConnection({

	host: 'localhost',
	port: 13306,
	user: 'root',
	password: 'root',
	database: 'rtt_db',
	timezone: 'jst'
});

connection.connect();
// get all rows with ID greater than lastID
connection.query('SELECT * FROM `rtt_db`.`prefix_sid_rtt` WHERE id > ' + lastId, (error, results, fields) => {
	if (error) throw error;
	if (!results.length) {
		console.log('THERE IS NO NEW PREFIX');
		return;
	} else {
		results.forEach(function(result) {
			if (options.debug) {
				console.log(result);
				console.log('result.id: ' +  result.id);
				console.log('results.dst_prefix: ' + result.dst_prefix);
				console.log('results.sid: ' + result.sid);
				console.log('results.rtt: ' + result.rtt);
			}

			// sidがNULLかどうか
			if (result.sid === null) {
				console.log('NULL!!!');
				// nullだったら，etcdからそのprefixの全てのsidを取得
				// 取得したprefixの1つ目はweightedECMPの優先側として経路をreplace

				// get sids corresponding to dst_prefix from etcd
				(async() =>{
					let test = await getSids(result.dst_prefix.replace('/','_'));
					let parsed = JSON.parse(test);

					parsed.forEach(function(e) {
						let command = 'sudo ip -6 nexthop replace id ' + eightHash(e.sid) + ' encap seg6 mode encap segs ' + e.sid + ' dev ens192 proto 200';
						execSync(command);
					});
					// 最初のSIDのweightを7にしてNH-Groupを作成する
					let groupContents = '';
					for (i = 1; i < parsed.length; i++) {
						groupContents += eightHash(parsed[i].sid);
						groupContents += ',1/';
					}
					let command = 'sudo ip nexthop replace id ' + eightHash(result.dst_prefix) + ' group ' + eightHash(parsed[0].sid) + ',7/' + groupContents.slice(0,-1) +  ' proto 200';
					execSync(command);
					// result.dst_prefix宛の経路を作成したNH-Groupにreplaceする
					command = 'sudo ip -6 route replace ' + result.dst_prefix + ' nhid ' + eightHash(result.dst_prefix) + ' proto 200';
				})()

				// addRoute(prefix, sids, preferSid);
			} else {
				// rtt_dbから同じprefix/sidを持つrowの中からidが最大のものをそれぞれ取得
				// 全てのprefix/sidの中でRTTが最小のsidを取得
				// addRoute(prefix, sids, preferSid);
				console.log('NOT NULL SID!');
				// 該当するprefixのsid/rttをMySQLから取得して，各sidでidが一番大きいものを取得
				//
				(async() =>{
					let test = await getSids(result.dst_prefix.replace('/','_'));
					let parsed = JSON.parse(test);
					console.log(parsed);
				})();
			}
		});
		console.log('=======Processed ' + results[results.length-1].id + ' Prefix========');
		// write the current id to the file
		fs.writeFileSync("lastId.txt", results[results.length-1].id.toString(), 'utf-8', (err) =>{
			if (err) {
				console.log(err);
			}
		});
	}
});
connection.end();


// 複数のprefix_sidをipコマンドで埋め込む関数
function addRoute (prefix, sids, preferSid) {
	console.log('======ADDED ROUTE=======');
	console.log(prefix);
	console.log(sids);
	console.log(preferSid);
}

let prefix = '2001:db8:1234:ffff::/64'; // test-data

let sid = '2001:db8:1111:ffff::2'; // test-data
let command = 'sudo ip -6 route replace ' + prefix + ' encap seg6 mode encap segs ' + sid + ' dev ens192 ';
//addRoute(prefix, sids, sid);
let preResult = execSync(command);
// 既存の経路があったときにうまく処理する

// get sids[] using prefix
async function getSids(prefix) {
	//await client.put('foo').value('bar');
	//const fooValue = await client.get('foo').string();
	const sids = await client.get('/prefixes/'+prefix).string();
	//sidsList = sids.split(',');
	//console.log('sids are:', sidsList);
	//console.log('sids are:', sids);
	//return sids.split(',');
	return sids.split(',');
	//const allFValues = await client.getAll().prefix('f').keys();
	//console.log('all our keys starting with "f":', allFValues);
	//await client.delete().all();
}


// 既存の経路のsidの優先順位が逆転した場合にイプシロングリーディのベストSIDを入れ替える関数
//console.log(options.epsilon);
// prefixを引数にしてetcdから該当するprefix_sid_listを取得する関数


// ハッシュをとって数字8桁にする関数
function eightHash(str) {
        const md5 = crypto.createHash('md5');
        let temp = md5.update(str, 'binary').digest('hex');
        temp = String(parseInt(temp.replace(/[^0-9]/g, '').slice(-8)));
        return temp;
}


// 最終的な現在の経路を表示
if (options.debug) {
	let commandResult = execSync('ip -6 route show');
	console.log(`$ ip -6 route show: \n${stdout.toString()}`); 
}

if (options.debug) { console.log("*******DEBUG MODE********"); }
