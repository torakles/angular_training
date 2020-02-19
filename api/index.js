const path = require('path');
const url = require('url');
const request = require('request');
const querystring = require('querystring');
const Transform = require('stream').Transform;
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const cachedRequest = require('cached-request');
const cors = require('cors');

const cacheDirectory = 'cache';
console.log(`Cached data in ${path.resolve(cacheDirectory)}`);

const API_URL = 'http://api.themoviedb.org/3';
const IMAGE_URL = 'https://image.tmdb.org/t/p/w154';

let apiKey = process.argv[2];

let jsonServer = require('json-server');
let server = jsonServer.create();
server.use(cors());

let router = jsonServer.router({
    comments: []
});

util.inherits(Response, Transform);

function Response (options) {
    Transform.call(this, options);
}

Response.prototype._transform = function (chunk, encoding, callback) {
    this.push(chunk);
    callback();
};

util.inherits(NoRequest, EventEmitter);

function NoRequest () {
    EventEmitter.call(this);
    let self = this;
    return {
        on: function (event, handler) {
            self.on(event, function () {
                handler.apply(null, arguments);
            });
        },
        end: function () {
            let response = new Response();
            // FIXME: returns 200 instead of 404!
            response.statusCode = 404;
            response.write('Not in cache!');
            response.end();
            self.emit('response', response);
        }
    }
}

const start = () => {
    // Default cache duration of 24h
    let cacheDuration = 24 * 60 * 60 * 1000;
    if (apiKey) {
        console.log('API Key provided. Not cached (or expired) data will be downloaded from themoviedb.');
    } else {
        console.warn('No API Key provided. Only cached result can be used!');
        // Extend cache duration to 5 years
        cacheDuration = 5 * 365 * 24 * 60 * 60 * 1000;
    }

    const authentifiedRequest = function () {
        if (apiKey) {
            arguments[0].qs = {api_key: apiKey};
            return request.apply(this, arguments);
        } else {
            console.log('Content not in cache and no API key provided!');
            return new NoRequest();
        }
    };

    const authentifiedCachedRequest = cachedRequest(authentifiedRequest);

    authentifiedCachedRequest.setCacheDirectory(cacheDirectory);
    authentifiedCachedRequest.setValue('ttl', cacheDuration);

    const port = 1337;
    server.use(function (req, res, next) {
        let requestUrl = req.url;
        let imdbUrl;
        let urlObject = url.parse(requestUrl);
        if (/\/comments/.exec(requestUrl)) {
            next();
        } else if (/\/favicon\.ico/.exec(requestUrl)) {
            console.log('Favicon');
            res.end();
            return;
        } else if (/.*\.jpg/.exec(requestUrl)) {
            imdbUrl = IMAGE_URL + urlObject.pathname;
            console.log(imdbUrl);
        } else {
            let qs = querystring.parse(urlObject.query);
            qs.language = 'fr-FR';
            imdbUrl = API_URL + urlObject.pathname + '?' + querystring.stringify(qs);
            console.log(imdbUrl);
        }
        if (imdbUrl) {
            req.pipe(authentifiedCachedRequest({url: imdbUrl})).pipe(res);
        }

    });
    server.use(router);
    server.listen(port, () => console.log(`Listening on http://localhost:${port}`));
};

start();