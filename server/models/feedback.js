const { DataTypes } = require('sequelize');

/**
 * 用户反馈模型
 */
module.exports = (sequelize, DataTypes) => {
const Feedback = sequelize.define('Feedback', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    type: {
        type: DataTypes.ENUM('bug', 'feature', 'improvement', 'other'),
        allowNull: false,
        comment: '反馈类型：bug-错误报告，feature-功能建议，improvement-体验优化，other-其他'
    },
    priority: {
        type: DataTypes.ENUM('low', 'medium', 'high'),
        allowNull: false,
        defaultValue: 'low',
        comment: '优先级：low-一般，medium-重要，high-紧急'
    },
    title: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: '反馈标题'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: '详细描述'
    },
    browser: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '浏览器/系统信息'
    },
    version: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: '产品版本'
    },
    contact: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: '联系方式'
    },
    contactName: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '联系人姓名'
    },
    userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '完整的User-Agent信息'
    },
    url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: '提交反馈时的页面URL'
    },
    ipAddress: {
        type: DataTypes.STRING(45),
        allowNull: true,
        comment: 'IP地址'
    },
    status: {
        type: DataTypes.ENUM('pending', 'processing', 'resolved', 'closed'),
        allowNull: false,
        defaultValue: 'pending',
        comment: '处理状态：pending-待处理，processing-处理中，resolved-已解决，closed-已关闭'
    },
    adminNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '管理员备注'
    },
    assignedTo: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '分配给的处理人员'
    },
    resolvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '解决时间'
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'feedbacks',
    timestamps: true,
    indexes: [
        {
            fields: ['type']
        },
        {
            fields: ['status']
        },
        {
            fields: ['priority']
        },
        {
            fields: ['createdAt']
        }
    ]
});

/**
 * 获取反馈统计信息
 */
Feedback.getStats = async function() {
    const [total, pending, processing, resolved, closed] = await Promise.all([
        this.count(),
        this.count({ where: { status: 'pending' } }),
        this.count({ where: { status: 'processing' } }),
        this.count({ where: { status: 'resolved' } }),
        this.count({ where: { status: 'closed' } })
    ]);

    const typeStats = await this.findAll({
        attributes: [
            'type',
            [sequelize.fn('COUNT', sequelize.col('type')), 'count']
        ],
        group: ['type']
    });

    const priorityStats = await this.findAll({
        attributes: [
            'priority',
            [sequelize.fn('COUNT', sequelize.col('priority')), 'count']
        ],
        group: ['priority']
    });

    return {
        total,
        statusStats: { pending, processing, resolved, closed },
        typeStats: typeStats.reduce((acc, item) => {
            acc[item.type] = item.dataValues.count;
            return acc;
        }, {}),
        priorityStats: priorityStats.reduce((acc, item) => {
            acc[item.priority] = item.dataValues.count;
            return acc;
        }, {})
    };
};

/**
 * 获取最近的反馈
 */
Feedback.getRecent = async function(limit = 10) {
    return await this.findAll({
        order: [['createdAt', 'DESC']],
        limit: limit
    });
};

return Feedback;
}; 