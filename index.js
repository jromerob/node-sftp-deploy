/* global process*/
/**
 *  This is a copy of https://github.com/weixin/node-sftp-deploy, with some fixes and improvements
 */

'use strict';
var path = require('path');
var Connection = require('ssh2');
var async = require('async');
var parents = require('parents');
var assign = require('object-assign');
var fs = require('fs-extra');
var chalk = require('chalk');
var Q = require('q');

var normalizePath = function (path) {
    return path.replace(/\\/g, '/');
};

module.exports = function (options, callback) {

    return Q.Promise(function (resolve, reject) {
        options = assign({
            "host": "",
            "port": "36000",
            "user": "",
            "pass": "",
            "remotePath": "",
            "sourcePath": "./",
            "remotePlatform": "unix",
            "includePattern": null,
            "sort": null
        }, options);

        if (options.host === undefined || options.host === '') {
            throw new Error('sftp2', '`host` required.');
        }

        var fileCount = 0;
        var fileLength = 0;

        options.password = options.password || options.pass;
        options.username = options.username || options.user || 'anonymous';

        var remotePath = options.remotePath;
        var sourcePath = options.sourcePath;
        var remotePlatform = options.remotePlatform;

        var mkDirCache = {};

        var finished = false;
        var connectionCache = null;

        var items = [];
        fs.walk(sourcePath)
            .on('data', function (item) {
                if (!item.stats.isDirectory()) {
                    if (!options.includePattern || item.path.match(options.includePattern)) {
                        items.push(item);
                    }
                }
            })
            .on('end', function () {
                fileLength = items.length;

                if (fileLength <= 0) {
                    console.log('sftp2:', chalk.yellow('No files uploaded'));
                } else {
                    if (options.sort) {
                        items = items.sort(options.sort);
                    }
                    return uploadFiles(items);
                }
            });

        function uploadFiles (files) {

            connectSftp(function (sftp) {
                async.eachSeries(files, function (file, done) {
                    var filepath = file.path.replace(/\\/g, '/');

                    var pathArr = sourcePath.replace(/\/$/, '').split('/');

                    var projectName = pathArr[pathArr.length - 1];

                    var relativePath = filepath.split(projectName + path.sep)[1];
                    var finalRemotePath = normalizePath(path.join(remotePath, relativePath));

                    var dirname = path.dirname(finalRemotePath);

                    var fileDirs = parents(dirname)
                        .map(function (d) {
                            return d.replace(/^\/~/, "~");
                        })
                        .map(normalizePath);

                    if (dirname.search(/^\//) === 0) {
                        fileDirs = fileDirs.map(function (dir) {
                            if (dir.search(/^\//) === 0) {
                                return dir;
                            }
                            return '/' + dir;
                        });
                    }

                    fileDirs = fileDirs.filter(function (d) {
                        return d.length >= remotePath.length && !mkDirCache[d];
                    });

                    async.whilst(function () {
                        return fileDirs && fileDirs.length;
                    }, function (next) {
                        var d = fileDirs.pop();
                        mkDirCache[d] = true;

                        if (remotePlatform && remotePlatform.toLowerCase().indexOf('win') !== -1) {
                            d = d.replace('/', '\\');
                        }

                        process.stdout.write("\nmkdir " + chalk.gray(d));
                        sftp.mkdir(d, {mode: '0755'}, function () {
                            process.stdout.write(" " + chalk.green('\u2714'));
                            next();
                        });
                    }, function () {

                        var readStream = fs.createReadStream(filepath);

                        var stream = sftp.createWriteStream(finalRemotePath, {
                            flags: 'w',
                            encoding: null,
                            mode: '0666',
                            autoClose: true
                        });
                        process.stdout.write("\n" + chalk.cyan("\u27A4 ") + chalk.gray(filepath) + chalk.white(" -> ") + chalk.gray(finalRemotePath));
                        readStream.pipe(stream);

                        stream.on('close', function (err) {

                            if (err) {
                                throw new Error('sftp2', err);
                            } else {
                                process.stdout.write(" " + chalk.green('\u2714'));
                                fileCount++;
                            }
                            done();
                        });

                    });

                }, function () {
                    console.log('\nsftp2:', chalk.green(fileCount, fileCount === 1 ? 'file' : 'files', 'uploaded successfully'));
                    finished = true;
                    if (sftp) {
                        sftp.end();
                    }
                    if (connectionCache) {
                        connectionCache.end();
                    }
                    if (callback) {
                        callback();
                    }
                    resolve();
                });
            });
        }

        function connectSftp (callback) {
            console.log('Authenticating with password.');

            var c = new Connection();
            connectionCache = c;
            c.on('ready', function () {
                c.sftp(function (err, sftp) {
                    if (err) {
                        throw err;
                    }
                    sftp.on('end', function () {
                        console.log('SFTP session closed');
                        sftp = null;
                        if (!finished) {
                            console.log('error', new Error('sftp2', "SFTP abrupt closure"));
                        }
                    });
                    console.log(chalk.green("Connected"));
                    callback(sftp);
                });

            });
            c.on('error', function (err) {
                console.log('sftp2', err);
                reject(err);
            });
            c.on('end', function () {
                // console.log('Connection :: end');
            });
            c.on('close', function (hadError) {
                if (!finished) {
                    console.log('sftp2', "SFTP abrupt closure");
                }
                console.log('Connection :: close', hadError ? "with error" : "");

            });

            /*
             * connection options, may be a key
             */
            var connectionOptions = {
                host: options.host,
                port: options.port || 22,
                username: options.username
            };

            if (options.password) {
                connectionOptions.password = options.password;
            }

            if (options.timeout) {
                connectionOptions.readyTimeout = options.timeout;
            }
            c.connect(connectionOptions);
        }

    });

};
