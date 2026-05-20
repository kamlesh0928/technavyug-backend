import { Sequelize } from "sequelize";
import "dotenv/config";

const isTest = process.env.NODE_ENV === "test";

const sequelize = isTest
  ? new Sequelize("sqlite::memory:", { logging: false })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASS,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        dialect: "mysql",
        logging: false,
        dialectOptions: {
          connectTimeout: 60000,
        },
        pool: {
          max: 10,
          min: 2,
          acquire: 30000,
          idle: 10000,
        },
      },
    );

export default sequelize;
