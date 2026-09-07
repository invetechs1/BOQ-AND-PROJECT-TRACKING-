# Manual Testing Guide

Step-by-step instructions for testing the complete workflow from the browser — from creating a company to collecting a paid claim.

## Before you start

```bash
npm install
cp .env.example .env   # edit ADMIN_PASSWORD if you like
npm start
```
Open `http://localhost:3000` and log in with the admin account (admin / whatever `.env` has).

> **Tip:** test on a data copy separate from your real data — set `DATA_DIR` to a scratch folder before running:
> `DATA_DIR=./data-test PORT=3001 node server.js` (on Windows/PowerShell: `$env:DATA_DIR="./data-test"; $env:PORT="3001"; node server.js`)
> This opens a fully separate instance on a different port, with zero risk to your real data.

---

## 1. Companies and Users (admin only)

1. **🗂 Projects** tab → **🏢 Manage Companies** → add a new company.
2. **👥 Manage Users** → add a user with role **Client**, linked to the company you just created.
3. Add another user with role **Project Manager** (pm) for the same company.

**Check:** both users appear in the list with the correct role and company.

## 2. Log in as the client and create a project

1. Log out, then log in with the **client** account you created.
2. Projects tab → **+ Add Project** → fill in name, type, VAT/retention/advance-recovery → save.
3. Edit the project again and assign the **responsible project manager** (pm).

**Check:** the client only sees their own project (not other companies' projects, if any exist).

## 3. Bill of Quantities (BOQ)

Test all **three ways** to enter items:
- Manually: **+ Add Item** (number, description, quantity, price — add two items, with the second depending on the first via "Depends on items").
- Excel import: **📥 Import BOQ from Excel** → download the ready template first, edit it, then upload — check the automatic column matching and the preview before confirming.
- Copy from another project: when creating a new project, choose "Copy items from" an existing project.

**Check:** an item that depends on another item that isn't done yet shows status **"Waiting"** (⏳), not "Available".

## 4. Blocker on an item

1. Edit the first item → enable **"There is an external blocker preventing work"** → enter the reason and type → save.
2. **🚫 Blockers** tab: confirm the item shows status **"Blocked"**, and that the calculated financial impact includes the item itself + anything depending on it.
3. Click **"Blocker resolved"**.

**Check:** after resolving, the first item goes back to "Available", and the item that was waiting on it also becomes "Available" (since its predecessor is no longer blocked), and the blocker is logged in the **Resolved Blockers Log**.

## 5. Log productivity (a work entry)

Log in with the **project manager** account. **👷 Productivity** tab:
1. Pick the item, enter the crew name, number of workers, and quantity executed today → **+ Add Log Entry**.
2. Leave "Automatically add the quantity" checked.

**Check:** the item's executed quantity in **BOQ Items** updated automatically, and its status changed accordingly (Available → In Progress → Complete depending on the percentage).

## 6. Build a Claim

**💰 Claims** tab → **🧾 Prepare New Claim**:
1. **✅ Select All Ready** to auto-select every claimable item.
2. Check that **Retention %** and **Advance Recovery %** auto-filled from the project's settings (not zero, and not another project's values if you've switched between projects).
3. **💾 Save & Submit Claim** → confirm the claim document shows correct math (total, VAT, retention, net).

**Check:** after saving, the item is now "Fully claimed" (claimed_full), and its claimable balance is zero.

## 7. Record a payment

In **📚 Previous Claims**, open the claim → **💵 Payment** → enter the full amount (the net) → save.

**Check:** the claim's status is now **"Paid"**, and the dashboard (📊) correctly reflects the collected amount.

## 8. Units (villas/buildings/sections)

**🏠 Units** tab → add a unit → open it and manually edit one item's completion percentage for that unit.

**Check:** the percentage is saved and still shows when you reopen the unit.

## 9. The most important check: refresh the page

After all the steps above, **actually refresh the page (F5)** and log in again if needed.

**Check:** everything is still there — the project, items, claim, payment, unit. If anything disappears after a refresh, that's a real problem worth reporting immediately (not just "it didn't save in the browser" — data is saved on the server, so it should survive any refresh as long as the same server is still running).

## 10. Language switch

Click the **🌐 English** button at the top of the page, and confirm the whole interface switches (including open menus and forms) without losing any entered data, then switch back to Arabic and confirm the direction (RTL/LTR) flips correctly.

---

## Permission testing (optional but important)

With a `pm` (project manager) account, try these actions — all should be blocked:
- Creating a company or a new project
- Adding users
- Viewing projects not assigned to them

With a `client` account, try:
- Adding a user with role "System Admin" — should be blocked (a client can only add pmo/pm roles)
- Accessing another company's project by editing the URL directly (if possible) — should be rejected by the server
