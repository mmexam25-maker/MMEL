# Mariners Mentor – Merged Railway 24x7

One Railway service, two separate paths:

- `/el/` – MM E-L data entry
- `/outsource/` – MM Outsource staff page
- `/health` – health check

The Certificate tab and Outsource Completed/Completed tabs are hidden from the MM-EL website as requested. The `COMPLETED` Google Sheet is still used privately in the backend as completion history for time-chart/payroll and duplicate prevention.

## Railway variables
Set:
- `SPREADSHEET_ID=13f2H-_vGf6K2flQnSrgaxeHZ3ejR0Bu9vtx5DFfBujU`
- `GOOGLE_SERVICE_ACCOUNT_JSON` = full Google service account JSON
- `TZ=Asia/Kolkata`
- SMTP variables only if you still use any remaining mail/payroll functionality in EL.

Share the Google Sheet with the service account `client_email` as Editor.

Do not set PORT manually; Railway supplies it.
