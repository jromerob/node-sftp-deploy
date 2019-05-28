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
var md5File = require('md5-file');

var normalizePath = function (path) {
    return path.replace(/\\/g, '/');
};

var events = require('events');


/**
 * Clase apra realizar despliegues por SFTP con usuario y contraseña
 * 
 */
function SftpDeployer() {

    var eventEmitter = new events.EventEmitter();
    var silent = false;

    var deployLog = function (data) {
        if (!silent) process.stdout.write(data);

    }

    this.on = function (eventName, callback) {
        eventEmitter.on(eventName, callback);
    }


    this.upload = function (options, callback) {

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
                "cacheFile": null,
                "silent": false
            }, options);

            if (options.host === undefined || options.host === '') {
                throw new Error('sftp2', '`host` requerido.');
            }

            var fileCount = 0;
            var fileLength = 0;

            options.password = options.password || options.pass;
            options.username = options.username || options.user || 'anonymous';

            var remotePath = options.remotePath;
            var sourcePath = options.sourcePath;
            var remotePlatform = options.remotePlatform;
            silent = options.silent;

            var mkDirCache = {};

            var finished = false;
            var connectionCache = null;
            var cache = {},
                cacheFilePath = null;
            if (options.cacheFile) {
                cacheFilePath = path.resolve(options.cacheFile);
                try {
                    cache = require(cacheFilePath);
                } catch (e) {
                    deployLog("Archivo caché:", cacheFilePath, "inválido o no existe, se creará uno nuevo");
                }
            }

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
                        deployLog('sftp2:', chalk.yellow('no se han subido archivos'));
                    } else {
                        if (options.sort) {
                            items = items.sort(options.sort);
                        }
                        return uploadFiles(items);
                    }
                });

            function uploadFiles(files) {

                connectSftp(function (sftp) {
                    async.eachSeries(files, function (file, done) {
                        var filepath = file.path.replace(/\\/, '/');

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

                            deployLog("\nCreando directorio " + chalk.gray(d));
                            sftp.mkdir(d, {
                                mode: '0755'
                            }, function () {
                                deployLog(" " + chalk.green('\u2714'));
                                next();
                            });
                        }, function () {
                            var fileHash = options.cacheFile && md5File.sync(filepath);
                            if (fileHash && cache[finalRemotePath] === fileHash) {
                                deployLog("\n" + chalk.cyan("\u27A4 ") + chalk.gray(filepath) + chalk.white(" el archivo se cargó la última vez y no ha cambiado desde entonces, se omite la carga."));
                                done();
                                return;
                            }
                            var readStream = fs.createReadStream(filepath);

                            var stream = sftp.createWriteStream(finalRemotePath, {
                                flags: 'w',
                                encoding: null,
                                mode: '0666',
                                autoClose: true
                            });
                            var txt = "\n" + chalk.cyan("\u27A4 ") + chalk.gray(filepath) + chalk.white(" -> ") + chalk.gray(finalRemotePath);
                            deployLog(txt);
                            eventEmitter.emit('file_upload', {
                                file: filepath,
                                remote: finalRemotePath
                            });
                            readStream.pipe(stream);

                            stream.on('close', function (err) {

                                if (err) {
                                    eventEmitter.emit('error', err);
                                    throw new Error('sftp2', err);
                                } else {
                                    deployLog(" " + chalk.green('\u2714'));
                                    fileCount++;
                                    cache[finalRemotePath] = fileHash;
                                }
                                done();
                            });

                        });

                    }, function () {
                        deployLog('\nsftp2:', chalk.green(fileCount, fileCount === 1 ? 'archivo' : 'archivos', 'subidos correctamente'));
                        eventEmitter.emit('finish', fileCount);
                        finished = true;
                        if (cacheFilePath) {
                            fs.writeFileSync(cacheFilePath, JSON.stringify(cache));
                            deployLog("\narchivo caché " + cacheFilePath + "actualizado");
                        }
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

            function connectSftp(callback) {
                deployLog('Autenticando con contraseña.');

                var c = new Connection();
                connectionCache = c;
                c.on('ready', function () {
                    c.sftp(function (err, sftp) {
                        if (err) {
                            eventEmitter.emit('error', err);
                            throw err;
                        }
                        sftp.on('end', function () {
                            deployLog('Sesión SFTP cerrada');
                            sftp = null;
                            if (!finished) {
                                deployLog('error', new Error('sftp2', "Cierre de sesión SFTP inesperado"));
                            }
                        });
                        deployLog(chalk.green("Conectado"));
                        eventEmitter.emit('connected');
                        callback(sftp);
                    });

                });
                c.on('error', function (err) {
                    deployLog('sftp2', err);
                    eventEmitter.emit('con_error', err);
                    reject(err);
                });
                c.on('end', function () {
                    eventEmitter.emit('con_end');
                });
                c.on('close', function (hadError) {
                    if (!finished) {
                        deployLog('sftp2', "SFTP Cierre inesperado");
                    }
                    deployLog('Conexión :: cerrada', hadError ? "con error" : "");
                    eventEmitter.emit('con_close');

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
}

module.exports = SftpDeployer;