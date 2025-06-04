module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
        isAlphanumeric: {
          msg: '用户名只能包含字母和数字'
        }
      }
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: {
          msg: '请输入有效的邮箱地址'
        }
      }
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: {
          args: [8, 255],
          msg: '密码长度至少为8位'
        }
      }
    },
    nickname: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [0, 50]
      }
    },
    avatar: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // VIP相关字段
    vipLevel: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0,
        max: 5
      }
    },
    vipExpireAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // 积分系统
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0
      }
    },
    totalPointsEarned: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0
      }
    },
    // 账户状态
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    // 登录相关
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    loginCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    // 本地数据保护
    hasLocalPassword: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    // 设备信息
    deviceId: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    // 推荐系统
    referredBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    referralCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true
    }
  }, {
    tableName: 'users',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['username']
      },
      {
        unique: true,
        fields: ['email']
      },
      {
        fields: ['vipLevel']
      },
      {
        fields: ['isActive']
      },
      {
        fields: ['referralCode']
      }
    ]
  });

  // 关联关系
  User.associate = function(models) {
    // 自引用：推荐关系
    User.belongsTo(models.User, {
      as: 'referrer',
      foreignKey: 'referredBy'
    });
    User.hasMany(models.User, {
      as: 'referrals',
      foreignKey: 'referredBy'
    });
  };

  return User;
}; 