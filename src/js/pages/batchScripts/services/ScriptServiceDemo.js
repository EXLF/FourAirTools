/**
 * ScriptService 演示和测试模块
 * 用于验证ScriptService的功能和集成
 */

import { ScriptService } from './ScriptService.js';
import { isFeatureEnabled } from '../infrastructure/types.js';

/**
 * ScriptService集成演示
 */
export async function demoScriptServiceIntegration() {
    console.log('🧪 [ScriptService演示] 开始测试脚本Service集成...');
    
    try {
        // 检查特性开关
        const useScriptService = isFeatureEnabled('fa_use_script_service');
        if (!useScriptService) {
            console.log('⚠️ [ScriptService演示] ScriptService特性未启用，使用演示模式');
        } else {
            console.log('✅ [ScriptService演示] 使用新的ScriptService加载脚本');
        }

        // 基本功能演示
        await demonstrateBasicFeatures();
        
        // 性能对比演示
        await demonstratePerformanceComparison();
        
        // 错误处理演示
        await demonstrateErrorHandling();
        
        // 业务逻辑演示
        await demonstrateBusinessLogic();
        
        console.log('🎉 [ScriptService演示] 集成测试完成！');
        return { success: true, message: 'ScriptService集成演示成功' };
        
    } catch (error) {
        console.error('❌ [ScriptService演示] 集成测试失败:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 演示基本功能
 */
async function demonstrateBasicFeatures() {
    console.log('📋 [演示] 测试基本功能...');
    
    const scriptService = new ScriptService();
    
    // 测试获取脚本列表
    const scriptsResult = await scriptService.getAvailableScripts();
    console.log('📊 [演示] 获取脚本列表:', scriptsResult.success ? '成功' : '失败');
    
    if (scriptsResult.success) {
        const data = scriptsResult.data;
        console.log(`   └─ 脚本数量: ${data.totalCount}`);
        console.log(`   └─ 可用脚本: ${data.availableCount}`);
        console.log(`   └─ 类别数量: ${data.categories.length}`);
        console.log(`   └─ 类别列表: ${data.categories.join(', ')}`);
    }
    
    // 测试脚本同步
    const syncResult = await scriptService.syncScripts();
    console.log('📊 [演示] 脚本同步:', syncResult.success ? '成功' : '失败');
    
    if (syncResult.success) {
        const syncData = syncResult.data;
        console.log(`   └─ 同步摘要: ${syncData.summary}`);
        console.log(`   └─ 删除数量: ${syncData.deletedCount}`);
    }
}

/**
 * 演示性能对比
 */
async function demonstratePerformanceComparison() {
    console.log('⚡ [演示] 测试性能对比...');
    
    const scriptService = new ScriptService();
    
    // 首次调用（缓存miss）
    const start1 = performance.now();
    await scriptService.getAvailableScripts();
    const end1 = performance.now();
    
    console.log(`⏱️ [演示] 首次调用耗时: ${(end1 - start1).toFixed(2)}ms (缓存miss)`);
    
    // 二次调用（缓存hit）
    const start2 = performance.now();
    await scriptService.getAvailableScripts();
    const end2 = performance.now();
    
    console.log(`⏱️ [演示] 二次调用耗时: ${(end2 - start2).toFixed(2)}ms (缓存hit)`);
    
    const improvement = ((end1 - start1) / (end2 - start2)).toFixed(1);
    console.log(`🚀 [演示] 性能提升: ${improvement}x`);
}

/**
 * 演示错误处理
 */
async function demonstrateErrorHandling() {
    console.log('🛡️ [演示] 测试错误处理...');
    
    const scriptService = new ScriptService();
    
    // 测试无效参数
    const invalidResult = await scriptService.getScriptDetails('');
    console.log('📊 [演示] 无效参数处理:', invalidResult.success ? '失败' : '成功');
    if (!invalidResult.success) {
        console.log(`   └─ 错误信息: ${invalidResult.error.message}`);
    }
    
    // 测试执行配置验证
    try {
        const scriptService2 = new ScriptService();
        scriptService2.validateExecutionConfig({
            wallets: [], // 空钱包列表应该抛出错误
            scriptParams: {}
        });
        console.log('📊 [演示] 配置验证: 失败（应该抛出错误）');
    } catch (error) {
        console.log('📊 [演示] 配置验证: 成功');
        console.log(`   └─ 错误信息: ${error.message}`);
    }
}

/**
 * 演示业务逻辑功能
 */
async function demonstrateBusinessLogic() {
    console.log('🏢 [演示] 测试业务逻辑功能...');
    
    const scriptService = new ScriptService();
    
    // 测试带过滤的脚本获取
    const filteredResult = await scriptService.getAvailableScripts({
        sortBy: 'name',
        includeDisabled: false
    });
    
    console.log('📊 [演示] 过滤脚本列表:', filteredResult.success ? '成功' : '失败');
    
    if (filteredResult.success) {
        const scripts = filteredResult.data.scripts;
        if (scripts.length > 0) {
            const firstScript = scripts[0];
            console.log(`   └─ 第一个脚本: ${firstScript.name}`);
            console.log(`   └─ 难度级别: ${firstScript.difficultyLevel}`);
            console.log(`   └─ 推荐状态: ${firstScript.isRecommended ? '是' : '否'}`);
            console.log(`   └─ 标签: ${firstScript.tags.join(', ')}`);
        }
    }
    
    // 测试搜索功能
    const searchResult = await scriptService.getAvailableScripts({
        searchQuery: 'test',
        sortBy: 'popularity'
    });
    
    console.log('📊 [演示] 搜索功能:', searchResult.success ? '成功' : '失败');
    if (searchResult.success) {
        console.log(`   └─ 搜索结果数量: ${searchResult.data.totalCount}`);
    }
}

/**
 * 在refreshScripts功能中试点使用ScriptService
 */
export async function handleRefreshScriptsWithService() {
    console.log('🔄 [ScriptService试点] 使用ScriptService处理脚本刷新...');
    
    try {
        const scriptService = new ScriptService();
        
        // 使用Service层进行脚本同步
        const result = await scriptService.syncScripts();
        
        if (result.success) {
            const syncData = result.data;
            console.log(`✅ [ScriptService试点] 同步成功: ${syncData.summary}`);
            
            // 显示友好的用户反馈
            if (syncData.deletedCount > 0) {
                showUserNotification(`已清理 ${syncData.deletedCount} 个无效脚本`, 'success');
            } else {
                showUserNotification('脚本列表已是最新状态', 'info');
            }
            
            return { success: true, syncData };
        } else {
            throw new Error(result.error.message);
        }
        
    } catch (error) {
        console.error('❌ [ScriptService试点] 同步失败:', error);
        showUserNotification(`脚本同步失败: ${error.message}`, 'error');
        
        // 返回失败信息，调用方可以决定是否回退到原始方法
        return { success: false, error: error.message };
    }
}

/**
 * 在脚本列表加载中试点使用ScriptService
 */
export async function loadScriptsWithService(options = {}) {
    console.log('📜 [ScriptService试点] 使用ScriptService加载脚本列表...');
    
    try {
        const scriptService = new ScriptService();
        
        // 使用Service层获取脚本
        const result = await scriptService.getAvailableScripts({
            sortBy: options.sortBy || 'name',
            filterCategory: options.category,
            searchQuery: options.search,
            forceRefresh: options.forceRefresh
        });
        
        if (result.success) {
            const data = result.data;
            console.log(`✅ [ScriptService试点] 加载成功: ${data.totalCount} 个脚本`);
            
            return {
                success: true,
                scripts: data.scripts,
                metadata: {
                    totalCount: data.totalCount,
                    availableCount: data.availableCount,
                    categories: data.categories,
                    loadTime: Date.now()
                }
            };
        } else {
            throw new Error(result.error.message);
        }
        
    } catch (error) {
        console.error('❌ [ScriptService试点] 加载失败:', error);
        
        return { success: false, error: error.message };
    }
}

/**
 * 显示用户通知
 */
function showUserNotification(message, type = 'info') {
    // 这里可以集成到现有的通知系统
    console.log(`[通知] ${type.toUpperCase()}: ${message}`);
    
    // 如果有现有的通知组件，可以在这里调用
    if (window.showToast) {
        window.showToast(message, type);
    }
}

/**
 * 全局调试函数：启用ScriptService
 */
window.FA_enableScriptService = function() {
    localStorage.setItem('fa_use_script_service', 'true');
    console.log('✅ [调试] ScriptService已启用');
    console.log('💡 [调试] 刷新页面后生效，或手动调用测试函数');
};

/**
 * 全局调试函数：禁用ScriptService
 */
window.FA_disableScriptService = function() {
    localStorage.setItem('fa_use_script_service', 'false');
    console.log('❌ [调试] ScriptService已禁用');
    console.log('💡 [调试] 刷新页面后生效');
};

/**
 * 全局调试函数：测试ScriptService
 */
window.FA_testScriptService = async function() {
    return await demoScriptServiceIntegration();
};

/**
 * 全局调试函数：测试脚本同步
 */
window.FA_testScriptSync = async function() {
    return await handleRefreshScriptsWithService();
};

/**
 * 全局调试函数：测试脚本加载
 */
window.FA_testScriptLoad = async function(options = {}) {
    return await loadScriptsWithService(options);
};

/**
 * 全局调试函数：获取ScriptService统计
 */
window.FA_getScriptServiceStats = function() {
    try {
        const scriptService = new ScriptService();
        const stats = scriptService.getStats();
        console.table(stats);
        return stats;
    } catch (error) {
        console.error('获取统计信息失败:', error);
        return null;
    }
};

/**
 * 全局调试函数：测试ScriptService版本的脚本加载
 */
window.FA_testScriptLoadV2 = async function(options = {}) {
    console.log('🚀 [第7步测试] 测试 ScriptService V2 版本的脚本加载...');
    
    try {
        // 确保ScriptService特性已启用
        if (!isFeatureEnabled('fa_use_script_service')) {
            console.log('⚠️ [第7步测试] ScriptService特性未启用，正在启用...');
            localStorage.setItem('fa_use_script_service', 'true');
        }
        
        // 检查基础设施是否可用
        if (!window.__FA_Infrastructure || !window.__FA_Infrastructure.scriptService) {
            console.error('❌ [第7步测试] ScriptService基础设施未初始化');
            return { success: false, error: 'ScriptService基础设施未初始化' };
        }
        
        // 测试不同的加载选项
        const testCases = [
            { name: '默认加载', options: {} },
            { name: '按名称排序', options: { sortBy: 'name' } },
            { name: '按类别排序', options: { sortBy: 'category' } },
            { name: '强制刷新', options: { forceRefresh: true } },
            { name: '包含禁用脚本', options: { includeDisabled: true } },
            { name: '搜索测试', options: { searchQuery: 'test' } },
            { name: '金融类别过滤', options: { filterCategory: '金融工具' } }
        ];
        
        const results = [];
        
        for (const testCase of testCases) {
            console.log(`📋 [第7步测试] 测试: ${testCase.name}`);
            const startTime = performance.now();
            
            try {
                const scriptService = window.__FA_Infrastructure.scriptService;
                const result = await scriptService.getAvailableScripts(testCase.options);
                const endTime = performance.now();
                
                if (result.success) {
                    const stats = {
                        name: testCase.name,
                        duration: endTime - startTime,
                        totalScripts: result.data.totalCount || 0,
                        availableScripts: result.data.availableCount || 0,
                        categories: result.data.categories?.length || 0,
                        success: true
                    };
                    
                    results.push(stats);
                    console.log(`   ✅ ${testCase.name}: ${stats.totalScripts}个脚本, ${stats.duration.toFixed(2)}ms`);
                } else {
                    results.push({
                        name: testCase.name,
                        success: false,
                        error: result.error?.message
                    });
                    console.log(`   ❌ ${testCase.name}: 失败 - ${result.error?.message}`);
                }
            } catch (error) {
                results.push({
                    name: testCase.name,
                    success: false,
                    error: error.message
                });
                console.log(`   ❌ ${testCase.name}: 异常 - ${error.message}`);
            }
        }
        
        // 生成测试报告
        const successCount = results.filter(r => r.success).length;
        const totalCount = results.length;
        const avgDuration = results.filter(r => r.success).reduce((sum, r) => sum + r.duration, 0) / successCount;
        
        console.log('\n📊 [第7步测试] 测试报告:');
        console.log(`   - 成功率: ${successCount}/${totalCount} (${(successCount/totalCount*100).toFixed(1)}%)`);
        console.log(`   - 平均响应时间: ${avgDuration.toFixed(2)}ms`);
        console.log(`   - 测试时间: ${new Date().toLocaleTimeString()}`);
        
        // 性能对比测试
        await performanceComparisonTest();
        
        return {
            success: true,
            results,
            summary: {
                successRate: successCount / totalCount,
                avgDuration,
                totalTests: totalCount
            }
        };
        
    } catch (error) {
        console.error('❌ [第7步测试] 测试失败:', error);
        return { success: false, error: error.message };
    }
};

/**
 * 性能对比测试：V1 vs V2
 */
async function performanceComparisonTest() {
    console.log('\n⚡ [性能对比] 开始 V1 vs V2 性能测试...');
    
    try {
        // 测试V2 (ScriptService)
        const startV2 = performance.now();
        const scriptService = window.__FA_Infrastructure.scriptService;
        const resultV2 = await scriptService.getAvailableScripts();
        const endV2 = performance.now();
        const durationV2 = endV2 - startV2;
        
        // 测试V1 (Repository直接调用)
        const startV1 = performance.now();
        const scriptRepo = window.__FA_RepositoryFactory?.getRepository('ScriptRepository');
        const resultV1 = await scriptRepo?.getAllScripts();
        const endV1 = performance.now();
        const durationV1 = endV1 - startV1;
        
        console.log(`⚡ [性能对比] V1 (Repository): ${durationV1.toFixed(2)}ms`);
        console.log(`⚡ [性能对比] V2 (ScriptService): ${durationV2.toFixed(2)}ms`);
        
        if (durationV1 > 0) {
            const improvement = durationV1 / durationV2;
            if (improvement > 1) {
                console.log(`🚀 [性能对比] V2比V1快 ${improvement.toFixed(1)}x`);
            } else {
                console.log(`⚠️ [性能对比] V1比V2快 ${(1/improvement).toFixed(1)}x`);
            }
        }
        
    } catch (error) {
        console.warn('⚠️ [性能对比] 性能测试失败:', error.message);
    }
}

/**
 * 全局调试函数：测试完整的页面加载流程
 */
window.FA_testPageLoadV2 = async function() {
    console.log('📄 [第7步测试] 测试完整页面加载流程...');
    
    try {
        // 检查当前是否在脚本插件页面
        if (!window.__isBatchScriptsPageActive) {
            console.warn('⚠️ [第7步测试] 当前不在脚本插件页面，请先进入脚本插件页面');
            return { success: false, error: '不在脚本插件页面' };
        }
        
        // 查找卡片容器
        const contentArea = document.querySelector('.main-content');
        if (!contentArea) {
            console.error('❌ [第7步测试] 找不到主内容区域');
            return { success: false, error: '找不到主内容区域' };
        }
        
        // 测试加载函数
        console.log('📋 [第7步测试] 调用新版本的 loadAndRenderBatchScriptCards...');
        
        // 动态导入加载函数（如果需要）
        const loadFunction = window.loadAndRenderBatchScriptCards || 
                            window.loadAndRenderBatchScriptCardsV2;
        
        if (!loadFunction) {
            console.error('❌ [第7步测试] 找不到加载函数');
            return { success: false, error: '找不到加载函数' };
        }
        
        const startTime = performance.now();
        const result = await loadFunction(contentArea, {
            sortBy: 'name',
            includeDisabled: false
        });
        const endTime = performance.now();
        
        const duration = endTime - startTime;
        console.log(`✅ [第7步测试] 页面加载完成: ${duration.toFixed(2)}ms`);
        
        // 验证渲染结果
        const cardsContainer = document.querySelector('#batchScriptCardsContainer');
        const scriptCards = cardsContainer?.querySelectorAll('.script-card');
        const cardCount = scriptCards?.length || 0;
        
        console.log(`📊 [第7步测试] 渲染结果: ${cardCount} 个脚本卡片`);
        
        if (result && result.metadata) {
            console.log(`📊 [第7步测试] 元数据: ${result.metadata.source} - ${result.metadata.totalCount}个脚本`);
        }
        
        return {
            success: true,
            duration,
            cardCount,
            metadata: result?.metadata
        };
        
    } catch (error) {
        console.error('❌ [第7步测试] 页面加载测试失败:', error);
        return { success: false, error: error.message };
    }
};

console.log('🧪 [ScriptServiceDemo] 演示模块加载完成');
console.log('💡 [ScriptServiceDemo] 可用的调试命令:');
console.log('   - FA_enableScriptService()   启用ScriptService');
console.log('   - FA_testScriptService()     测试ScriptService功能');
console.log('   - FA_testScriptSync()        测试脚本同步');
console.log('   - FA_testScriptLoad()        测试脚本加载');
console.log('   - FA_testScriptLoadV2()      测试ScriptService版本的脚本加载');
console.log('   - FA_testPageLoadV2()        测试完整的页面加载流程');
console.log('   - FA_getScriptServiceStats() 获取统计信息'); 