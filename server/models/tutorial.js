module.exports = (sequelize, DataTypes) => {
  const Tutorial = sequelize.define('Tutorial', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    url: {
      type: DataTypes.STRING,
      allowNull: true
    },
    imageUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'image_url'
    }
  }, {
    tableName: 'tutorials',
    timestamps: true,
    underscored: true
  });

  return Tutorial;
}; 