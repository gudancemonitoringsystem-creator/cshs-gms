# Guidance Management System — Firebase Realtime Database + Hosting

This package keeps the existing GMS design and connects its application state to **Firebase Realtime Database** with realtime listeners, offline local cache, queued writes, connection monitoring, and Firebase Hosting.

## Firebase project

- Project ID: `cshs-gmsm`
- Realtime Database: `https://cshs-gmsm-default-rtdb.firebaseio.com`
- App state path: `gms_state/v1`
- Hosting public folder: `public/`
- Expected Hosting URL: `https://cshs-gmsm.web.app`

## What was fixed

- The Firebase web configuration is loaded before GMS initialization.
- The app uses the real Realtime Database URL for `cshs-gmsm`.
- Firebase Anonymous Authentication is used by the current compatibility layer so Realtime Database rules can require an authenticated Firebase session.
- Realtime connection state is monitored through `.info/connected`.
- Realtime listeners are detached and rebuilt after connection errors.
- Writes are serialized and merged against the latest remote state to reduce accidental overwrites when more than one browser is active.
- LocalStorage remains a cache/offline fallback; Firebase is the cloud source when connected.
- Firebase Hosting serves only the `public/` directory and does not expose project source files.
- Cache headers prevent stale `index.html` from hiding a newly deployed version.
- The normal deployment target is deliberately limited to **Database rules + Hosting**, so the project does not depend on Cloud Functions just to publish the website.
- `firebase-test.html` is included for a live Firebase connectivity check.

## Important Firebase Console setup

Before the first production test, open Firebase Console for project `cshs-gmsm` and make sure:

1. **Build → Authentication → Sign-in method → Anonymous** is enabled.
2. **Build → Realtime Database** exists and is in the expected database.
3. Deploy `database.rules.json` from this package.

The browser Firebase configuration in `firebase-config.js` is safe to ship with a web application. Do not place service-account private keys in this folder or in `public/`.

## Publish from Windows

### Option A — Command Prompt

Double-click:

```text
DEPLOY_GMS.cmd
```

Or run:

```bat
firebase login
firebase use cshs-gmsm
firebase deploy --only database,hosting --project cshs-gmsm
```

### Option B — PowerShell

Run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\DEPLOY_GMS.ps1
```

## Verify the live database

Read the root state with:

```bat
firebase database:get /gms_state/v1 --project cshs-gmsm
```

An empty installation may return `null` until the GMS web app initializes for the first time. After the web app connects, the GMS state is stored under `gms_state/v1`.

You can also open the live connection test:

```text
https://cshs-gmsm.web.app/firebase-test.html
```

The test checks Firebase initialization, Anonymous Authentication, and Realtime Database access.

## Project structure

```text
gms_final_project/
├─ public/
│  ├─ index.html
│  ├─ firebase-config.js
│  ├─ firebase-test.html
│  ├─ patch.js
│  └─ assets/
│     ├─ deped_seal.png
│     └─ certificate_footer.png
├─ database.rules.json
├─ firebase.json
├─ .firebaserc
├─ DEPLOY_GMS.cmd
├─ DEPLOY_GMS.ps1
└─ README.md
```

## Security architecture note

The current GMS interface has its own application-level account screen. Firebase Anonymous Authentication is only the transport/authentication layer used by this compatibility build. It is **not** equivalent to secure role-based Firebase Authentication.

For a fully production-grade authorization model, the application should eventually move its login to Firebase Authentication with email/password or Google Sign-In and use Firebase custom claims plus rules for trusted `admin`, `counselor`, `principal`, `teacher`, and `student` permissions. That is a separate migration from the Hosting/Realtime Database publishing setup delivered here.
