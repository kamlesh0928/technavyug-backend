import admin from "firebase-admin";
import Logger from "../utils/logger.js";

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: privateKey,
};

try {
  if (!admin.apps.length && serviceAccount.projectId) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    Logger.info("Firebase Admin initialized successfully.");
  } else if (!serviceAccount.projectId) {
    Logger.warn("Firebase Admin NOT initialized: Missing credentials.");
  }
} catch (error) {
  Logger.error("Error initializing Firebase Admin", error);
}

export default admin;
