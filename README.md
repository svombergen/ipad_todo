# Mijn dag: kids TODO kiosk (iPad Air 2, iPadOS 15)

An offline React app bundled inside a fullscreen Swift/WKWebView shell. It is landscape only, keeps the screen awake, and is installed with TrollStore. All app text is in Dutch.

- **Several kids, one task list.** Each kid has an avatar, their own ticks and their own ⭐. Tap an avatar to switch kids.
- **Several task lists** (default: Ochtend and Avond). Tap a tab to switch; the progress bar and party screen are per list. In parent mode: tap the selected tab to rename it, ✖ to delete it (with its tasks), ➕ Lijst to add one. New tasks go into the selected list.
- Tap a card to tick it off and earn ⭐. Tap again to undo it (and lose the star).
- When a kid finishes every task, a party screen appears.
- Ticks reset at midnight. Stars carry over.
- **Parent mode:** hold 🔒 for 2 s. From there you can:
  - add or delete (✖) tasks
  - add or delete kids
  - tap a kid to rename them
  - icon pickers are collapsed: tap the icon button to see the options
  - **leaving parent mode (✅ Klaar) resets all stars and ticks**
- **Updates:** the app checks `<server>/version.json` on launch and whenever it comes back to the foreground (set the address with 🔄 Server in parent mode). When CI built something newer, a small ⬆️ Update button appears in the header; it opens the TrollStore install link. TrollStore → Settings → URL Scheme must be on. The build number is the GitHub Actions run number (bumps on every push) and shows in parent mode.
- Data is stored in `Documents/state.json` in the app sandbox.

## Develop (any OS)

```sh
cd web
npm install
npm run dev     # browser, state stored in localStorage
npm test        # logic tests
npm run build   # outputs to ios/Kiosk/web
```

App icon: `ios/Kiosk/Assets.xcassets/AppIcon.appiconset/icon.png`. Regenerate it with `python tools/make_icon.py` (needs Pillow).

## Build the IPA

**GitHub Actions** (no Mac needed): every push runs `.github/workflows/ipa.yml` on a macOS runner. Download the IPA from the run's `KidsTodo-ipa` artifact.

**On a Mac with Xcode 15+:**

```sh
brew install xcodegen ldid
sh build.sh     # outputs KidsTodo.ipa
```

## Install

AirDrop or copy `KidsTodo.ipa` to the iPad, open it with TrollStore, and tap Install.

## Lock it down

The iPad Air 2 has a home button, so the app alone can't stop a kid from leaving it. Use **Guided Access** to lock the device to the app: Settings → Accessibility → Guided Access → On, set a passcode, open the app, and triple-click the home button.

# Dagboek (second app, `diary/`)

Registration diary, e.g. every time of peeing with the amount in ml. Same stack as above (React in a WKWebView shell, installed with TrollStore), bundle id `local.kiosk.dagboek`.

- **Registreer:** one big button per category (e.g. Drinken, Plassen). A category with options shows them after the tap (Drankje 200 ml, Drankje 300 ml, Yoghurt (250gr) 150 ml, "Anders…" for a free amount): one more tap saves. A category without options or unit saves on the first tap. Date and time are always the moment of the tap (never typed). A toast offers *Ongedaan* for 6 s.
- **Overzicht:** *Grafiek* (stacked bars of the ml amounts, one color per category; starts at hours / days / months depending on the data, tap a bar to drill down) or *Lijst* (per day with totals, delete). Period filter: vandaag / 7 dagen / alles.
- **Export** (from *Lijst*, what you see is what you export): PDF (paginated A4), plain text, JSON. All through the iOS share sheet: save to Files, Mail, AirDrop…
- **Lijsten:** create/edit categories with name, icon, optional unit and options (name + amount). Deleting a category keeps old registrations. Also holds the update button.
- Data in `Documents/state.json`. Updates work like the kids app, from `<server>/diary/version.json` and `/diary/Diary.ipa`; the *Nieuwe versie installeren* button (and a red dot on the *Lijsten* tab) appears when CI built something newer.

```sh
cd diary/web && npm install && npm run dev   # browser, localStorage
sh build.sh diary Diary                        # on a Mac: outputs diary/Diary.ipa
python tools/make_diary_icon.py                # regenerate the icon
```
CI builds both IPAs in the same run; they share the build number.

`ship.ps1` serves a start page with, per IPA: install in TrollStore, download, and **Preview (iPad)**. The preview unpacks the web app from the IPA and shows it in an iPad-sized frame in the browser (state in localStorage, no iOS shell, so sharing/PDF falls back to a file download).
