# GitHub + Firebase setup

This repository is prepared for automatic Firebase Hosting deployment from GitHub Actions.

## One-time GitHub secret

In the GitHub repository, create an Actions secret named `FIREBASE_SERVICE_ACCOUNT` and store the JSON service-account key created for Firebase Hosting / deployment automation. Do not commit that JSON file into the repository.

Firebase's official Hosting GitHub integration can also create the required service account, upload the encrypted secret, and generate workflow files with `firebase init hosting:github`.

## Main branch

Push the project to GitHub with the default branch named `main`. Every push to `main` deploys the `public/` folder to the live Firebase Hosting channel.

Changes to `database.rules.json`, `firebase.json`, or `functions/` also deploy the database rules and Cloud Functions workflow.

## Firebase Console requirements

1. Firebase project: `cshs-gmsm`.
2. Realtime Database must exist at the database URL in `firebase-config.js`.
3. Anonymous Authentication must be enabled because the current GMS UI still uses its existing application-level username/password login while Firebase supplies the authenticated transport identity for the current Realtime Database architecture.
4. For production role security, move the visible login to Firebase Authentication and issue role custom claims. The current compatibility layer should not be treated as a final enterprise authorization model.
