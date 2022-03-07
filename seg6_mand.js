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
// 変数宣言
// イプシロングリーディのイプシロンの値
if (options.debug) {console.log('epsilon: ' + options.epsilon);}

// PassiveRTTが何も取得できていない場合に用いるデフォルトSID
if (options.debug) {console.log('default SID: ' + options.sid);}

// 現在の経路
const stdout = execSync('ip -6 route show');
if (options.debug) { console.log("*******CURRENT ROUTE********"); }
if (options.debug) {console.log(`$ ip -6 route show: \n${stdout.toString()}`);}


// 最新の経路の取得(from rtt_db)
// ファイルから最後に読み込んだ経路のidを読み込み
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
