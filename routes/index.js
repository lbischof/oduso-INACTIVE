var express = require('express');
var MongoDb = require("mongodb");
var mongojs = require('mongojs');
var fs = require('fs');
var multiparty = require('multiparty');
var router = express.Router();
var bcrypt = require('bcrypt-nodejs');
var connection_string = '127.0.0.1:27017/app';
var passport = require('passport'), LocalStrategy = require('passport-local').Strategy;
var md5 = require('MD5');


// if OPENSHIFT env variables are present, use the available connection info:
if(process.env.OPENSHIFT_MONGODB_DB_PASSWORD){
	connection_string = process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
	process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
	process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
	process.env.OPENSHIFT_MONGODB_DB_PORT + '/' +
	process.env.OPENSHIFT_APP_NAME;
}
var db = mongojs(connection_string, ['apps','users','scripts']);

passport.serializeUser(function(user, done) {
	done(null, user);
});

passport.deserializeUser(function(user, done) {
	done(null, user);
});


passport.use(new LocalStrategy(
	function(username, password, done) {
		db.users.findOne({ username: username }, function(err, user) {
			if (err) { return done(err); }
			if (!user) {
				return done(null, false, { message: 'Incorrect username.' });
			}
			bcrypt.compare(password, user.password, function(err, res) {
				if (res)
					return done(null, user);

				return done(null, false, { message: 'Incorrect password.' });
			});
		});
	}
	));



/* GET home page. */

router.get('/', function(req, res) {
	db.apps.find({}, function(err,docs){ //get themes
		var types = docs.reduce(function(buckets,doc){
			if(!buckets[doc.type]) buckets[doc.type] = [];
			buckets[doc.type].push(doc);
			return buckets;
		},{});
		//console.log(docs);
		res.render('index', {title: 'oduso', types: types});
	});
});
router.get('/oduso-:id.sh/:option?',function(req, res){
	db.scripts.findOne({uid: req.params.id}, function (error, result) {
		var script = result.script;
		res.set('Content-Type', 'text/plain');
		if (req.params.option == "log"){
			script = script.replace(/&>.\/dev\/null/g, "&>> ~/oduso-log-"+req.params.id+".txt").replace("&>>", "&>");
		} else if (req.params.option == "download") {
   			res.set({"Content-Disposition":"attachment; filename=\"oduso-"+req.params.id+".sh\""});
		} 
		res.send(script);
	});
});

function generateUID() {
	return ("0000" + (Math.random()*Math.pow(36,4) << 0).toString(36)).slice(-4)
}
function generateWgetCommand(uid, host){
	var link = host+"/oduso-"+uid+".sh";
	var output = {};
	output.command = "wget -O - "+link+" | bash";
	output.link = "http://"+link;
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
router.post('/generate', function(req, res){
	var ids = req.body.apps;
	
	if (req.body.themes || req.body.icons){
		if (!ids) {
			ids = [];
		}
		ids = ids.concat(req.body.themes);
		ids = ids.concat(req.body.icons);
		ids.push("540747336fcf61f2a00c140a");
	}
	var whenDone = req.body.whenDone;
	var whenDoneCommand = getCommand(whenDone);
	var host = req.get('host');
	if (ids){
		ids = ids.map(function(id) { return mongojs.ObjectId(id); });
		db.apps.find({_id: {$in: ids}}, {_id: 0}, function(err, docs){
			var ppas = [];
			var hastmp = false;
			var hasarch = false;
			var hasppa = false;
			var hasdistro = false;
			var installTweaks = false;
			docs.forEach(function(element, index, array){
				if (element.ppa) {
					if (element.ppa.match(/^ppa:/))
						element.ppa = "apt-add-repository "+element.ppa+" -y";
					ppas.push(element.ppa);
					hasppa = true;
				}
			});
			
			if (JSON.stringify(docs).indexOf("$tmp") > -1) 
				hastmp = true;
			
			if (JSON.stringify(docs).indexOf("$arch") > -1) 
				hasarch = true;
			
			if (JSON.stringify(docs).indexOf("$distro") > -1) 
				hasdistro = true;

			docs.sort(compare);
			
			res.render('script', {docs: docs, ppas: ArrNoDupe(ppas), whenDone: whenDoneCommand, hastmp: hastmp, hasarch: hasarch, hasppa: hasppa, hasdistro: hasdistro}, function(err, html){
				db.scripts.findOne({md5:md5(html)},function(err, docs){
					if (docs){
						res.send(generateWgetCommand(docs.uid, host));
					} else {
						db.scripts.insert({"script":html, "uid":generateUID(), "md5":md5(html)}, function(err, docs){
							res.send(generateWgetCommand(docs.uid, host));
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
	db.apps.find({type:'app'},{name:1, imageType: 1, desc: 1}).sort({name:1} ,function(err, docs){
		res.json(docs);
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
/* ADMIN */


router.get('/admin*', isLoggedIn, isAdmin);
router.get('/admin', function(req,res) {
	res.redirect('/admin/list');
});
router.get('/admin/list', function(req,res){
	db.apps.find({},{image: 0},function(err, docs){
		var types = docs.reduce(function(buckets,doc){
			if(!buckets[doc.type]) buckets[doc.type] = [];
			buckets[doc.type].push(doc);
			return buckets;
		},{});
		console.log(types);
		for(var index in types) {
			types[index].sort(function(a, b){
				return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
			});
		}

		res.render('list', {docs: types});
	});
});
router.get('/admin/remove/:id', function(req,res){
	db.apps.remove({_id: new mongojs.ObjectId(req.params.id)}, function(err, docs){
		res.redirect('/admin/list');
	});
});
router.get('/admin/upsert/:id?', function(req,res){
	if (req.params.id) {
		db.apps.findOne({_id: new mongojs.ObjectId(req.params.id)}, function(err, docs){
			console.log(docs);
			res.render('upsert', {doc: docs});
		});
	} else {
		res.render('upsert');
	}
});

router.post('/admin/upsert/:id?', function(req, res){	
	var form = new multiparty.Form();
	var input = {};
	form.parse(req, function(err, fields, files) {
		fs.readFile(files.image[0].path, function(err, data){
			var image = new MongoDb.Binary(data);
			if (image.position > 0) {
				input.image = image
				input.imageType = files.image[0].headers['content-type'];
			}
			
			input.name = fields.name.toString();
			input.echo = fields.echo.toString();
			input.command = fields.command.toString();
			input.command = input.command.replace(/\r\n/g,"\n");
			input.ppa = fields.ppa.toString();
			input.ppa = input.ppa.replace(/\r\n/g,"\n");
			input.desc = fields.desc.toString();
			input.type = fields.type.toString();
			input.link = fields.link.toString();
			if (req.params.id) {
				db.apps.update(
					{_id: new mongojs.ObjectId(req.params.id)},
					{ $set:  input },
					function(err, docs){
						console.log(err);
						console.log(docs);
						res.redirect('/admin/list');
					});
			} else {
				db.apps.update(
					{name:input.name},
					input,
					{upsert: true},
					function(err, docs){
						res.redirect('/admin/list');
					});
			}
		});
	});
});
router.get('/everything', function(req,res){
	
	var host = "oduso.com";
	
		db.apps.find(function(err, docs){
			var ppas = [];
			docs.forEach(function(element, index, array){
				if (element.ppa) {
					if (element.ppa.match(/^ppa:/))
						element.ppa = "apt-add-repository "+element.ppa+" -y";
					ppas.push(element.ppa);
				}
			});
			
			res.render('script', {docs: docs, ppas: ArrNoDupe(ppas), hastmp: true, hasarch: true, hasppa: true, hasdistro: true}, function(err, html){
				res.set('Content-Type', 'text/plain');
				var script = html.replace(/&>.\/dev\/null/g, "&>> ~/oduso-everything.txt").replace("&>>", "&>");
				res.send(script);
			});
		});

});
function isLoggedIn(req, res, next) {
	console.log(req.url);
	// if user is authenticated in the session, carry on 
	if (req.isAuthenticated())
		return next();

	// if they aren't redirect them to the home page
	res.redirect('/login');
}

function isAdmin(req, res, next){ 
	if (req.isAuthenticated() && req.user.group === 'admin')
		next();
	else
		res.send(401, 'Unauthorized');
}

module.exports = router;
