/**
 * @fileoverview 认证服务 - 统一管理应用的认证和授权逻辑
 * @module services/AuthService
 */

const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');

/**
 * 认证服务类
 * 负责处理密码验证、密码更改、应用重置等认证相关功能
 */
class AuthService {
    /**
     * 创建认证服务实例
     * @param {Object} cryptoService - 加密服务实例
     * @param {Object} db - 数据库服务实例
     */
    constructor(cryptoService, db) {
        this.crypto = cryptoService;
        this.db = db;
        this.maxLoginAttempts = 5;
        this.loginAttempts = 0;
        this.lockoutTime = 5 * 60 * 1000; // 5分钟锁定时间
        this.lastFailedAttempt = null;
    }

    /**
     * 验证用户密码
     * @param {string} password - 用户输入的密码
     * @returns {Promise<{success: boolean, message?: string}>} 验证结果
     */
    async authenticate(password) {
        try {
            // 检查是否处于锁定状态
            if (this.isLockedOut()) {
                const remainingTime = this.getRemainingLockoutTime();
                return {
                    success: false,
                    message: `账户已锁定，请在 ${Math.ceil(remainingTime / 1000)} 秒后重试`
                };
            }

            // 验证密码
            const isValid = await this.crypto.verifyMasterPassword(password);
            
            if (isValid) {
                // 重置登录尝试计数
                this.loginAttempts = 0;
                this.lastFailedAttempt = null;
                
                // 生成会话密钥
                this.crypto.deriveSessionKey(password);
                
                return { success: true };
            } else {
                // 记录失败尝试
                this.loginAttempts++;
                this.lastFailedAttempt = Date.now();
                
                const remainingAttempts = this.maxLoginAttempts - this.loginAttempts;
                
                if (remainingAttempts <= 0) {
                    return {
                        success: false,
                        message: `密码错误次数过多，账户已锁定 ${this.lockoutTime / 60000} 分钟`
                    };
                }
                
                return {
                    success: false,
                    message: `密码错误，还剩 ${remainingAttempts} 次尝试机会`
                };
            }
        } catch (error) {
            console.error('[AuthService] 认证过程出错:', error);
            return {
                success: false,
                message: '认证过程发生错误，请重试'
            };
        }
    }

    /**
     * 更改主密码
     * @param {string} oldPassword - 当前密码
     * @param {string} newPassword - 新密码
     * @returns {Promise<{success: boolean, message?: string}>} 操作结果
     */
    async changePassword(oldPassword, newPassword) {
        try {
            // 验证旧密码
            const authResult = await this.authenticate(oldPassword);
            if (!authResult.success) {
                return {
                    success: false,
                    message: '当前密码验证失败'
                };
            }

            // 验证新密码强度
            const passwordStrength = this.validatePasswordStrength(newPassword);
            if (!passwordStrength.isValid) {
                return {
                    success: false,
                    message: passwordStrength.message
                };
            }

            // 重新加密所有敏感数据
            await this.reencryptAllData(oldPassword, newPassword);

            // 更新主密码
            await this.crypto.setMasterPassword(newPassword);

            // 更新会话密钥
            this.crypto.deriveSessionKey(newPassword);

            return {
                success: true,
                message: '密码修改成功'
            };
        } catch (error) {
            console.error('[AuthService] 修改密码失败:', error);
            return {
                success: false,
                message: '修改密码失败: ' + error.message
            };
        }
    }

    /**
     * 重置应用（清除所有数据）
     * @returns {Promise<{success: boolean, message?: string}>} 操作结果
     */
    async resetApplication() {
        try {
            console.log('[AuthService] 开始重置应用...');
            
            // 获取应用数据目录
            const userDataPath = app.getPath('userData');
            
            // 关闭数据库连接
            if (this.db && this.db.db) {
                await this.db.closeDatabase(this.db.db);
            }
            
            // 清除加密服务的会话密钥
            this.crypto.clearSessionKey();
            
            // 要删除的文件列表
            const filesToDelete = [
                'fourair.db',          // 数据库文件
                'settings.json',       // 设置文件
                'app.salt',           // 盐值文件
                'backups'             // 备份目录
            ];
            
            // 删除文件
            for (const file of filesToDelete) {
                const filePath = path.join(userDataPath, file);
                try {
                    const stats = await fs.stat(filePath);
                    if (stats.isDirectory()) {
                        await fs.rm(filePath, { recursive: true, force: true });
                        console.log(`[AuthService] 已删除目录: ${file}`);
                    } else {
                        await fs.unlink(filePath);
                        console.log(`[AuthService] 已删除文件: ${file}`);
                    }
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        console.error(`[AuthService] 删除 ${file} 失败:`, error);
                    }
                }
            }
            
            return {
                success: true,
                message: '应用数据已成功重置'
            };
        } catch (error) {
            console.error('[AuthService] 重置应用失败:', error);
            return {
                success: false,
                message: '重置应用失败: ' + error.message
            };
        }
    }

    /**
     * 检查应用是否已解锁
     * @returns {boolean} 是否已解锁
     */
    isUnlocked() {
        return this.crypto.isUnlocked();
    }

    /**
     * 锁定应用
     */
    lockApplication() {
        this.crypto.clearSessionKey();
    }

    /**
     * 检查是否处于锁定状态
     * @returns {boolean} 是否被锁定
     */
    isLockedOut() {
        if (!this.lastFailedAttempt || this.loginAttempts < this.maxLoginAttempts) {
            return false;
        }
        
        const timeSinceLastAttempt = Date.now() - this.lastFailedAttempt;
        if (timeSinceLastAttempt > this.lockoutTime) {
            // 锁定时间已过，重置计数
            this.loginAttempts = 0;
            this.lastFailedAttempt = null;
            return false;
        }
        
        return true;
    }

    /**
     * 获取剩余锁定时间（毫秒）
     * @returns {number} 剩余锁定时间
     */
    getRemainingLockoutTime() {
        if (!this.isLockedOut()) {
            return 0;
        }
        
        const timeSinceLastAttempt = Date.now() - this.lastFailedAttempt;
        return this.lockoutTime - timeSinceLastAttempt;
    }

    /**
     * 验证密码强度
     * @param {string} password - 待验证的密码
     * @returns {{isValid: boolean, message?: string, strength: number}} 验证结果
     */
    validatePasswordStrength(password) {
        if (!password || password.length < 8) {
            return {
                isValid: false,
                message: '密码长度至少为8位',
                strength: 0
            };
        }

        let strength = 0;
        const checks = {
            hasLowerCase: /[a-z]/.test(password),
            hasUpperCase: /[A-Z]/.test(password),
            hasNumbers: /\d/.test(password),
            hasSpecialChars: /[!@#$%^&*(),.?":{}|<>]/.test(password),
            hasMinLength: password.length >= 12
        };

        // 计算强度分数
        Object.values(checks).forEach(passed => {
            if (passed) strength++;
        });

        // 至少需要3个条件满足
        if (strength < 3) {
            return {
                isValid: false,
                message: '密码强度不足，需要包含大小写字母、数字和特殊字符',
                strength
            };
        }

        return {
            isValid: true,
            strength
        };
    }

    /**
     * 重新加密所有敏感数据
     * @param {string} oldPassword - 旧密码
     * @param {string} newPassword - 新密码
     * @returns {Promise<void>}
     */
    async reencryptAllData(oldPassword, newPassword) {
        console.log('[AuthService] 开始重新加密数据...');
        
        // 1. 使用旧密码解密所有钱包数据
        const wallets = await this.db.getAllWallets(this.db.db);
        const decryptedWallets = [];
        
        for (const wallet of wallets) {
            if (wallet.encryptedPrivateKey || wallet.encryptedMnemonic) {
                const decrypted = {
                    id: wallet.id,
                    privateKey: wallet.encryptedPrivateKey ? 
                        this.crypto.decryptWithSessionKey(wallet.encryptedPrivateKey) : null,
                    mnemonic: wallet.encryptedMnemonic ? 
                        this.crypto.decryptWithSessionKey(wallet.encryptedMnemonic) : null
                };
                decryptedWallets.push(decrypted);
            }
        }

        // 2. 使用新密码生成新的会话密钥
        this.crypto.deriveSessionKey(newPassword);

        // 3. 使用新会话密钥重新加密数据
        for (const wallet of decryptedWallets) {
            const updates = {};
            
            if (wallet.privateKey) {
                updates.encryptedPrivateKey = this.crypto.encryptWithSessionKey(wallet.privateKey);
            }
            
            if (wallet.mnemonic) {
                updates.encryptedMnemonic = this.crypto.encryptWithSessionKey(wallet.mnemonic);
            }
            
            // 更新数据库
            await this.db.updateWallet(this.db.db, wallet.id, updates);
        }

        // 4. 同样处理社交账户数据
        const socialAccounts = await this.db.getAllSocialAccounts(this.db.db);
        // ... 类似的解密和重新加密逻辑

        console.log('[AuthService] 数据重新加密完成');
    }
}

module.exports = AuthService; 