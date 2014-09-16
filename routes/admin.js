var express = require('express');
var router = express.Router();

var MongoDb = require("mongodb");
var mongojs = require('mongojs');
var fs = require('fs');
var multiparty = require('multiparty');
var bcrypt = require('bcrypt-nodejs');
var connection_string = '127.0.0.1:27017/oduso';
var passport = require('passport'), LocalStrategy = require('passport-local').Strategy;
var md5 = require('MD5');
var cookieParser = require('cookie-parser');

// if OPENSHIFT env variables are present, use the available connection info:
if(process.env.OPENSHIFT_MONGODB_DB_PASSWORD){
	connection_string = process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
	process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
	process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
	process.env.OPENSHIFT_MONGODB_DB_PORT + '/' +
	process.env.OPENSHIFT_APP_NAME;
}
var db = mongojs(connection_string, ['apps','users','scripts','distros']);


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


router.get('*', isLoggedIn, isAdmin);
router.get('/', function(req,res) {
	res.redirect('/admin/list');
});
router.get('/list', function(req,res){
	/*db.apps.find({},{image: 0},function(err, docs){
		var types = docs.reduce(function(buckets,doc){
			if(!buckets[doc.type]) buckets[doc.type] = [];
			buckets[doc.type].push(doc);
			return buckets;
		},{});
		for(var index in types) {
			types[index].sort(function(a, b){
				return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
			});
		}*/

		res.render('list');
	//});
});
router.get('/everything', function(req,res){
	db.apps.find({},{image: 0},function(err, docs){
		res.json(docs);
	});
});
router.get('/remove/:id', function(req,res){
	db.apps.remove({_id: new mongojs.ObjectId(req.params.id)}, function(err, docs){
		res.redirect('/admin/list');
	});
});
router.get('/upsert/:id?', function(req,res){
	if (req.params.id) {
		db.apps.findOne({_id: new mongojs.ObjectId(req.params.id)}, function(err, docs){
			res.render('upsert', {doc: docs});
		});
	} else {
		res.render('upsert');
	}
});

router.post('/upsert/:id?', function(req, res){	
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

			input.command = [];
			if (fields.command) {
				fields['command'].forEach(function(item, index){
					input.command[index] = {'distros':fields.distros[index].split(',').sort(),'command':item.replace(/\r\n/g,"\n")};
				});
			}
			input.ppa = [];
			if (fields.ppa){
				fields['ppa'].forEach(function(item, index){
					input.ppa[index] = {'distros':fields.pdistros[index].split(',').sort(), 'ppa':item.replace(/\r\n/g,"\n")};
				});
			}
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
				db.apps.insert(
					input,
					function(err, docs){
						res.redirect('/admin/list');
				});
			}
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
