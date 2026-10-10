# StormCard on iPhone

StormCard runs on the laptop. The iPhone opens it in Safari over the same Wi-Fi and saves it to the Home Screen. It opens full screen with its own icon. This is not an offline phone app (see ARCHI §8, §12, §20).

## Install (2 minutes)

1. On the laptop, start the server so the phone can reach it (bind to all interfaces, not just localhost):
   ```bash
   .venv/bin/flask --app app run --host 0.0.0.0 --port 8000
   ```
   If macOS asks "accept incoming network connections?", click Allow.
2. Get the laptop IP with `ipconfig getifaddr en0`. Today it is `10.88.2.20`, so the phone URL is **http://10.88.2.20:8000**.
3. Connect the iPhone to the **same Wi-Fi** as the laptop. Open that URL in **Safari** (not Chrome).
4. Tap Share → **Add to Home Screen** → Add. The StormCard icon opens the app full screen, with no Safari bars.

If the page does not load, check that the server is bound to `0.0.0.0` and that the phone is not on cellular. Guest Wi-Fi networks often block device-to-device traffic. If that happens, use the laptop's Personal Hotspot or the phone's hotspot.

## What works on the phone

| Works (phone online, same Wi-Fi as laptop) | Does not work |
|---|---|
| Language, place presets, household flags, card, map, shelters | Phone in airplane mode or off the laptop's Wi-Fi: no connection to the laptop, so nothing loads |
| Ask, Force offline (the answer still comes from the laptop's Ollama) | "Use my location": Safari only allows location on HTTPS or localhost, and this is plain `http://<ip>`. Use the place presets. |
| "Open my saved card" (saved in the phone's own storage) | Opening the app with the laptop unreachable: there is no service worker, by design |

**Demo note:** do the Wi-Fi-off moment **on the laptop browser** (`http://localhost:8000`), not on the phone. A phone in airplane mode cannot reach the laptop's Ollama. The phone shows the online part: the Kreyòl card on a real iPhone, installed like an app.

## Stretch (not built): native wrapper

**Minimal option:** an Xcode SwiftUI app with a single `WKWebView` loading `http://<laptop-ip>:8000`. It needs an `NSAppTransportSecurity` exception for plain HTTP (`NSAllowsLocalNetworking`) and a Local Network usage string. That is about 30 lines of Swift. Capacitor iOS with `server.url` gives the same result, but it adds npm packages and a CocoaPods/SPM step, and still needs Xcode. So it is strictly more work.

**What it requires:**
- Full Xcode from the App Store: about 3 GB to download, 10+ GB on disk, and 30 to 60+ min to download, install and add the iOS platform on hackathon Wi-Fi. This Mac has only Command Line Tools today (`xcodebuild` fails), and no Android Studio.
- An Apple ID in Xcode for free personal-team signing. The app expires after 7 days.
- A USB-C cable, Developer Mode on the iPhone (needs a restart), and trusting the developer profile in Settings.
- Estimated time: about 1.5 to 2 hours end to end, mostly the Xcode install and signing.

**Recommendation: skip it before 15:00.** It shows the same pages as Add to Home Screen (same icon, full screen, same need to reach the laptop). It adds no offline ability. The Xcode download alone would compete for Wi-Fi and time with the CP3 Wi-Fi-off rehearsal (14:00 scope freeze). Revisit only after the demo is locked, and only if a judge asks for a "real app".
