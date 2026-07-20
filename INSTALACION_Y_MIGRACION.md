# Instalacion y migracion del Portal BI

Esta guia describe como instalar la nueva version del Portal BI desde GitHub y como migrar los usuarios y reportes existentes desde la version anterior, usando el mismo servidor y el mismo URL publico.

Repositorio GitHub:

```text
https://github.com/Orloch314/LoginBiAdmin
```

## 1. Requisitos

- Acceso al servidor donde esta instalada la version anterior.
- Node.js instalado en el servidor.
- Acceso a Git o posibilidad de subir los archivos descargados desde GitHub.
- Acceso para iniciar, detener o reiniciar la aplicacion Node.js en el hosting.
- Los archivos actuales de la version anterior:
  - `backend/users.json`
  - `backend/reports.json`

## 2. Preparar una copia de seguridad

Antes de reemplazar la version anterior, crear una copia completa de la carpeta actual del portal.

Ejemplo:

```bash
cp -r loginbi loginbi_backup_antes_v2
```

Si el servidor es Windows:

```powershell
Copy-Item -Path .\loginbi -Destination .\loginbi_backup_antes_v2 -Recurse
```

Verificar especialmente que existan estos archivos dentro del backup:

```text
loginbi_backup_antes_v2/backend/users.json
loginbi_backup_antes_v2/backend/reports.json
```

## 3. Descargar la nueva version desde GitHub

Entrar en la carpeta donde se quiere instalar la nueva version y clonar el repositorio.

```bash
git clone https://github.com/Orloch314/LoginBiAdmin.git loginbi-v2
cd loginbi-v2
```

Instalar dependencias:

```bash
npm install
```

## 4. Migrar usuarios y reportes existentes

La migracion toma los datos de la version anterior y los convierte al nuevo formato.

Ejecutar la migracion indicando la ubicacion exacta de los archivos antiguos:

```bash
LEGACY_USERS_FILE="/ruta/loginbi_backup_antes_v2/backend/users.json" LEGACY_REPORTS_FILE="/ruta/loginbi_backup_antes_v2/backend/reports.json" npm run migrate:legacy
```

En Windows PowerShell:

```powershell
$env:LEGACY_USERS_FILE="C:\ruta\loginbi_backup_antes_v2\backend\users.json"
$env:LEGACY_REPORTS_FILE="C:\ruta\loginbi_backup_antes_v2\backend\reports.json"
npm run migrate:legacy
```

Por defecto la migracion excluye el usuario antiguo `admin`, porque la nueva version crea automaticamente el administrador principal.

Si el administrador antiguo tiene otro nombre, indicar el usuario a excluir:

```powershell
$env:LEGACY_ADMIN_USERNAME="nombre_admin_antiguo"
npm run migrate:legacy
```

La migracion genera estos archivos nuevos:

```text
backend/data/users.json
backend/data/reports.json
backend/data/invites.json
backend/data/sessions.json
backend/data/access-log.json
backend/data/audit-log.json
```

## 5. Verificar el administrador

La nueva version crea o restaura el usuario administrador al iniciar el servidor.

Credenciales iniciales:

```text
Usuario: admin
Password: admin123!
```

Recomendacion: despues del primer acceso, cambiar la password desde el panel administrador.

El administrador no visualiza reportes asignados y no puede eliminar su propio usuario. Solo puede cambiar su password.

## 6. Configurar SMTP y texto de invitacion

Entrar al portal como administrador y abrir la seccion `Configuracion SMTP`.

Completar:

- Host SMTP
- Porta SMTP
- Usuario SMTP
- Password SMTP
- Nombre remitente
- Email remitente
- URL portal
- Pagina invitacion
- Objeto email
- Texto email base

El sistema guarda esta configuracion en:

```text
backend/data/smtp-settings.json
```

Este archivo no se sube a GitHub. Queda solo en el servidor.

Cuando se envia una invitacion, el portal agrega automaticamente:

- Usuario
- Token
- Link de invitacion

Por eso el texto base no necesita incluir manualmente esos datos.

## 7. Instalar bajo el mismo URL de produccion

Como el nuevo portal va a usar el mismo URL de la version anterior, el procedimiento recomendado es:

1. Detener la aplicacion anterior.
2. Mantener el backup completo de la version anterior.
3. Instalar la nueva version en la carpeta que usa el hosting para publicar el portal.
4. Ejecutar `npm install`.
5. Ejecutar la migracion desde los archivos del backup.
6. Iniciar la nueva aplicacion.
7. Probar login admin.
8. Configurar SMTP y texto de email.
9. Crear o reenviar un token de prueba.
10. Confirmar que un usuario normal ve solo sus reportes asignados.

## 8. Iniciar la aplicacion

Para iniciar localmente o en un servidor Node.js simple:

```bash
npm start
```

El servidor escucha en:

```text
http://localhost:3000
```

En produccion, el hosting debe redirigir el dominio publico al proceso Node.js del portal.

URL esperado:

```text
https://reportes.cidesa.com.py/login.html
```

## 9. Checklist final

- El portal abre con el mismo URL anterior.
- El usuario `admin` existe.
- El usuario `admin` puede entrar con su password.
- El usuario `admin` no ve reportes.
- El usuario `admin` no puede eliminarse a si mismo.
- Los usuarios migrados aparecen en el panel.
- Los reportes migrados aparecen en el catalogo.
- Las asignaciones usuario/reporte son correctas.
- La configuracion SMTP esta completa.
- El objeto y texto de la mail estan configurados.
- El envio de token por mail funciona.
- Un usuario normal entra y ve solamente sus reportes.

## 10. Rollback

Si aparece un problema durante la instalacion:

1. Detener la nueva aplicacion.
2. Restaurar la carpeta anterior desde `loginbi_backup_antes_v2`.
3. Reiniciar la aplicacion anterior.
4. Revisar el error antes de intentar nuevamente la migracion.

