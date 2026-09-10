# Guidance Management System — Firebase Connected Build

This package keeps the existing GMS interface and connects it to Firebase Realtime Database with realtime listeners, offline local fallback, queued writes, connection-state monitoring, Firebase Hosting, and GitHub Actions deployment.

## Firebase project

- Project ID: `cshs-gmsm`
- Realtime Database URL: `https://cshs-gmsm-default-rtdb.firebaseio.com`
- Database state path: `gms_state/v1`
- Hosting web root: `public/`

## Important fixes in this build

- `index.html` now explicitly loads `firebase-config.js`. The previous package contained the correct config file but did not load it into the page before initialization.
- Realtime Database connection state is monitored through Firebase's `.info/connected` path.
- A failed realtime listener is properly detached and recreated during automatic reconnects.
- Writes are serialized and protected from a listener echo replacing unsaved local changes while a write is in progress.
- Hosting serves only the `public/` web files instead of exposing the entire project root.
- Cloud Functions are now declared in `firebase.json`, so `firebase deploy --only functions` has a valid target.
- The account-edit typo `passwordHashHash` is fixed.
- GitHub Actions workflows are included for Hosting, Realtime Database rules, and Functions.
- A Firebase connection test page is included as `public/firebase-test.html`.

## Local Firebase CLI deployment

From the project root:

```bash
firebase login
firebase use cshs-gmsm
firebase deploy --only database,hosting,functions
```

For Hosting only:

```bash
firebase deploy --only hosting
```

## GitHub automatic deployment

The GitHub workflow expects an Actions secret named `FIREBASE_SERVICE_ACCOUNT`. Firebase's official GitHub integration can create the service account, store its key as an encrypted repository secret, and generate the workflow using `firebase init hosting:github`.

Push to the `main` branch after the secret is configured. GitHub Actions will deploy the GMS Hosting site automatically.

## Firebase Console setup

Enable **Authentication → Anonymous** for the current compatibility architecture, then verify that Realtime Database exists and deploy `database.rules.json`.

## Security note

The current application still has an application-level username/password screen whose account records live in the synchronized GMS state. Anonymous Firebase Authentication therefore authenticates the browser transport but does not make the GMS role itself a trusted Firebase identity. Realtime Database rules cannot safely enforce admin/counselor/teacher/principal/student permissions from those client-controlled records.

For a true production school system, migrate the login to Firebase Authentication (email/password and/or Google Sign-In), store the authenticated UID with each managed account, issue role custom claims from Cloud Functions, and make Realtime Database rules authorize operations from those claims. Firebase recommends Authentication plus Security Rules for this kind of authorization model.
