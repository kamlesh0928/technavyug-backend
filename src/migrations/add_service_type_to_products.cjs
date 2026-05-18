"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE Products
      MODIFY COLUMN type ENUM('Physical', 'Digital', 'Service') NOT NULL DEFAULT 'Physical'
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE Products
      MODIFY COLUMN type ENUM('Physical', 'Digital') NOT NULL DEFAULT 'Physical'
    `);
  },
};
