## node-sftp-deploy improved

> Upload and deploy files from SFTP with username & password.

This is a copy of node-sftp-deploy package with some fixes and improvements.
In addition to features provided by node-sftp-deploy it allows to specify a regexp pattern to filter files to be uploaded and a sorting function to upload files in particular order.

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
    "sort": sortingFunction                           // optional
});

//Support Promise
sftp(sftpConfig).then(function(){
    //Success Callback
});
```
