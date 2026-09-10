const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

function requireAdmin(context) {
  const role = context.auth?.token?.role;
  if (!context.auth || role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
  }
}

exports.upsertManagedAccount = functions.https.onCall(async (data, context) => {
  requireAdmin(context);

  const email = String(data.email || '').trim().toLowerCase();
  const username = String(data.username || '').trim();
  const password = String(data.password || '').trim();
  const displayName = String(data.displayName || '').trim();
  const role = String(data.role || '').trim();

  if (!username || !displayName || !role) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required account fields.');
  }

  const allowedRoles = ['admin', 'counselor', 'principal', 'teacher', 'student'];
  if (!allowedRoles.includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid role.');
  }

  let userRecord = null;
  if (email) {
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (_) {
      userRecord = null;
    }
  }

  if (!userRecord) {
    if (!email) {
      throw new functions.https.HttpsError('invalid-argument', 'Email is required to create a Firebase Auth account.');
    }
    if (!password) {
      throw new functions.https.HttpsError('invalid-argument', 'Password is required for a new Firebase Auth account.');
    }
    userRecord = await admin.auth().createUser({
      email,
      password,
      displayName
    });
  } else {
    await admin.auth().updateUser(userRecord.uid, {
      displayName,
      email: email || userRecord.email || undefined,
      password: password || undefined
    });
  }

  await admin.auth().setCustomUserClaims(userRecord.uid, {
    role,
    admin: role === 'admin',
    counselor: role === 'counselor',
    principal: role === 'principal',
    teacher: role === 'teacher',
    student: role === 'student'
  });

  const profile = {
    uid: userRecord.uid,
    username,
    email,
    displayName,
    role,
    updatedAt: admin.database.ServerValue.TIMESTAMP
  };

  if (role === 'student') {
    profile.lrn = String(data.lrn || '').trim();
    profile.section = String(data.section || '').trim();
    profile.adviser = String(data.adviser || '').trim();
  } else {
    profile.department = String(data.department || '').trim();
    profile.position = String(data.position || '').trim();
  }

  await admin.database().ref(`managedAccounts/${userRecord.uid}`).update(profile);
  await admin.database().ref('auditLogs').push({
    action: 'Auth account provisioned',
    user: context.auth.uid,
    role: 'admin',
    target: userRecord.uid,
    details: `${username} synced to Firebase Auth`,
    createdAt: admin.database.ServerValue.TIMESTAMP
  });

  return { uid: userRecord.uid, username, role };
});
