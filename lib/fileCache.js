/**
 * Created by vsuhanov on 21.04.14.
 */

var cache_manager = require('cache-manager');
var fs = require('node-fs');
var gbuf = require('gzip-buffer');

module.exports = {
    init: function() {
        this.cache = cache_manager.caching({
            store: file_cache
        });
    },

    beforePhantomRequest: function(req, res, next) {
        if(req.method !== 'GET') {
            return next();
        }

        this.cache.get(req.prerender.url, function (err, result) {
            if (!err && result) {
                var now = new Date();
                console.log(now.toDateString() +' ' + now.toTimeString() + ' cache hit');
                res.send(200, result);
            } else {
                next();
            }
        });
    },

    afterPhantomRequest: function(req, res, next) {
        if (req.prerender.statusCode == 200) {
            this.cache.set(req.prerender.url, req.prerender.documentHTML);
        }
        next();
    }
};


var file_cache = {
    get: function(key, callback) {
        var path = process.env.CACHE_ROOT_DIR;
        var cache_live_time = process.env.CACHE_LIVE_TIME;

        var filename = '___';
        var dirname = 'other';

        //   extract "path" from http://site/path
        var uri = key.match(/\/\/[^\/]+\/(.+)/);
        if (uri && uri.length > 1) {
            var parts = uri[1].split('/');
            if (parts.length > 1) {
                dirname = parts[0];
                filename = parts.slice(1).join('_');
            } else {
                filename = parts[0].replace(/\//g, '_');
            }
        }
        path = path + '/' + dirname + '/' + filename;

        fs.exists(path, function(exists){
            if (exists === false) {
                return callback(null)
            }

            var date = new Date();

            if (date.getTime() - fs.statSync(path).mtime.getTime() > cache_live_time * 1000) {
                return callback(null)
            }

            fs.readFile(path, function(zipped) {
                gbuf.gunzip(zipped, callback);
            });
        });
    },
    set: function(key, value, callback) {

        var path = process.env.CACHE_ROOT_DIR;
        var dirname = 'other';
        var filename = '___';

        //   extract "path" from http://site/path
        var uri = key.match(/\/\/[^\/]+\/(.+)/);
        if (uri && uri.length > 1) {
            var parts = uri[1].split('/');
            if (parts.length > 1) {
                dirname = parts[0];
                filename = parts.slice(1).join('_');
            } else {
                filename = parts[0].replace(/\//g, '_');
            }
        }
        var pathDir = path + '/' + dirname;
        path = pathDir + '/' + filename;


        fs.exists(path, function(exists){
            if (exists === false) {
                fs.mkdirSync(pathDir, '0777',true);
            }

            gbuf.gzip(value, function(gzipped){
                fs.writeFile(path, gzipped, callback);
            });
        });

    }
};
