const jwt = require('jsonwebtoken');
const { User } = require('../models');

// JWT密钥 - 在生产环境中应该使用环境变量
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 生成JWT令牌
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// 验证JWT令牌的中间件
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: '访问被拒绝：缺少认证令牌' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(401).json({ 
        error: '访问被拒绝：用户不存在' 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        error: '访问被拒绝：账户已被禁用' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        error: '访问被拒绝：无效的认证令牌' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ 
        error: '访问被拒绝：认证令牌已过期' 
      });
    }
    console.error('认证中间件错误:', error);
    return res.status(500).json({ 
      error: '认证服务异常' 
    });
  }
};

// 可选的认证中间件（不会阻止请求，但会设置user信息）
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findByPk(decoded.userId, {
        attributes: { exclude: ['password'] }
      });
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
  } catch (error) {
    // 可选认证失败时不阻止请求
    console.log('可选认证失败:', error.message);
  }
  next();
};

// VIP级别检查中间件
const requireVipLevel = (minLevel) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: '访问被拒绝：需要登录' 
      });
    }

    if (req.user.vipLevel < minLevel) {
      return res.status(403).json({ 
        error: `访问被拒绝：需要VIP${minLevel}或更高级别` 
      });
    }

    // 检查VIP是否过期
    if (req.user.vipExpireAt && new Date() > req.user.vipExpireAt) {
      return res.status(403).json({ 
        error: '访问被拒绝：VIP会员已过期' 
      });
    }

    next();
  };
};

module.exports = {
  generateToken,
  authenticateToken,
  optionalAuth,
  requireVipLevel,
  JWT_SECRET
}; 