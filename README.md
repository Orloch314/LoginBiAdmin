# LoginBI v2

Versione migliorata del portale interno per la visualizzazione di report Power BI.

## Funzioni

- login con sessione verificata dal backend
- invito utente con token monouso
- primo accesso con password scelta dall'utente
- dashboard con report assegnati
- area admin con utenti, report, assegnazioni e KPI di accesso
- audit e log di accesso
- invio automatico degli inviti via SMTP

## Avvio

```bash
npm install
npm start
```

Apri poi `http://localhost:3000/login.html`.

## Migrazione da versione legacy

Se hai i vecchi file `users.json` e `reports.json`, puoi convertirli nel nuovo formato con:

```bash
npm run migrate:legacy
```

Per usare sorgenti diversi:

```bash
LEGACY_USERS_FILE="C:/path/users.json" LEGACY_REPORTS_FILE="C:/path/reports.json" npm run migrate:legacy
```

La migrazione importa utenti e report, converte le password in hash e crea inviti monouso per il primo accesso.

## Correo SMTP

El envio automatico de invitaciones usa SMTP sobre TLS. Los parametros se configuran desde el panel administrador, en la seccion `Configurazione SMTP`.

Campos principales:

- `Host SMTP`
- `Porta SMTP`
- `Utente SMTP`
- `Password SMTP`
- `Nome mittente`
- `Email mittente`
- `URL portale`
- `Pagina invito`

La password SMTP viene salvata nel file locale `backend/data/smtp-settings.json`, escluso da Git. Dopo il salvataggio il pannello mostra solo se la password e configurata.
