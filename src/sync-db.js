import "dotenv/config";
import { sequelize } from "./models/index.js";
import Logger from "./utils/logger.js";

const syncDB = async () => {
  try {
    Logger.info("Starting database sync...");
    await sequelize.authenticate();
    Logger.info("Connected to Database.");

    if (process.env.NODE_ENV === "production") {
      Logger.warn(
        "Production mode — alter sync is disabled. Use `npm run migrate` instead.",
      );
    } else {
      await sequelize.sync({ alter: true });
      Logger.info("Database synchronized successfully (dev mode).");
    }

    process.exit(0);
  } catch (error) {
    Logger.error("Failed to sync database:", error);
    process.exit(1);
  }
};

syncDB();
