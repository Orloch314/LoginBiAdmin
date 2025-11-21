# LoginBiAdmin - A web application for controlled access to Power BI reports, featuring user authentication, user management, and report assignment.


🛠️ Project Structure
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

  
🚀 Backend Installation

Go to backend/

npm install

npm start (or npm run dev with nodemon)

The server listens on http://localhost:3000 (port configurable via the PORT environment variable).

🔒 Security / Deployment Notes
This project does not implement JWT or server-side session management; however, it uses bcrypt to prevent transmitting plaintext passwords to the backend.

For production:

Serve everything over HTTPS.

If possible, add more robust authentication for the admin APIs (e.g., temporary tokens, VPN, IP restriction).

Strengthen the adminUsername verification (e.g., require the admin password in the body and verify it with bcrypt before allowing admin actions).

The server performs an automatic migration: if it finds plaintext passwords in users.json, it converts them to hashes on the first startup.

⚙️ How to Use
Start the backend.

Open frontend/login.html.

Log in as admin (found in users.json): password admin123 (this will be hashed on first startup).

From the admin panel, create users and assign reports.
