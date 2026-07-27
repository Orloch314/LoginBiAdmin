# LoginBI v2

Versión mejorada del portal interno para visualizar reportes de Power BI.

## Funcionalidades

- inicio de sesión con sesiones verificadas por el backend;
- invitación de usuarios mediante tokens de un solo uso;
- primer acceso con contraseña definida por el usuario;
- panel con los reportes asignados;
- área administrativa para gestionar usuarios, reportes, asignaciones e indicadores de acceso;
- registro de auditoría y accesos;
- envío automático de invitaciones por SMTP;
- envío manual individual de tokens pendientes;
- configuración desde el panel administrativo del servidor SMTP, asunto y texto del correo.

## Ejecución local

Requisitos:

- Node.js 18 o superior;
- npm.

Instalar las dependencias e iniciar el portal:

```bash
npm install
npm start
```

Abrir `http://localhost:3000/login.html`.

## Producción

El portal utiliza escrituras atómicas y un bloqueo compartido para evitar pérdidas de usuarios o sesiones cuando Passenger inicia varios procesos.

Variables de entorno disponibles:

- El servidor utiliza siempre el puerto `3000`.
- `DATA_DIR`: directorio persistente de los archivos JSON; si se omite, se utiliza `backend/data`.
- `SMTP_TIMEOUT_MS`: tiempo máximo de inactividad SMTP en milisegundos; el valor predeterminado es `15000`.
- `STORAGE_LOCK_TIMEOUT_MS`: tiempo máximo de espera del bloqueo en milisegundos; el valor predeterminado es `10000`.
- `STORAGE_STALE_LOCK_MS`: tiempo tras el cual se elimina un bloqueo abandonado, en milisegundos; el valor predeterminado es `30000`.

En el hosting se recomienda configurar `DATA_DIR` fuera de la carpeta actualizada mediante Git y comprobar que el usuario del proceso Node.js tenga permisos de lectura y escritura. Cada modificación también crea una copia `.bak` del archivo JSON válido anterior.

## Migración desde la versión anterior

Si están disponibles los archivos anteriores `users.json` y `reports.json`, se pueden convertir al nuevo formato con:

```bash
npm run migrate:legacy
```

Para indicar archivos de origen diferentes:

```bash
LEGACY_USERS_FILE="C:/ruta/users.json" LEGACY_REPORTS_FILE="C:/ruta/reports.json" npm run migrate:legacy
```

La migración:

- importa usuarios y reportes;
- excluye la cuenta administrativa anterior;
- convierte las contraseñas en hashes;
- crea tokens de un solo uso para el primer acceso;
- conserva las asignaciones existentes entre usuarios y reportes.

La guía completa de instalación, migración, validación y reversión está disponible en `INSTALACION_Y_MIGRACION.md`.

## Configuración SMTP

El envío de invitaciones utiliza SMTP sobre TLS. Los parámetros se configuran desde el panel administrativo, en la sección `Email e invitaciones`.

Campos principales:

- `Host SMTP`;
- `Puerto SMTP`;
- `Usuario SMTP`;
- `Contraseña SMTP`;
- `Nombre del remitente`;
- `Email del remitente`;
- `URL del portal`;
- `Página de invitación`;
- `Asunto del email`;
- `Texto base del email`.

La contraseña SMTP, el asunto y el texto del correo se guardan en `smtp-settings.json` dentro de `DATA_DIR`, o en `backend/data/smtp-settings.json` cuando la variable no está configurada. El archivo predeterminado está excluido de Git. Después de guardar, el panel solamente indica si existe una contraseña configurada.

Al enviar una invitación, el sistema agrega automáticamente al texto configurado:

- el nombre de usuario;
- el token;
- el enlace de invitación.

## Tokens de usuarios migrados

Para los usuarios migrados sin dirección de correo:

1. seleccionar el usuario en el panel de asignaciones;
2. agregar y guardar su dirección de correo;
3. abrir la sección `Invitaciones pendientes`;
4. pulsar `Enviar token por email` junto al token del usuario.

La operación envía el token existente sin regenerarlo. No existe un envío masivo: cada correo se envía manualmente para reducir el riesgo de bloqueos por spam.
