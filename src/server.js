import "dotenv/config";

import app from "./app.js";
import { sequelize } from "./models/index.js";
import Logger from "./utils/logger.js";
import { startReminderScheduler } from "./services/reminderScheduler.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    Logger.info("Connected to MySQL Database");

    const server = app.listen(PORT, "0.0.0.0", () => {
      Logger.info(`Server running on port ${PORT}`);

      // In development, auto-sync schema changes for convenience.
      // In production, migrations handle all schema changes — never use alter: true.
      if (process.env.NODE_ENV !== "production") {
        sequelize
          .sync({ alter: true })
          .then(() => Logger.info("Database synced successfully (dev mode)."))
          .catch((err) => Logger.error("Automatic database sync failed:", err));
      } else {
        Logger.info(
          "Production mode — skipping auto-sync. Use migrations instead.",
        );
      }
    });

    server.timeout = 600000;
    server.keepAliveTimeout = 65000;

    startReminderScheduler();
  } catch (err) {
    Logger.error("Database connection failed:", err);
    process.exit(1);
  }
};

startServer();
