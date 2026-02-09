const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const UserPreferredRack = sequelize.define(
  "UserPreferredRack",
  {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    rack_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "user_preferred_racks",
    indexes: [
      {
        unique: true,
        fields: ["user_id", "rack_id"],
      },
    ],
  }
);

module.exports = UserPreferredRack;
