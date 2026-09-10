# Cloud Functions

Deploy this folder to enable Firebase Auth account provisioning from the admin account form.

Main callable:
- `upsertManagedAccount`

It creates or updates a Firebase Authentication account, assigns custom claims, and mirrors the profile into Realtime Database.
