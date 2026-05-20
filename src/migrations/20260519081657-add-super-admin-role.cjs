"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE Users MODIFY COLUMN role ENUM('Student', 'Instructor', 'Admin', 'Sub Admin', 'Super Admin', 'Guest') DEFAULT 'Student';`,
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE Users MODIFY COLUMN role ENUM('Student', 'Instructor', 'Admin', 'Sub Admin', 'Guest') DEFAULT 'Student';`,
    );
  },
};
