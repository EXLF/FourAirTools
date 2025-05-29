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
      allowNull: true
    }
  }, {
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'title_index',
        fields: ['title']
      },
      {
        name: 'category_index',
        fields: ['category']
      },
      {
        name: 'updated_at_index',
        fields: ['updated_at']
      }
    ]
  });

  return Tutorial;
}; 