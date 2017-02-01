## node-sftp-deploy improved

> Upload and deploy files from SFTP with username & password.

This is a copy of node-sftp-deploy package with some fixes and improvements.
In addition to features provided by node-sftp-deploy it allows to:

* specify a regexp pattern to filter files to be uploaded
* upload files in particular order (by specifying a sorting function for files)
* use caching (uploaded files md5 hashes are stored **locally** and file upload is skipped if trying to upload same file).

## Install


```bash
npm install --save node-sftp-deploy-i
```

## Usage

```javascript
var sftp = require('node-sftp-deploy-i');

// to upload html files after all others
var sortingFunction = function (a, b) {
    return path.extname(a.path).toLowerCase() === ".html" ? 1 : -1;
};

sftp({
    "host": "10.10.10.10",
    "port": "20",
    "user": "user",
    "pass": "pass",
    "remotePath": "",
    "sourcePath": "./",
    "includePattern":  /.*\.(js|css|html)$/,  // optional, upload only js css and html files
    "sort": sortingFunction,                          // optional
    "cacheFile": "cache.json" //optional
});

//Support Promise
sftp(sftpConfig).then(function(){
    //Success Callback
});
```
