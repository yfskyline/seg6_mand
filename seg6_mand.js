const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const { execSync } = require('child_process');
const fs = require('fs');
const mysql = require('mysql');

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
if (options.debug) {console.log(`$ ip -6 route show: \n${stdout.toString()}`);}


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
connection.query('SELECT * FROM `prefix_sid_rtt` WHERE id > ' + lastId, (error, results, fields) => {
	if (error) throw error;
	console.log(results[0]);
	console.log(results[0].id);
	console.log(results[0].dest_prefix);
	console.log(results[0].sid);
	console.log(results[0].rtt);
	console.log('results.length' + results[results.length-1].id);
	// write the current id to the file
	fs.writeFileSync("lastId.txt", results[results.length-1].id.toString(), 'utf-8', (err) =>{
		if (err) {
			console.log(err);
		}
	});

});
connection.end();

// id以上のrowを全て取得


// 取得した経路を1つ1つループ処理
	// sidがNULLかどうかで場合分け
	// NULLだった場合
		// /etcdから該当prefixのsid一覧を取得する
			// getSid(prefix)
			// デフォルトSIDを優先して，経路を埋め込む
		// sid一覧を取得する
		// 
	// sidがある場合
		// rtt_dbから同じprefixを持つrowをsidが最大のものをそれぞれ取得してくる
		// RTTが最小のsidを取得
		// 経路のベストSIDを指定してprefixのFIBへの埋め込み





// 複数のprefix_sidをipコマンドで埋め込む関数
// 既存の経路があったときにうまく処理する
// prefixとsidリストとコストを引数で取る

// 既存の経路のsidの優先順位が逆転した場合にイプシロングリーディのベストSIDを入れ替える関数

// prefixを引数にしてetcdから該当するprefix_sid_listを取得する関数

if (options.debug) { console.log("*******DEBUG MODE********"); }
