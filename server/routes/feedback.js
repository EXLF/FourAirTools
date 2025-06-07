const express = require('express');
const router = express.Router();
const db = require('../models');
const Feedback = db.Feedback;
const { Op } = require('sequelize');

/**
 * 获取客户端IP地址
 */
function getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           req.ip;
}

/**
 * 提交用户反馈
 * POST /api/feedback
 */
router.post('/', async (req, res) => {
    try {
        const {
            type,
            priority = 'low',
            title,
            description,
            browser,
            version,
            contact,
            contactName,
            userAgent,
            url
        } = req.body;

        // 验证必填字段
        if (!type || !title || !description) {
            return res.status(400).json({
                success: false,
                message: '缺少必填字段：type, title, description'
            });
        }

        // 验证反馈类型
        const validTypes = ['bug', 'feature', 'improvement', 'other'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: '无效的反馈类型'
            });
        }

        // 验证优先级
        const validPriorities = ['low', 'medium', 'high'];
        if (!validPriorities.includes(priority)) {
            return res.status(400).json({
                success: false,
                message: '无效的优先级'
            });
        }

        // 验证字段长度
        if (title.length > 100) {
            return res.status(400).json({
                success: false,
                message: '标题不能超过100个字符'
            });
        }

        if (description.length > 2000) {
            return res.status(400).json({
                success: false,
                message: '描述不能超过2000个字符'
            });
        }

        // 获取客户端IP
        const ipAddress = getClientIP(req);

        // 创建反馈记录
        const feedback = await Feedback.create({
            type,
            priority,
            title: title.trim(),
            description: description.trim(),
            browser: browser ? browser.trim() : null,
            version: version ? version.trim() : null,
            contact: contact ? contact.trim() : null,
            contactName: contactName ? contactName.trim() : null,
            userAgent: userAgent || req.headers['user-agent'],
            url: url || req.headers.referer,
            ipAddress,
            status: 'pending'
        });

        console.log(`新反馈提交: ${feedback.id} - ${type} - ${title}`);

        res.json({
            success: true,
            message: '反馈提交成功',
            data: {
                id: feedback.id,
                type: feedback.type,
                title: feedback.title,
                createdAt: feedback.createdAt
            }
        });

    } catch (error) {
        console.error('提交反馈失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

/**
 * 获取反馈列表（管理员）
 * GET /api/feedback
 */
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            type,
            status,
            priority,
            search,
            sortBy = 'createdAt',
            sortOrder = 'DESC'
        } = req.query;

        // 构建查询条件
        const where = {};
        
        if (type) {
            where.type = type;
        }
        
        if (status) {
            where.status = status;
        }
        
        if (priority) {
            where.priority = priority;
        }
        
        if (search) {
            where[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } },
                { contactName: { [Op.like]: `%${search}%` } }
            ];
        }

        // 验证排序字段
        const validSortFields = ['createdAt', 'updatedAt', 'priority', 'status', 'type'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // 分页参数
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // 查询数据
        const { rows: feedbacks, count: total } = await Feedback.findAndCountAll({
            where,
            order: [[sortField, order]],
            limit: parseInt(limit),
            offset: offset,
            attributes: {
                exclude: ['userAgent'] // 在列表中隐藏详细的userAgent信息
            }
        });

        res.json({
            success: true,
            data: {
                feedbacks,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });

    } catch (error) {
        console.error('获取反馈列表失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

/**
 * 获取反馈详情（管理员）
 * GET /api/feedback/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const feedback = await Feedback.findByPk(id);

        if (!feedback) {
            return res.status(404).json({
                success: false,
                message: '反馈不存在'
            });
        }

        res.json({
            success: true,
            data: feedback
        });

    } catch (error) {
        console.error('获取反馈详情失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

/**
 * 更新反馈状态（管理员）
 * PUT /api/feedback/:id
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminNotes, assignedTo } = req.body;

        const feedback = await Feedback.findByPk(id);

        if (!feedback) {
            return res.status(404).json({
                success: false,
                message: '反馈不存在'
            });
        }

        // 验证状态
        const validStatuses = ['pending', 'processing', 'resolved', 'closed'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: '无效的状态'
            });
        }

        // 更新字段
        const updateData = {};
        if (status) {
            updateData.status = status;
            if (status === 'resolved' && !feedback.resolvedAt) {
                updateData.resolvedAt = new Date();
            }
        }
        if (adminNotes !== undefined) {
            updateData.adminNotes = adminNotes;
        }
        if (assignedTo !== undefined) {
            updateData.assignedTo = assignedTo;
        }

        await feedback.update(updateData);

        console.log(`反馈状态更新: ${id} - ${status}`);

        res.json({
            success: true,
            message: '反馈状态更新成功',
            data: feedback
        });

    } catch (error) {
        console.error('更新反馈状态失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

/**
 * 删除反馈（管理员）
 * DELETE /api/feedback/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const feedback = await Feedback.findByPk(id);

        if (!feedback) {
            return res.status(404).json({
                success: false,
                message: '反馈不存在'
            });
        }

        await feedback.destroy();

        console.log(`反馈已删除: ${id}`);

        res.json({
            success: true,
            message: '反馈删除成功'
        });

    } catch (error) {
        console.error('删除反馈失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

/**
 * 获取反馈统计信息（管理员）
 * GET /api/feedback/stats
 */
router.get('/admin/stats', async (req, res) => {
    try {
        const stats = await Feedback.getStats();

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('获取反馈统计失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

/**
 * 获取最近的反馈（管理员）
 * GET /api/feedback/admin/recent
 */
router.get('/admin/recent', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        const recentFeedbacks = await Feedback.getRecent(parseInt(limit));

        res.json({
            success: true,
            data: recentFeedbacks
        });

    } catch (error) {
        console.error('获取最近反馈失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

module.exports = router; 