import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import dotenv from "dotenv";
import { chromium } from "playwright";

dotenv.config();

const USERNAME = process.env.PANGO_USERNAME;
const PASSWORD = process.env.PANGO_PASSWORD;
const SUBSCRIPTION_ID = process.env.SUBSCRIPTION_ID || "5555555";
const VEHICLES_PATH = path.resolve(process.cwd(), "vehicles.json");

if (!USERNAME || !PASSWORD) {
  console.error("Missing credentials. Fill PANGO_USERNAME and PANGO_PASSWORD in .env");
  process.exit(1);
}

if (!fs.existsSync(VEHICLES_PATH)) {
  console.error("Missing vehicles.json. Copy vehicles.example.json -> vehicles.json and fill 3 vehicles.");
  process.exit(1);
}

const vehicles = JSON.parse(fs.readFileSync(VEHICLES_PATH, "utf8"));

if (!Array.isArray(vehicles) || vehicles.length !== 3) {
  console.error("vehicles.json must contain exactly 3 vehicles.");
  process.exit(1);
}

async function clickFirst(page, selectors, timeout = 4000) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      await locator.waitFor({ state: "visible", timeout });
      await locator.click({ timeout: 2000 });
      return true;
    } catch {
      // Continue trying candidate selectors.
    }
  }
  return false;
}

async function fillFirst(page, selectors, value, timeout = 4000) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      await locator.waitFor({ state: "visible", timeout });
      await locator.fill(String(value));
      return true;
    } catch {
      // Continue trying candidate selectors.
    }
  }
  return false;
}

async function waitForEnter(message) {
  const rl = readline.createInterface({ input, output });
  await rl.question(`${message}\nPress Enter to continue...`);
  rl.close();
}

async function login(page) {
  await page.goto("https://www.pango.co.il/", { waitUntil: "domcontentloaded" });

  await clickFirst(page, [
    "a:has-text('התחברות')",
    "button:has-text('התחברות')",
    "a:has-text('כניסה')",
    "button:has-text('כניסה')"
  ]);

  const userFilled = await fillFirst(page, [
    "input[type='email']",
    "input[name*='user' i]",
    "input[name*='mail' i]",
    "input[placeholder*='מייל']",
    "input[placeholder*='טלפון']",
    "input[placeholder*='משתמש']"
  ], USERNAME);

  const passFilled = await fillFirst(page, [
    "input[type='password']",
    "input[name*='pass' i]",
    "input[placeholder*='סיסמה']"
  ], PASSWORD);

  if (!userFilled || !passFilled) {
    console.log("Could not reliably detect login fields.");
    await waitForEnter("Please log in manually in the opened browser");
    return;
  }

  await clickFirst(page, [
    "button:has-text('כניסה')",
    "button:has-text('התחברות')",
    "button[type='submit']"
  ]);

  await waitForEnter("If CAPTCHA / OTP is required, complete it now");
}

async function openSubscription(page) {
  const opened = await clickFirst(page, [
    "a:has-text('מנויים')",
    "a:has-text('המנויים שלי')",
    "button:has-text('מנויים')"
  ]);

  if (!opened) {
    await waitForEnter("Please navigate manually to the subscriptions page");
  }

  const searchFilled = await fillFirst(page, [
    "input[placeholder*='חיפוש']",
    "input[name*='search' i]",
    "input[type='search']"
  ], SUBSCRIPTION_ID);

  if (searchFilled) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);
  }

  const selected = await clickFirst(page, [
    `text=${SUBSCRIPTION_ID}`,
    `a:has-text('${SUBSCRIPTION_ID}')`,
    `button:has-text('${SUBSCRIPTION_ID}')`
  ], 3000);

  if (!selected) {
    await waitForEnter(`Please open subscription ${SUBSCRIPTION_ID} manually`);
  }
}

async function addVehicle(page, vehicle, index) {
  const addOpened = await clickFirst(page, [
    "button:has-text('הוספת רכב')",
    "a:has-text('הוספת רכב')",
    "button:has-text('הוסף רכב')",
    "a:has-text('הוסף רכב')"
  ], 5000);

  if (!addOpened) {
    await waitForEnter(`Open 'Add vehicle' form for vehicle #${index + 1}`);
  }

  const plateFilled = await fillFirst(page, [
    "input[name*='plate' i]",
    "input[name*='license' i]",
    "input[placeholder*='מספר רכב']",
    "input[placeholder*='לוחית']"
  ], vehicle.plate, 5000);

  if (!plateFilled) {
    await waitForEnter(`Fill vehicle plate manually: ${vehicle.plate}`);
  }

  await fillFirst(page, [
    "input[name*='nick' i]",
    "input[name*='name' i]",
    "input[placeholder*='כינוי']",
    "input[placeholder*='שם רכב']"
  ], vehicle.nickname ?? `Vehicle ${index + 1}`, 2000);

  const saved = await clickFirst(page, [
    "button:has-text('שמירה')",
    "button:has-text('שמור')",
    "button:has-text('הוסף')",
    "button[type='submit']"
  ], 3000);

  if (!saved) {
    await waitForEnter(`Save vehicle #${index + 1} manually`);
  }

  await page.waitForTimeout(1500);
}

const browser = await chromium.launch({ headless: false, slowMo: 150 });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await login(page);
  await openSubscription(page);

  for (let i = 0; i < vehicles.length; i += 1) {
    console.log(`Adding vehicle ${i + 1}/${vehicles.length}: ${vehicles[i].plate}`);
    await addVehicle(page, vehicles[i], i);
  }

  console.log("Finished. Please verify in UI that all 3 vehicles were added.");
  await waitForEnter("Verification complete");
} catch (error) {
  console.error("Automation failed:", error.message);
  await waitForEnter("Resolve in browser and continue if needed");
} finally {
  await context.close();
  await browser.close();
}
