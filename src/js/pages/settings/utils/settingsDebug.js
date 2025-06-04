/**
 * 设置模块调试工具
 * 为开发和测试提供全局调试方法
 */

/**
 * 初始化全局调试方法
 * @param {SettingsManager} settingsManager - 设置管理器实例
 * @param {SettingsForm} settingsForm - 设置表单实例
 */
export function initializeSettingsDebug(settingsManager, settingsForm) {
    if (typeof window === 'undefined') return;

    // 设置管理器调试方法
    window.FA_Settings = {
        // 获取当前所有设置
        getAll: () => {
            return settingsManager ? settingsManager.get() : null;
        },

        // 获取单个设置
        get: (key) => {
            return settingsManager ? settingsManager.get(key) : null;
        },

        // 设置单个值
        set: async (key, value) => {
            if (!settingsManager) return false;
            return await settingsManager.set(key, value, true);
        },

        // 批量设置
        setMultiple: async (settings) => {
            if (!settingsManager) return false;
            return await settingsManager.setMultiple(settings, true);
        },

        // 重置设置
        reset: async (keys) => {
            if (!settingsManager) return false;
            return await settingsManager.reset(keys, true);
        },

        // 重置所有设置
        resetAll: async () => {
            if (!settingsManager) return false;
            return await settingsManager.resetAll();
        },

        // 导出设置
        export: () => {
            return settingsManager ? settingsManager.export() : null;
        },

        // 导入设置
        import: async (data) => {
            if (!settingsManager) return false;
            return await settingsManager.import(data);
        },

        // 获取设置架构
        getSchema: () => {
            return settingsManager ? settingsManager.getSchema().getAllDefinitions() : null;
        },

        // 验证设置
        validate: (key, value) => {
            if (!settingsManager) return null;
            return settingsManager.getValidator().validateSetting(key, value);
        },

        // 获取默认值
        getDefaults: () => {
            return settingsManager ? settingsManager.getSchema().getDefaultValues() : null;
        },

        // 强制保存
        save: async () => {
            if (!settingsManager) return false;
            return await settingsManager.save();
        },

        // 检查是否有未保存的更改
        isDirty: () => {
            return settingsManager ? settingsManager.isDirtyState() : false;
        },

        // 重新渲染UI
        refresh: () => {
            if (settingsForm) {
                settingsForm.render();
                return true;
            }
            return false;
        },

        // 获取管理器实例（高级调试用）
        getManager: () => settingsManager,
        getForm: () => settingsForm
    };

    // 设置快捷调试方法
    window.FA_SettingsDebug = {
        // 快速测试设置变更
        testSettingChange: async (key, value) => {
            console.log(`[Debug] 测试设置变更: ${key} = ${value}`);
            const oldValue = window.FA_Settings.get(key);
            const result = await window.FA_Settings.set(key, value);
            console.log(`[Debug] 变更结果:`, {
                success: result,
                oldValue,
                newValue: window.FA_Settings.get(key)
            });
            return result;
        },

        // 模拟设置导入
        testImport: async (testData = null) => {
            const data = testData || {
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                settings: {
                    theme: 'dark',
                    language: 'en-US',
                    notifications: false
                }
            };
            console.log('[Debug] 测试设置导入:', data);
            return await window.FA_Settings.import(data);
        },

        // 测试验证功能
        testValidation: () => {
            const tests = [
                { key: 'connectionTimeout', value: 5, expected: true },
                { key: 'connectionTimeout', value: 0, expected: false },
                { key: 'connectionTimeout', value: 500, expected: false },
                { key: 'rpcUrl', value: 'https://eth.example.com', expected: true },
                { key: 'rpcUrl', value: 'invalid-url', expected: false },
                { key: 'language', value: 'zh-CN', expected: true },
                { key: 'language', value: 'invalid-lang', expected: false }
            ];

            console.log('[Debug] 开始验证测试...');
            tests.forEach(test => {
                const result = window.FA_Settings.validate(test.key, test.value);
                const passed = result.valid === test.expected;
                console.log(`[Debug] ${passed ? '✅' : '❌'} ${test.key}=${test.value}:`, result);
            });
        },

        // 测试主题切换
        testThemeSwitch: async () => {
            const themes = ['light', 'dark', 'auto'];
            console.log('[Debug] 测试主题切换...');
            
            for (const theme of themes) {
                console.log(`[Debug] 切换到主题: ${theme}`);
                await window.FA_Settings.set('theme', theme);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            console.log('[Debug] 主题切换测试完成');
        },

        // 性能测试
        performanceTest: async () => {
            console.log('[Debug] 开始性能测试...');
            
            const startTime = performance.now();
            
            // 测试批量设置
            await window.FA_Settings.setMultiple({
                theme: 'light',
                language: 'zh-CN',
                notifications: true,
                autoStart: false
            });
            
            const batchTime = performance.now();
            console.log(`[Debug] 批量设置耗时: ${(batchTime - startTime).toFixed(2)}ms`);
            
            // 测试单个设置
            const singleStartTime = performance.now();
            await window.FA_Settings.set('theme', 'dark');
            const singleTime = performance.now();
            console.log(`[Debug] 单个设置耗时: ${(singleTime - singleStartTime).toFixed(2)}ms`);
            
            // 测试导出导入
            const exportStartTime = performance.now();
            const exported = window.FA_Settings.export();
            const exportTime = performance.now();
            
            const importStartTime = performance.now();
            await window.FA_Settings.import(exported);
            const importTime = performance.now();
            
            console.log(`[Debug] 导出耗时: ${(exportTime - exportStartTime).toFixed(2)}ms`);
            console.log(`[Debug] 导入耗时: ${(importTime - importStartTime).toFixed(2)}ms`);
            
            console.log('[Debug] 性能测试完成');
        },

        // 显示当前状态
        showStatus: () => {
            console.log('[Debug] 设置模块状态:');
            console.log('  - 管理器实例:', !!settingsManager);
            console.log('  - 表单实例:', !!settingsForm);
            console.log('  - 当前设置:', window.FA_Settings.getAll());
            console.log('  - 是否有未保存更改:', window.FA_Settings.isDirty());
            console.log('  - 默认值:', window.FA_Settings.getDefaults());
        }
    };

    console.log('[SettingsDebug] 全局调试方法已初始化');
    console.log('可用方法:');
    console.log('  - FA_Settings: 设置操作方法');
    console.log('  - FA_SettingsDebug: 调试和测试方法');
} 