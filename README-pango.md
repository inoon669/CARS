# Pango Automation (Add 3 Vehicles)

## 1) Setup
1. Install dependencies:
   ```powershell
   npm install
   npx playwright install chromium
   ```
2. Create `.env` from `.env.example` and fill:
   - `PANGO_USERNAME`
   - `PANGO_PASSWORD`
   - `SUBSCRIPTION_ID` (default already set to `5555555`)
3. Create `vehicles.json` from `vehicles.example.json` and set exactly 3 vehicles.

## 2) Run
```powershell
npm run add-vehicles
```

## 3) Notes
- The script runs with visible browser (`headless: false`).
- If login has CAPTCHA or OTP, complete it manually and press Enter in terminal.
- If website selectors changed, script pauses and asks for manual action to continue safely.
