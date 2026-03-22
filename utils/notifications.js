const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// You'll need to download your service account key from Firebase Console
// and save it as serviceAccountKey.json in your project root
try {
  const serviceAccount = require('../serviceAccountKey.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (error) {
  console.warn(
    'Firebase Admin not initialized. Push notifications will not work.',
  );
  console.warn(
    'Download service account key from Firebase Console and save as serviceAccountKey.json',
  );
}

/**
 * Send a push notification to a device
 * @param {string} fcmToken - The FCM token of the recipient device
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data to send
 */
const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  try {
    if (!admin.apps.length) {
      console.warn('Firebase not initialized, skipping notification');
      return null;
    }

    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      token: fcmToken,
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent notification:', response);
    return response;
  } catch (error) {
    console.error('Error sending notification:', error);

    // If token is invalid, you might want to remove it from the user
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      console.log('Invalid FCM token, should be removed from user');
    }

    return null;
  }
};

/**
 * Send notifications to multiple devices
 * @param {Array<string>} fcmTokens - Array of FCM tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data to send
 */
const sendMulticastNotification = async (fcmTokens, title, body, data = {}) => {
  try {
    if (!admin.apps.length) {
      console.warn('Firebase not initialized, skipping notifications');
      return null;
    }

    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      tokens: fcmTokens,
    };

    const response = await admin.messaging().sendMulticast(message);
    console.log(`Successfully sent ${response.successCount} notifications`);

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(
            `Failed to send to token ${fcmTokens[idx]}:`,
            resp.error,
          );
        }
      });
    }

    return response;
  } catch (error) {
    console.error('Error sending multicast notification:', error);
    return null;
  }
};

module.exports = {
  sendPushNotification,
  sendMulticastNotification,
};
