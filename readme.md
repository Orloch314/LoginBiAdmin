# loginbi - semplice portale Power BI con gestione utenti

Struttura:
- backend/
  - server.js
  - users.json
  - reports.json
- frontend/
  - login.html
  - login.js
  - dashboard.html
  - dashboard.js
  - admin.html
  - admin.js
  - change-password.html
  - change-password.js
  - style.css

## Installazione backend
1. Vai in `backend/`
2. `npm install`
3. `npm start` (o `npm run dev` con nodemon)

Il server ascolta su `http://localhost:3000` (porta configurabile via `PORT` env var).

## Note di sicurezza / deployment
- Questo progetto **non** implementa JWT o sessione server-side in; tuttavia usa **bcrypt** per non trasmettere password in chiaro verso il backend.
- Per produzione:
  - Servi tutto via HTTPS.
  - Se possibile aggiungi autenticazione più robusta per le API admin (es. token temporanei, VPN, restrizione IP).
  - Rendi `adminUsername` verification più forte (es. richiedere anche password admin in body e verificare con bcrypt prima di consentire azioni admin).
- Il server fa una migrazione automatica: se trovi password in chiaro in `users.json` le converte in hash al primo avvio.

## Come usare
1. Avvia il backend.
2. Apri `frontend/login.html`.
3. Esegui login come `admin` (in `users.json`): password `admin123` (verrà hashata al primo avvio).
4. Dal pannello admin crea gli utenti e assegna report.

