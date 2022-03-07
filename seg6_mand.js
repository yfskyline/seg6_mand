const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const { execSync } = require('child_process');
const fs = require('fs');
const mysql = require('mysql');
const { Etcd3 } = require('etcd3');
const client = new Etcd3({ hosts: ['http://epe-manager.fujisawa.vsix.wide.ad.jp:2379'] });

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
				console.log('results.dst_prefix: ' + result.dest_prefix);
				console.log('results.sid: ' + result.sid);
				console.log('results.rtt: ' + result.rtt);
			}

			// sidがNULLかどうか
			if (result.sid === null) {
				console.log('NULL!!!');
				// etcdから該当prefixの一覧を取得する
				// getSid(prefix)
				// デフォルトSIDを優先して(もしくは適当にどちらかを優先して)経路を埋め込む
				// addRoute(prefix, sids, preferSid);
			} else {
				// rtt_dbから同じprefix/sidを持つrowの中からidが最大のものをそれぞれ取得
				// 全てのprefix/sidの中でRTTが最小のsidを取得
				// addRoute(prefix, sids, preferSid);
				console.log('NOT NULL SID!');
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
	console.log('ADDROUTE');
	console.log(prefix);
	console.log(sids);
	console.log(preferSid);
}
let command = 'ip -6 route add';
let prefix = '::/0';
let sid = '2001:db8:1111:ffff::2';
let sids = ['0', '1'];
//addRoute(prefix, sids, sid);
let commandResult = execSync('ip -6 route show');
if (options.debug) { console.log(`$ ip -6 route show: \n${stdout.toString()}`); }
// 既存の経路があったときにうまく処理する

// get sids[] using prefix
async function getSids(prefix) {
	//await client.put('foo').value('bar');
	//const fooValue = await client.get('foo').string();
	const sids = await client.get(prefix).string();
	console.log('sids are:', sids);
	return sids;
	//const allFValues = await client.getAll().prefix('f').keys();
	//console.log('all our keys starting with "f":', allFValues);
	//await client.delete().all();
}


// 既存の経路のsidの優先順位が逆転した場合にイプシロングリーディのベストSIDを入れ替える関数
//console.log(options.epsilon);
// prefixを引数にしてetcdから該当するprefix_sid_listを取得する関数

if (options.debug) { console.log("*******DEBUG MODE********"); }
