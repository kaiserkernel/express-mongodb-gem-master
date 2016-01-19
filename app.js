#!/usr/bin/env node

'use strict';

const clc             = require('cli-color');
const commander       = require('commander');
const express         = require('express');
const fs              = require('fs');
const https           = require('https');
const middleware      = require('./lib/middleware');
const utils           = require('./lib/utils');
const updateNotifier  = require('update-notifier');
const pkg             = require('./package.json');

let app               = express();
let notifier          = updateNotifier({pkg});

let config;
let defaultPort = 80;
let server      = app;
let sslOptions;

console.log('Welcome to mongo-express');
console.log('------------------------');
console.log('\n');

// Notify of any updates
notifier.notify();

try {
  config = utils.deepmerge(require('./config.default'), require('./config'));
} catch (e) {
  if (e.code === 'MODULE_NOT_FOUND') {
    console.log('No custom config.js found, loading config.default.js');
  } else {
    console.error(clc.red('Unable to load config.js!'));
    console.error(clc.red('Error is:'));
    console.log(clc.red(e));
    process.exit(1);
  }

  config = require('./config.default');
}

commander
  .version(require('./package').version)
  .option('-u, --username <username>', 'username for authentication')
  .option('-p, --password <password>', 'password for authentication')
  .option('-a, --admin', 'enable authentication as admin')
  .option('-d, --database <database>', 'authenticate to database')
  .option('--port <port>', 'listen on specified port')
.parse(process.argv);

if (commander.username && commander.password) {
  config.mongodb.admin = !!commander.admin;
  if (commander.admin) {
    config.mongodb.adminUsername = commander.username;
    config.mongodb.adminPassword = commander.password;
  } else {
    let user = {
      database: commander.database,
      username: commander.username,
      password: commander.password,
    };
    for (let key in user) {
      if (!user[key]) {
        commander.help();
      }
    }

    config.mongodb.auth[0] = user;
  }

  config.useBasicAuth = false;
}

config.site.port = commander.port || config.site.port;

if (!config.site.baseUrl) {
  console.error('Please specify a baseUrl in your config. Using "/" for now.');
  config.site.baseUrl = '/';
}

if (config.basicAuth.username === 'admin' && config.basicAuth.password === 'pass') {
  console.error(clc.red('basicAuth credentials are "admin:pass", it is recommended you change this in your config.js!'));
}

if (!config.site.host || config.site.host === '0.0.0.0') {
  console.error(clc.red('Server is open to allow connections from anyone (0.0.0.0)'));
}

app.use(config.site.baseUrl, middleware(config));
app.set('read_only',      config.options.readOnly       || false);
app.set('gridFSEnabled',  config.options.gridFSEnabled  || false);

if (config.site.sslEnabled) {
  defaultPort     = 443;
  sslOptions  = {
    key:  fs.readFileSync(config.site.sslKey),
    cert: fs.readFileSync(config.site.sslCert),
  };
  server = https.createServer(sslOptions, app);
}

server.listen(config.site.port, config.site.host, function() {
  console.log('Mongo Express server listening',
    'on port ' + (config.site.port || defaultPort),
    'at '      + (config.site.host || '0.0.0.0'));
});
