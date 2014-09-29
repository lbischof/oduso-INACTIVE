var express = require('express');
var session = require('express-session')

var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var bodyParser = require('body-parser');
var debug = require('debug')('my-application');
var session = require('express-session');
var routes = require('./routes/index');
var admin = require('./routes/admin');
var flash = require('connect-flash');
var cookieParser = require('cookie-parser')

var app = express();
var passport = require('passport');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hjs');
app.set('ip_addr', process.env.OPENSHIFT_NODEJS_IP   || '127.0.0.1');
app.set('port', process.env.OPENSHIFT_NODEJS_PORT || 3000);

app.use(cookieParser())
app.use(flash());
app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({secret: 'keyboard cat'}));
app.use(passport.initialize());
app.use(passport.session());

app.use(function(req, res, next) {
  if(!req.secure && app.get('ip_addr') != '127.0.0.1') {
    return res.redirect(['https://', req.get('Host'), req.url].join(''));
  }
  next();
});

app.use('/', routes);
app.use('/admin', admin);



/// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;


var server = app.listen(app.get('port'), app.get('ip_addr'), function() {
  debug('Express server listening on port ' + server.address().port);
});
