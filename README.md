## node-sftp-deploy mejorado y traducido al castellano

> Sube y despliega archivos a un servicio SFTPcon usuario y contraseña

Este es una copia de node-sftp-deploy-i con algunos cambios

* Se implementa como clase 
* Emite eventos para un mejor control del proceso
* los mensajes por defecto se muestran en castellano

## Instalación

```bash
npm install --save node-sftp-deploy-es
```

## Uso

```javascript
Sftp = require('node-sftp-deploy-es');
var sftp = new Sftp()

var config = {
    host: "xxxx.xxxxxxxxx.yy",
    port: "22",
    user: "user",
    pass: "password",
    remotePath: "/var/www/carpetaremota",
    sourcePath: "./dist/desa",
    silent: true
};

sftp.on('connected', () => {
    console.info('Recibido evento de conexión');

})

sftp.upload(config)
    .then(data => ftpDeployOK(data))
    .catch(err => ftpDeployKO(err));


function ftpDeployOK(data) {
    console.group();
    console.log('--------------------');
    console.log('✅ SUBIDA FINALIZADA'); 
    console.log('--------------------');
    console.groupEnd
};

function ftpDeployKO(err) {
    console.group();
    console.log('❌ ERROR !!!'); 
    console.log('------------');
    console.log(err); 
    console.groupEnd

}
```

## Eventos

| evento  |   |
| ------------ | ------------ |
|  connected |  Se emite al establecerse la conexión    |
|  error |  Se emite al producirse un error    |
|  con_error | Error en la conexiónr    |
|  con_end |  Conexión finalizada    |
|  con_close |  Conexión cerrada    |
|  file_upload | proceso de archivo, recibe el objeto que identifica la subida:  {  file: filepath,                                remote: finalRemotePath } | 
|  finish |  Se emite al finalizar el proceso , recibe el parámetro del numoer de archivos procesados    |

