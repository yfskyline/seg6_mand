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

let mysqlConfig = {
	connectionLimit: 20,
	host: 'localhost',
	port: 13306,
	user: 'root',
	password: 'root',
	database: 'rtt_db',
	timezone: 'jst'
};

// Get new prefix/sid/rtt from rtt_db
// connect to MySQL
const connection = mysql.createConnection(mysqlConfig);
connection.connect();




// get all rows with ID greater than lastID
let query = 'SELECT * FROM `rtt_db`.`prefix_sid_rtt` WHERE id > ' + lastId
connection.query(query, (error, results, fields) => {
	if (error) throw error;
	if (!results.length) {
		console.log('THERE IS NO NEW PREFIX');
		return;
	} else {
		results.forEach(function(result) {
			if (result.sid === null) {
				if (options.debug) { console.log('NULL!!!'); }
				// etcdからそのprefixの全てのsidを取得
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

			} else {
				// rtt_dbから同じprefix/sidを持つrowの中からidが最大のものをそれぞれ取得
				// 全てのprefix/sidの中でRTTが最小のsidを取得
				if (options.debug) { console.log('NOT NULL SID!!!'); }
				// 該当するprefixのsid/rttをMySQLから取得して，各sidでidが一番大きいものを取得
				query = createQueryMinRttRow(result.sid, result.dst_prefix);
				(async() =>{
					let test = await getSids(result.dst_prefix.replace('/','_'));
					let parsed = JSON.parse(test);

					parsed.forEach(function(e) {
					});
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


function createQueryMinRttRow(sid, dst_prefix) {
	return 'SELECT * FROM `rtt_db`.`prefix_sid_rtt` WHERE sid = "' + sid + '" AND dst_prefix = "' + dst_prefix + '" AND sid != "NULL" ORDER BY id DESC LIMIT 1;';
}


// 複数のprefix_sidをipコマンドで埋め込む関数
function addRoute(prefix, sids, preferSid) {
	console.log(prefix);
	console.log(sids);
	console.log(preferSid);
}


// get sids[] using prefix
async function getSids(prefix) {
	const sids = await client.get('/prefixes/'+prefix).string();
	return sids.split(',');
}


async function getNexthop() {
	//const allFValues = await client.getAll().prefix('/epe/nexthop-list').keys();
	// 多分ここは，keys()で一覧を取得して，keyごとにvalueを取得するのが本来の使い方(間でkeyの枝刈りなどの処理ができるから)
	const allFValues = await client.getAll().prefix('/epe/nexthop-list');
	Object.values(allFValues).forEach(function(e) {
		let row = JSON.parse(e);
		if (row.active == true) {
			let command = 'sudo ip -6 nexthop replace id ' + eightHash(row.sid) + ' encap seg6 mode encap segs ' + row.sid + ' dev ens192 proto 200';
			execSync(command);
		} else {
			//console.log('ここにきたやつはwithdraw');
			let command = 'sudo ip -6 nexthop delete id ' + eightHash(row.sid) + ' encap seg6 mode encap segs ' + row.sid + ' dev ens192 proto 200';
			execSync(command);
		}
	})
}


// Hash and convert to an 8-digit string numberes
function eightHash(str) {
        const md5 = crypto.createHash('md5');
        let temp = md5.update(str, 'binary').digest('hex');
        temp = String(parseInt(temp.replace(/[^0-9]/g, '').slice(-8)));
        return temp;
}


function renewSidNexthopObj(){
	if (options.debug) {console.log('Interval: renewSidNextHopObj()'); }
	(async() => {
		await getNexthop();
	})();
}


function updateRoutes() {
	if (options.debug) { console.log('updateRoutes()'); }
}


// prefixを引数にしてetcdから該当するprefix_sid_listを取得する関数
function updateEtcd() {
	if (options.debug) { console.log('updateEtcd()') }
}


function main() {
	// etcdから現在有効なSIDのリストを取得して，無効になったSIDがあったらそのNH-Objectを削除して，増えたNH-Objectがあったらそれを追加する
	setInterval(renewSidNexthopObj, 3000);


	// etcdからprefix全てを取得して，etcdからprefixごとに対応するsidのリストを取得して，rtt_dbからprefix/sidごとのRTTを取得してベストprefixを決めて，WeightedECMPの割合を7:1:1:1で入れてFIBに入れる
	setInterval(updateRoutes, 5000);
	
	// rtt_dbから最新のprefix/sidを取得して,etcdPrefixes()
	setInterval(updateEtcd, 10000);
}

main();

// show current routes
if (options.debug) {
	let commandResult = execSync('ip -6 route show');
	console.log(`$ ip -6 route show: \n${stdout.toString()}`); 
}

connection.end();
if (options.debug) { console.log("*******DEBUG MODE********"); }
