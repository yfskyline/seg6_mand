const commandLineArgs = require("command-line-args");
const commandLineUsage = require("command-line-usage");
const { execSync } = require("child_process");
const fs = require("fs");
const mysql = require("mysql");
const { Etcd3 } = require("etcd3");
const client = new Etcd3({
  hosts: ["http://epe-manager.fujisawa.vsix.wide.ad.jp:2379"],
});
const crypto = require("crypto");

const optionDefinitions = [
  {
    name: "help",
    alias: "h",
    type: Boolean,
    description: "show help",
  },
  {
    name: "debug",
    alias: "d",
    type: Boolean,
    description: "Debug Mode",
  },
  {
    name: "epsilon",
    alias: "e",
    type: Number,
    description: "epsilon for epsilon-greedy algorithm",
    defaultValue: 0.6,
  },
  {
    name: "sid",
    alias: "s",
    type: Number,
    description: "default SID used before RTT data acquisition",
    defaultValue: 100,
  },
];

const sections = [
  {
    header: "seg6_mand.js",
    content:
      "obtain a route and update the FIB with the route with the smallest RTT",
  },
  {
    header: "Options",
    optionList: optionDefinitions,
  },
];

const options = commandLineArgs(optionDefinitions);
if (options.help) {
  const usage = commandLineUsage(sections);
  console.log(usage);
  process.exit(0);
}

if (options.debug) {
  console.log("*******DEBUG MODE********");
}

// Variable Declaration
// epsilong greedy algorithm's parameter
if (options.debug) {
  console.log(`epsilon: ${options.epsilon}`);
}

// PassiveRTTが何も取得できていない場合に用いるデフォルトSID
if (options.debug) {
  console.log(`default SID: ${options.sid}`);
}

// read the last rtt_db id got from file
const lastId = parseInt(fs.readFileSync("lastId.txt", { encoding: "utf-8" }));
if (options.debug) {
  console.log(`lastId: ${lastId}`);
}

// Current Routes
const stdout = execSync("ip -6 route show");
if (options.debug) {
  console.log("*******CURRENT ROUTE********");
}
if (options.debug) {
  console.log(`$ ip -6 route show: \n${stdout.toString()}`);
}

let mysqlConfig = {
  connectionLimit: 20,
  host: "localhost",
  port: 13306,
  user: "root",
  password: "root",
  database: "rtt_db",
  timezone: "jst",
};

// Get new prefix/sid/rtt from rtt_db
// connect to MySQL
const connection = mysql.createConnection(mysqlConfig);

// get all rows with ID greater than lastID
let query = `SELECT * FROM \`rtt_db\`.\`prefix_sid_rtt\` WHERE id > ${lastId}`;
/*
connection.query(query, (error, results, fields) => {
  if (error) throw error;
  if (!results.length) {
    console.log("THERE IS NO NEW PREFIX");
    return;
  } else {
    results.forEach(function (result) {
      if (result.sid === null) {
        if (options.debug) {
          console.log("NULL!!!");
        }
        // etcdからそのprefixの全てのsidを取得
        // 取得したprefixの1つ目はweightedECMPの優先側として経路をreplace

        // get sids corresponding to dst_prefix from etcd
        (async () => {
          // let test = await getSids(result.dst_prefix);
          // let parsed = JSON.parse(test);

          parsed.forEach(function (e) {
            let command =
              "sudo ip -6 nexthop replace id " +
              eightHash(e.sid) +
              " encap seg6 mode encap segs " +
              e.sid +
              " dev ens192 proto 200";
            execSync(command);
          });
          // 最初のSIDのweightを7にしてNH-Groupを作成する
          let groupContents = "";
          for (i = 1; i < parsed.length; i++) {
            groupContents += eightHash(parsed[i].sid);
            groupContents += ",1/";
          }
          let command =
            "sudo ip nexthop replace id " +
            eightHash(result.dst_prefix) +
            " group " +
            eightHash(parsed[0].sid) +
            ",7/" +
            groupContents.slice(0, -1) +
            " proto 200";
          execSync(command);
          // result.dst_prefix宛の経路を作成したNH-Groupにreplaceする
          command =
            "sudo ip -6 route replace " +
            result.dst_prefix +
            " nhid " +
            eightHash(result.dst_prefix) +
            " proto 200";
        })();
      } else {
        // rtt_dbから同じprefix/sidを持つrowの中からidが最大のものをそれぞれ取得
        // 全てのprefix/sidの中でRTTが最小のsidを取得
        if (options.debug) {
          console.log("NOT NULL SID!!!");
        }
        // 該当するprefixのsid/rttをMySQLから取得して，各sidでidが一番大きいものを取得
        query = createQueryMinRttRow(result.sid, result.dst_prefix);
        (async () => {
          // let test = await getSids(result.dst_prefix);
          // let parsed = JSON.parse(test);

          //parsed.forEach(function (e) {});
        })();
      }
    });
    console.log(
      `=======Processed ${results[results.length - 1].id} Prefix========`
    );
    // write the current id to the file
    fs.writeFileSync(
      "lastId.txt",
      results[results.length - 1].id.toString(),
      "utf-8",
      (err) => {
        if (err) {
          console.log(err);
        }
      }
    );
  }
});
*/
function createQueryMinRttRow(sid, dst_prefix) {
  return (
    `SELECT * FROM \`rtt_db\`.\`prefix_sid_rtt\` WHERE sid = "${sid}" AND dst_prefix = "${dst_prefix}" AND sid != "NULL" ORDER BY id DESC LIMIT 1;`
  );
}

// 複数のprefix_sidをipコマンドで埋め込む関数
function addRoute(prefix, sids, preferSid) {
  console.log(prefix);
  console.log(sids);
  console.log(preferSid);
}

// get sids[] using prefix
async function getSids(prefix) {
  //const sids = await client.get("/prefixes/" + prefix.replace("/", "_")).string();
  const sids = await client.get("/epe/sid-and-prefixes/" + prefix.replace("/", "_")).string();
  return sids.split(",");
}

async function getNexthop() {
  //const nexthopList = await client.getAll().prefix('/epe/nexthop-list').keys();
  // 多分ここは，keys()で一覧を取得して，keyごとにvalueを取得するのが本来の使い方(間でkeyの枝刈りなどの処理ができるから)
  const nexthopList = await client.getAll().prefix("/epe/nexthop-list");
  Object.values(nexthopList).forEach(function (e) {
    let row = JSON.parse(e);
    if (row.active == true) {
      let command =
        "sudo ip -6 nexthop replace id " +
        eightHash(row.sid) +
        " encap seg6 mode encap segs " +
        row.sid +
        " dev ens192 proto 200";
      execSync(command);
    } else {
      //console.log('ここにきたやつはwithdraw');
      let command =
        `sudo ip -6 nexthop delete id ${eightHash(row.sid)}`
      execSync(command);
    }
  });
}

// Hash and convert to an 8-digit string numberes
function eightHash(str) {
  const md5 = crypto.createHash("md5");
  let temp = md5.update(str, "binary").digest("hex");
  temp = String(parseInt(temp.replace(/[^0-9]/g, "").slice(-8)));
  return temp;
}

async function registerPrefix(prefix) {
	const to_json = {
		active: true
	}
	const sids = await client.put("/epe/content-servers-prefixes/camp.vsix.wide.ad.jp/" + prefix.replace("/", "_")).value(JSON.stringify(to_json));
	return;
}

function renewSidNexthopObj() {
  if (options.debug) {
    console.log("Interval: renewSidNextHopObj()");
  }
  (async () => {
    await getNexthop();
  })();
}

function updateDefault(){
	let command = "sudo ip nexthop replace id 1000 group 1000"

}

function updateFib(prefix, sids, prefSid) {
	(async () => {
	  let test = await getSids(prefixes);
	  let parsed = JSON.parse(test);

	  // 最初のSIDのweightを7にしてNH-Groupを作成する
	  let groupContents = "";
	  for (i = 1; i < sids.length; i++) {
		groupContents += eightHash(parsed[i].sid);
		groupContents += ",1/";
	  }
	  let command =
		`sudo ip nexthop replace id ${eightHash(prefix)} group ${eightHash(prefSid)},7/${groupContents.slice(0, -1)} proto 200`;
	  execSync(command);

	  // prefix宛の経路を作成したNH-Groupにreplaceする
	  command =
		`sudo ip -6 route replace ${prefix} nhid ${eightHash(prefix)} proto 200 expires 300`;
	  execSync(command);
	})();
}

async function getMyPrefixes() {
	const prefixes = await client.getAll().prefix('/epe/content-servers-prefixes/camp.vsix.wide.ad.jp').keys();
	//const nexthopList = await client.getAll().prefix('/epe/nexthop-list').keys();
		///epe/content-servers-prefixes/camp.vsix.wide.ad.jp/2001:db8:1234::_64
	let list = [];
	prefixes.forEach(function (e) {
		list.push(e.split('/').slice(-1)[0].replace('_','/'));
	});
	return list;
}


function updateRoutes() {
	if (options.debug) { console.log("updateRoutes()");
	}
	(async () => {
		const prefixes = await getMyPrefixes();
		prefixes.forEach(function (e) {
			//const sids = await getSids(e.replace('/','_'));
			//console.log(sids);
		})
	// getSids(prefix);
		// console.log(await getNewestRTT('2001:db8:1234::/64', '2001:200:1111:ffff::2'));
		//console.log(searchPrefSid('2001:db8:1234::/64', getSids('2001:db8:1234::/64')));
		console.log(await searchPrefSid('2001:200::_32'));
	//getCurrentRTT(prefix,sid)
	//prefix/sidごと最短RTTのSIDを計算
	// rtt_dbから同じprefix/sidを持つrowの中からidが最大のものをそれぞれ取得
	// 全てのprefix/sidの中でRTTが最小のsidを取得
	// 該当するprefixのsid/rttをMySQLから取得して，各sidでidが一番大きいものを取得
	  //let test = await //getSids(dst_prefix);
	  //let parsed = JSON.parse(test);

	})();

	// updateFib();
}

async function searchPrefSid(prefix){
	let bestSid = 0;
	let array = {};
	let sids = await getSids(prefix);
	//for await (i = 0; i < sids.length; i++) {
	console.log(`sids: ${JSON.parse(sids)}`);
	for await (sid of JSON.parse(sids)) {
		//array[sids[i]] = await getNewestRTT(prefix, sids[i]);
		let tekitou = []
		//tekitou = await getNewestRTT(prefix, sid.sid);
		tekitou = await getNewestRTT('2001:db8:1234::/64', '2001:200:1111:ffff::2')[0].sid;
		//console.log(`tekitou: ${JSON.stringify(tekitou)}`); // 空のリスト
		//console.log(`tekitou: ${JSON.parse(tekitou[0].sid)}`); // 空のリスト
		console.log(array[sid]);
	}
	// bestSid = array[sids[0]];
	return bestSid;

}

async function getNewestRTT(prefix, sid) {
  let query = createQueryMinRttRow(sid, prefix);
  const queryResult = await new Promise((resolve, reject) => {
    connection.query(query, (error, results, fields) => {
      if (error) {
      		reject(error);
		  return;
      }

      if (!results.length) {
        console.log("THERE IS NO NEW PREFIX");
        resolve(results);
        return;
      }

      // console.log(results);
      console.log(`=======Processed ${results[results.length - 1].id} Prefix========`);

      // write the current id to the file
      fs.writeFileSync(
        "lastId.txt",
        results[results.length - 1].id.toString(),
        "utf-8",
        (err) => {
          if (err) {
            console.log(err);
            reject(err);
          }
        }
      );

      resolve(results);
    });
  });

  return queryResult;
}

// prefixを引数にしてetcdから該当するprefix_sid_listを取得する関数
function pushUsedPrefix() {
	if (options.debug) {
	console.log("updateEtcd()");
	}
	// rtt_dbから使用されたPrefixの一覧を取得
	(async () => {
	  let newPrefixes = await getNewPrefix();
	  console.log(newPrefixes);
      newPrefixes.forEach(function (result) {
		  console.log(result.dst_prefix);
		  registerPrefix(result.dst_prefix);
	  });
	})();

	// etcdにregisterPrefix()
	registerPrefix('2001:db8::/64');

	// /epe/content-servers/camp.vsix.wide.ad.jp/2001:db8::_64
	// “active”: “true”
}

// get all rows with ID greater than lastID
async function getNewPrefix() {
  let queryNewer =
    `SELECT * FROM \`rtt_db\`.\`prefix_sid_rtt\` WHERE id > ${lastId}`;
  const queryResult = await new Promise((resolve, reject) => {
    connection.query(queryNewer, (error, results, fields) => {
      if (error) {
        reject(error);
      }

      if (!results.length) {
        console.log("THERE IS NO NEW PREFIX");
        resolve(results);
        return;
      }

      // console.log(results);
      console.log(`=======Processed ${results[results.length - 1].id} Prefix========`);

      // write the current id to the file
      fs.writeFileSync(
        "lastId.txt",
        results[results.length - 1].id.toString(),
        "utf-8",
        (err) => {
          if (err) {
            console.log(err);
            reject(err);
          }
        }
      );

      resolve(results);
    });
  });

  return queryResult;
}

function main() {
  // etcdから現在有効なSIDのリストを取得して，無効になったSIDがあったらそのNH-Objectを削除して，増えたNH-Objectがあったらそれを追加する
  //setInterval(renewSidNexthopObj, 3000);
  setInterval(renewSidNexthopObj, 1000); // skyline

  // etcdからprefix全てを取得して，etcdからprefixごとに対応するsidのリストを取得して，rtt_dbからprefix/sidごとのRTTを取得してベストprefixを決めて，WeightedECMPの割合を7:1:1:1で入れてFIBに入れる
  // setInterval(updateRoutes, 5000);
  //setInterval(updateRoutes, 1000); // skyline

  // rtt_dbから最新のprefix/sidを取得して,etcdPrefixes()
  // setInterval(pushUsedPrefix, 10000);
  setInterval(pushUsedPrefix, 1000); // skyline
}

main();

// show current routes
if (options.debug) {
  let commandResult = execSync("ip -6 route show");
  console.log(`$ ip -6 route show: \n${stdout.toString()}`);
}

if (options.debug) {
  console.log("*******DEBUG MODE********");
}
