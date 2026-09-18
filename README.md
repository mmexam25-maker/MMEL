# MM-EL — Railway 24×7 version

This is the Railway/Node.js conversion of the original Google Apps Script MM-EL app.

## What changed
- `HtmlService` -> Express static web server.
- `google.script.run` -> compatibility bridge that calls `/api/call`.
- `SpreadsheetApp` -> Google Sheets API using a service account.
- `GmailApp` -> Gmail SMTP using a Google App Password.
- Apps Script PDF conversion -> PDFKit payroll PDF generation.
- `/health` endpoint + Railway `restartPolicyType: ALWAYS`.
- Existing browser-side WhatsApp (`wa.me`) flow is preserved.

## Railway variables
Create these in **Service -> Variables**:

```text
SPREADSHEET_ID=13f2H-_vGf6K2flQnSrgaxeHZ3ejR0Bu9vtx5DFfBujU
GOOGLE_SERVICE_ACCOUNT_JSON={...full service-account JSON on one line...}
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=mmexam25@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
MAIL_FROM=mmexam25@gmail.com
MAIL_FROM_NAME=Mariners Mentor
TZ=Asia/Kolkata
```

Optional site password:
```text
BASIC_AUTH_USER=admin
BASIC_AUTH_PASS=choose-a-strong-password
```

## Google Sheet access
1. In Google Cloud create a project and enable **Google Sheets API**.
2. Create a **Service Account** and JSON key.
3. Put the complete JSON in Railway variable `GOOGLE_SERVICE_ACCOUNT_JSON`.
4. Open the MM EL Google Sheet and **Share** it with the service-account `client_email` as **Editor**.

## Gmail sending
For a normal Gmail account, create a Google **App Password** and put the 16-character value in `SMTP_PASS`. Do not put your normal Gmail password in Railway.

## Deploy to Railway
1. Put this folder in GitHub.
2. Railway -> New Project -> Deploy from GitHub Repo.
3. Add the variables above.
4. In **Networking**, generate a public domain.
5. Railway reads `railway.json`, starts `npm start`, checks `/health`, and uses restart policy `ALWAYS`.

The app listens on Railway's injected `PORT`; do not hard-code a Railway port.

## 24×7 note
Use a persistent Railway service and keep serverless/sleep behavior disabled. `ALWAYS` restart is available on paid plans. The `/health` endpoint is a deployment readiness check; it is not continuous uptime monitoring.

## Test
After deployment open:
- `https://YOUR-DOMAIN/health` -> must return `{ "ok": true, ... }`
- then open the main domain and test search/save before using production data.

## Important
The original Apps Script frontend had an accidental server-side `generatePayrollPDF()` block inside browser JavaScript. It was removed in this conversion because it referenced Apps Script-only `HtmlService`, `Utilities`, and `DriveApp` and would fail in a browser.
