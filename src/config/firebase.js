import admin from "firebase-admin";
import { createRequire } from "module";
import Logger from "../utils/logger.js";

const require = createRequire(import.meta.url);

try {
  if (!admin.apps.length) {
    const serviceAccount = require("./serviceAccountKey.json");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    Logger.info("Firebase Admin initialized successfully.");
  }
} catch (error) {
  Logger.error("Error initializing Firebase Admin", error);
}

export default admin;
