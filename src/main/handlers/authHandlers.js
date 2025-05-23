/**
 * @fileoverview 认证IPC处理器 - 使用AuthService处理认证相关请求
 * @module handlers/authHandlers
 */

const { ipcMain } = require('electron');
const AuthService = require('../services/AuthService');
const { AppError, ErrorCodes } = require('../../shared/errors/AppError');

/**
 * 设置认证相关的IPC处理器
 * @param {Object} dependencies - 依赖项
 * @param {Object} dependencies.cryptoService - 加密服务
 * @param {Object} dependencies.db - 数据库实例
 * @param {BrowserWindow} dependencies.mainWindow - 主窗口
 */
function setupAuthHandlers({ cryptoService, db, mainWindow }) {
    // 创建认证服务实例
    const authService = new AuthService(cryptoService, db);
    
    /**
     * 验证主密码
     */
    ipcMain.handle('auth:verifyPassword', async (event, password) => {
        try {
            console.log('[AuthHandler] 验证密码请求');
            
            const result = await authService.authenticate(password);
            
            if (result.success) {
                // 通知渲染进程应用已解锁
                mainWindow.webContents.send('app-unlocked', { unlocked: true });
                
                return {
                    success: true,
                    message: '解锁成功'
                };
            } else {
                return {
                    success: false,
                    message: result.message || '密码错误'
                };
            }
        } catch (error) {
            console.error('[AuthHandler] 验证密码失败:', error);
            throw new AppError(
                '验证密码失败',
                ErrorCodes.AUTH_FAILED,
                { originalError: error.message }
            );
        }
    });
    
    /**
     * 设置主密码（首次使用）
     */
    ipcMain.handle('auth:setPassword', async (event, password) => {
        try {
            console.log('[AuthHandler] 设置主密码请求');
            
            // 验证密码强度
            const strength = authService.validatePasswordStrength(password);
            if (!strength.isValid) {
                return {
                    success: false,
                    message: strength.message
                };
            }
            
            // 设置密码
            await cryptoService.setMasterPassword(password);
            cryptoService.deriveSessionKey(password);
            
            // 通知渲染进程
            mainWindow.webContents.send('app-unlocked', { unlocked: true });
            
            return {
                success: true,
                message: '密码设置成功'
            };
        } catch (error) {
            console.error('[AuthHandler] 设置密码失败:', error);
            throw new AppError(
                '设置密码失败',
                ErrorCodes.SYSTEM_ERROR,
                { originalError: error.message }
            );
        }
    });
    
    /**
     * 更改主密码
     */
    ipcMain.handle('auth:changePassword', async (event, { oldPassword, newPassword }) => {
        try {
            console.log('[AuthHandler] 更改密码请求');
            
            const result = await authService.changePassword(oldPassword, newPassword);
            
            return result;
        } catch (error) {
            console.error('[AuthHandler] 更改密码失败:', error);
            throw new AppError(
                '更改密码失败',
                ErrorCodes.AUTH_FAILED,
                { originalError: error.message }
            );
        }
    });
    
    /**
     * 检查应用是否已解锁
     */
    ipcMain.handle('auth:checkLockStatus', async () => {
        try {
            const isUnlocked = authService.isUnlocked();
            
            return {
                unlocked: isUnlocked
            };
        } catch (error) {
            console.error('[AuthHandler] 检查锁定状态失败:', error);
            return {
                unlocked: false
            };
        }
    });
    
    /**
     * 锁定应用
     */
    ipcMain.handle('auth:lockApp', async () => {
        try {
            console.log('[AuthHandler] 锁定应用请求');
            
            authService.lockApplication();
            
            // 通知渲染进程
            mainWindow.webContents.send('app-locked');
            
            return {
                success: true,
                message: '应用已锁定'
            };
        } catch (error) {
            console.error('[AuthHandler] 锁定应用失败:', error);
            throw new AppError(
                '锁定应用失败',
                ErrorCodes.SYSTEM_ERROR,
                { originalError: error.message }
            );
        }
    });
    
    /**
     * 重置应用
     */
    ipcMain.handle('auth:resetApplication', async () => {
        try {
            console.log('[AuthHandler] 重置应用请求');
            
            const result = await authService.resetApplication();
            
            if (result.success) {
                // 应用已重置，需要重启
                return {
                    success: true,
                    message: result.message,
                    needsRestart: true
                };
            } else {
                return result;
            }
        } catch (error) {
            console.error('[AuthHandler] 重置应用失败:', error);
            throw new AppError(
                '重置应用失败',
                ErrorCodes.SYSTEM_ERROR,
                { originalError: error.message }
            );
        }
    });
    
    /**
     * 检查是否需要设置密码
     */
    ipcMain.handle('auth:needsSetup', async () => {
        try {
            const hasPassword = await cryptoService.hasMasterPassword();
            
            return {
                needsSetup: !hasPassword
            };
        } catch (error) {
            console.error('[AuthHandler] 检查密码设置状态失败:', error);
            return {
                needsSetup: true
            };
        }
    });
    
    console.log('[AuthHandler] 认证处理器已设置');
}

module.exports = setupAuthHandlers; 