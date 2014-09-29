var express = require('express');
var router = express.Router();

var mongojs = require('mongojs');
var connection_string = '127.0.0.1:27017/oduso';
var md5 = require('MD5');
var cookieParser = require('cookie-parser');
var passport = require('passport'), LocalStrategy = require('passport-local').Strategy;
var ua = require('universal-analytics');
var visitor = ua('UA-55027523-1');

// if OPENSHIFT env variables are present, use the available connection info:
if(process.env.OPENSHIFT_MONGODB_DB_PASSWORD){
	connection_string = process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
	process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
	process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
	process.env.OPENSHIFT_MONGODB_DB_PORT + '/' +
	process.env.OPENSHIFT_APP_NAME;
}
var db = mongojs(connection_string, ['apps','users','scripts','distros']);



/* GET home page. */

router.get('/', function(req, res) {
	res.render('index', {title: 'Oduso Installer for Ubuntu and elementary OS'});
});
router.post('/form', function(req, res){
	if (req.body.distro){
		global.distro = req.body.distro;
		var forever = 60*60*24*365;
		res.cookie('distro',global.distro, { maxAge: forever, httpOnly: false });
		console.log("Set cookie because param was set");
	} else if (req.cookies.distro) {
		global.distro = req.cookies.distro;
		console.log("Cookie already set");
	} else {
		global.distro = "freya";
		console.log("Defaulting to freya");
	}
	getApps(global.distro, function(types){
		res.render('form', {types: types});
	}); 
});
router.get('/oduso-:id.sh/:option?',function(req, res){
    console.log(req.headers['user-agent']);
	if (req.headers['user-agent'].indexOf('Wget') > -1) {
		visitor.event("Script access", "wget", "UID: "+req.params.id).send();
	} else {
		visitor.event("Script access", "browser", "UID: "+req.params.id).send();
	}
	db.scripts.findOne({uid: req.params.id}, function (error, result) {
		var script = result.script;
		res.set('Content-Type', 'text/plain');
		if (req.params.option == "log"){
			script = script.replace(/&>.\/dev\/null/g, "> /dev/null 2>> ~/oduso-log-"+req.params.id+".txt").replace("2>>", "2>");
		} else if (req.params.option == "download") {
			res.set({"Content-Disposition":"attachment; filename=\"oduso-"+req.params.id+".sh\""});
		} 
		res.send(script);
	});
});

router.post('/generate', function(req, res){

	var ids = [];
	if (req.body.apps)
		ids = req.body.apps;
	if (req.body.themes){
		
		ids = ids.concat(req.body.themes);
		//ids.push("540747336fcf61f2a00c140a");
	} 
	if (req.body.icons){
		ids = ids.concat(req.body.icons);

	}

	var whenDone = req.body.whenDone;
	var whenDoneCommand = getCommand(whenDone);
	var host = req.get('host');
	if (ids.length > 0){
		ids = ids.map(function(id) { return mongojs.ObjectId(id); });
		db.apps.find({_id: {$in: ids}}, {_id: 0}, function(err, docs){
			var ppas = [];
			var hastmp = false;
			var hasarch = false;
			var hasppa = false;
			var installTweaks = false;
			var command;
			docs.forEach(function(element, index, array){
				array[index].command = extractValue(element, "command", distro);
				if (array[index].command.indexOf("$tmp") > -1)
					hastmp = true;
				if (array[index].command.indexOf("$arch") > -1) 
					hasarch = true;
				array[index].ppa = extractValue(element, "ppa", distro);
				if (array[index].ppa) {
					ppas.push(array[index].ppa);
					hasppa = true;
				}
			});
			docs.sort(compare);
			
			res.render('script', {docs: docs, ppas: ArrNoDupe(ppas), whenDone: whenDoneCommand, hastmp: hastmp, hasarch: hasarch, hasppa: hasppa, distro: distro}, function(err, html){
				db.scripts.findOne({md5:md5(html)},function(err, docs){
					var uid = generateUID();
					if (docs){
						res.send(generateWgetCommand(docs.uid, host));
						visitor.event("Generate", "old script served", "UID: "+uid+ " Count: "+ids.length, ids.length).send();
					} else {
						db.scripts.insert({"script":html, "uid":uid, "md5":md5(html)}, function(err, docs){
							res.send(generateWgetCommand(docs.uid, host));
							console.log(ids.length);
							visitor.event("Generate", "new script generated", "UID: "+uid+ " Count: "+ids.length, ids.length).send();
						});
					}
				});
			});
		});
} else {
	res.send(400,"Nothing selected. Do you want an empty script?");
}
});
router.post('/api/apps', function(req, res){
	db.apps.find({'command.distros':global.distro, type:'app'},{name:1, imageType: 1, desc: 1}).sort({name:1} ,function(err, docs){
		res.json(docs);
	});
});
router.get('/api/distros/:query?', function(req, res){
	db.distros.find({"value": new RegExp(req.params.query) },{value:1,_id:0}, function(err, docs){
		var items = [];
		docs.forEach(function(element, index){
			items.push(element.value);
		});
		res.json(items);
	});
});
router.get('/image/:id', function(req, res){
	db.apps.findOne({_id: new mongojs.ObjectId(req.params.id)}, function (error, result) {
		if (error)
			res.send(404);
		res.contentType(result.imageType);
		res.end(result.image.buffer, "binary");
	});
});

/* LOGIN + REGISTER */

router.post('/login',
	passport.authenticate('local', { successRedirect: '/admin',
		failureRedirect: '/login',
		failureFlash: true })
	);
router.get('/login', function(req, res){
	res.render('login', {title: 'Login', flash: req.flash('error')});
});

router.post('/register', function(req, res){
	if(req.body.username && req.body.password) {
		bcrypt.hash(req.body.password, null, null, function(err, hash) {
			db.users.ensureIndex({'username':1},{'unique':true});
			db.users.insert({
				username: req.body.username,
				password: hash
			}, function(err, docs){
				if (err) {
					req.flash('error', 'Username already exists');
					res.redirect('/register');
				} else {
					console.log(docs);
					req.login(docs, function(err){
						res.redirect('/');
					});
				}
			});
		});
	} else {
		req.flash('error', 'Missing credentials');
		res.redirect('/register');
	}
});
router.get('/register', function(req, res){
	res.render('login', {title: 'Register', flash: req.flash('error')});
});

router.get('/test/:distro', function(req,res){
	var distro = req.params.distro;
	var host = "oduso.com";
	var hasppa = false;
	db.apps.find({'command.distros': distro}, function(err, docs){
		var ppas = [];
		docs.forEach(function(element, index, array){
			array[index].command = extractValue(element, "command", distro);
			array[index].ppa = extractValue(element, "ppa", distro);
			if (array[index].ppa) {
				ppas.push(array[index].ppa);
				hasppa = true;
			}
		});

		res.render('script', {docs: docs, ppas: ArrNoDupe(ppas), hastmp: true, hasarch: true, hasppa: hasppa, distro: distro}, function(err, html){
			res.set('Content-Type', 'text/plain');
			var script = html.replace(/&>.\/dev\/null/g, "> /dev/null 2>> ~/oduso-everything.txt").replace("2>>", "2>");
			res.send(script);
		});
	});

});

function getApps(distro, callback){
	db.apps.find({'command.distros':distro}, function(err,docs){ //get themes
		var types = docs.reduce(function(buckets,doc){
			if(!buckets[doc.type]) buckets[doc.type] = [];
			buckets[doc.type].push(doc);
			return buckets;
		},{});
		callback(types);
	});
}
function generateUID() {
	return ("0000" + (Math.random()*Math.pow(36,4) << 0).toString(36)).slice(-4)
}
function generateWgetCommand(uid, host){
	var link = "https://"+host+"/oduso-"+uid+".sh";
	var output = {};
	output.command = "wget -O - "+link+" | bash";
	output.link = link;
	return JSON.stringify(output);
}
function ArrNoDupe(a) {
	var temp = {};
	for (var i = 0; i < a.length; i++)
		temp[a[i]] = true;
	var r = [];
	for (var k in temp)
		r.push(k);
	return r;
}
function compare(a,b) {
	if (a.type < b.type)
		return -1;
	if (a.type > b.type)
		return 1;
	return 0;
}
function getCommand(whenDone){
	var command;
	switch(whenDone) {
		case "Rebooting":
		command = "shutdown -r now";
		break;
		case "Shutting Down":
		command = "shutdown -h now";
		break;
		case "Suspending":
		command = "pm-suspend";
		break;
		case "Hibernating":
		command = "pm-hibernate";
		break;
		default:
		return false;
	}
	command = "echo \""+whenDone+" in 10 Seconds, CTRL + C to cancel!\"\nsleep 10\n"+command;
	return command;
}
Array.prototype.contains = function(element){
	return this.indexOf(element) > -1;
};
function extractValue(source, type, distro){
	var filtered = [];
	filtered = source[type].filter(function(element){
		return element.distros.contains(distro); //filter out the elements that aren't targeted at the distro
	});
	if (filtered.length > 0){ //check if the filter returned an element
		var value = filtered[0][type];
		if (type == "ppa" && value.match(/^ppa:/))
			value = "apt-add-repository "+value+" -y";
		return value; //return the end value
	} else {
		return false;
	}
}
module.exports = router;
