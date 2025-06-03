/**
 * WalletRepository集成演示
 * 展示如何在现有功能中使用新的Repository
 */

import { FeatureFlags, isFeatureEnabled } from '../infrastructure/types.js';

/**
 * 演示如何在钱包加载功能中集成WalletRepository
 * @param {Object} repositoryFactory - Repository工厂实例
 * @returns {Promise<Object>} 加载结果
 */
export async function demoWalletRepositoryIntegration(repositoryFactory) {
    console.log('🧪 [WalletRepository演示] 开始测试钱包Repository集成...');
    
    const useWalletRepository = isFeatureEnabled(FeatureFlags.USE_WALLET_REPOSITORY);
    
    if (!useWalletRepository) {
        console.log('📢 [WalletRepository演示] 功能开关关闭，使用原始方式');
        return await loadWalletsViaOriginalAPI();
    }
    
    try {
        const walletRepo = repositoryFactory.getRepository('WalletRepository');
        if (!walletRepo) {
            throw new Error('WalletRepository实例未找到');
        }
        
        console.log('✅ [WalletRepository演示] 使用新的WalletRepository加载钱包');
        
        // 演示基本功能
        await demonstrateBasicFeatures(walletRepo);
        
        // 演示性能对比
        await demonstratePerformanceComparison(walletRepo);
        
        // 演示错误处理
        await demonstrateErrorHandling(walletRepo);
        
        console.log('🎉 [WalletRepository演示] 集成测试完成！');
        return { success: true, message: 'WalletRepository集成演示成功' };
        
    } catch (error) {
        console.error('❌ [WalletRepository演示] 集成失败:', error);
        console.log('🔄 [WalletRepository演示] 回退到原始API方式');
        
        return await loadWalletsViaOriginalAPI();
    }
}

/**
 * 演示Repository的基本功能
 */
async function demonstrateBasicFeatures(walletRepo) {
    console.log('📋 [演示] 测试基本功能...');
    
    // 1. 获取所有钱包
    const walletsResult = await walletRepo.getAllWallets();
    console.log('📊 [演示] 获取钱包列表:', walletsResult.success ? '成功' : '失败');
    if (walletsResult.success) {
        console.log(`   └─ 钱包数量: ${walletsResult.data?.wallets?.length || 0}`);
        console.log(`   └─ 总数: ${walletsResult.data?.totalCount || 0}`);
    }
    
    // 2. 获取分组列表
    const groupsResult = await walletRepo.getAllGroups();
    console.log('📊 [演示] 获取分组列表:', groupsResult.success ? '成功' : '失败');
    if (groupsResult.success) {
        console.log(`   └─ 分组数量: ${groupsResult.data?.length || 0}`);
    }
    
    // 3. 测试带参数的查询
    const filteredResult = await walletRepo.getAllWallets({
        limit: 5,
        sortBy: 'createdAt',
        sortOrder: 'DESC'
    });
    console.log('📊 [演示] 获取前5个钱包:', filteredResult.success ? '成功' : '失败');
    
    return true;
}

/**
 * 演示性能对比
 */
async function demonstratePerformanceComparison(walletRepo) {
    console.log('⚡ [演示] 测试性能对比...');
    
    // 第一次调用（缓存miss）
    const start1 = performance.now();
    const result1 = await walletRepo.getAllWallets();
    const time1 = performance.now() - start1;
    console.log(`⏱️ [演示] 首次调用耗时: ${time1.toFixed(2)}ms (缓存miss)`);
    
    // 第二次调用（缓存hit）
    const start2 = performance.now();
    const result2 = await walletRepo.getAllWallets();
    const time2 = performance.now() - start2;
    console.log(`⏱️ [演示] 二次调用耗时: ${time2.toFixed(2)}ms (缓存hit)`);
    
    const speedup = time1 / time2;
    console.log(`🚀 [演示] 性能提升: ${speedup.toFixed(1)}x`);
    
    return true;
}

/**
 * 演示错误处理
 */
async function demonstrateErrorHandling(walletRepo) {
    console.log('🛡️ [演示] 测试错误处理...');
    
    try {
        // 测试无效参数
        const invalidResult = await walletRepo.getWalletById(null);
        console.log('📊 [演示] 无效参数处理:', invalidResult.success ? '失败' : '成功');
        if (!invalidResult.success) {
            console.log(`   └─ 错误信息: ${invalidResult.error?.message}`);
        }
        
        // 测试批量获取（包含无效ID）
        const batchResult = await walletRepo.getWalletsByIds([1, 999999, 2]);
        console.log('📊 [演示] 批量获取（含无效ID）:', batchResult.success ? '成功' : '失败');
        if (batchResult.success) {
            const successes = batchResult.data?.filter(r => r.success).length || 0;
            const failures = batchResult.data?.filter(r => !r.success).length || 0;
            console.log(`   └─ 成功: ${successes}, 失败: ${failures}`);
        }
        
    } catch (error) {
        console.error('❌ [演示] 错误处理测试失败:', error);
    }
    
    return true;
}

/**
 * 使用原始API加载钱包（回退方案）
 */
async function loadWalletsViaOriginalAPI() {
    console.log('🔄 [演示] 使用原始API方式加载钱包');
    
    try {
        if (window.dbAPI && typeof window.dbAPI.getWallets === 'function') {
            const result = await window.dbAPI.getWallets();
            console.log('📊 [演示] 原始API加载:', result ? '成功' : '失败');
            
            return {
                success: true,
                data: result,
                message: '使用原始API加载成功',
                source: 'originalAPI'
            };
        } else {
            throw new Error('原始API不可用');
        }
    } catch (error) {
        console.error('❌ [演示] 原始API加载失败:', error);
        return {
            success: false,
            error: error.message,
            message: '原始API加载失败',
            source: 'originalAPI'
        };
    }
}

/**
 * 在WalletGroupManager中集成WalletRepository的演示
 * @param {Object} walletGroupManager - WalletGroupManager实例
 * @param {Object} repositoryFactory - Repository工厂实例
 */
export async function integrateWalletRepositoryIntoGroupManager(walletGroupManager, repositoryFactory) {
    console.log('🔗 [集成演示] 在WalletGroupManager中集成WalletRepository...');
    
    const useWalletRepository = isFeatureEnabled(FeatureFlags.USE_WALLET_REPOSITORY);
    
    if (!useWalletRepository) {
        console.log('📢 [集成演示] 功能开关关闭，保持原有逻辑');
        return;
    }
    
    try {
        const walletRepo = repositoryFactory.getRepository('WalletRepository');
        if (!walletRepo) {
            throw new Error('WalletRepository实例未找到');
        }
        
        // 为WalletGroupManager添加Repository支持
        walletGroupManager.walletRepository = walletRepo;
        walletGroupManager.useRepository = true;
        
        // 扩展loadWallets方法
        const originalLoadWallets = walletGroupManager.loadWallets?.bind(walletGroupManager);
        
        walletGroupManager.loadWallets = async function() {
            if (this.useRepository && this.walletRepository) {
                try {
                    console.log('🔗 [集成演示] 使用WalletRepository加载钱包');
                    const result = await this.walletRepository.getAllWallets();
                    
                    if (result.success && result.data?.wallets) {
                        console.log(`🔗 [集成演示] Repository加载成功: ${result.data.wallets.length} 个钱包`);
                        return result.data.wallets;
                    } else {
                        throw new Error('Repository返回数据格式错误');
                    }
                } catch (error) {
                    console.warn('🔗 [集成演示] Repository失败，回退到原始方法:', error);
                    this.useRepository = false;
                }
            }
            
            // 回退到原始方法
            if (originalLoadWallets) {
                console.log('🔗 [集成演示] 使用原始方法加载钱包');
                return await originalLoadWallets();
            } else {
                console.warn('🔗 [集成演示] 原始loadWallets方法不存在');
                return [];
            }
        };
        
        console.log('✅ [集成演示] WalletGroupManager集成完成');
        
    } catch (error) {
        console.error('❌ [集成演示] WalletGroupManager集成失败:', error);
    }
}

/**
 * 启用WalletRepository的全局调试函数
 */
export function enableWalletRepositoryDebugging() {
    if (typeof window !== 'undefined') {
        // 启用WalletRepository功能
        window.FA_enableWalletRepository = () => {
            localStorage.setItem(FeatureFlags.USE_WALLET_REPOSITORY, 'true');
            console.log('✅ [调试] WalletRepository功能已启用');
            console.log('💡 [调试] 请刷新页面以应用更改');
        };
        
        // 禁用WalletRepository功能
        window.FA_disableWalletRepository = () => {
            localStorage.setItem(FeatureFlags.USE_WALLET_REPOSITORY, 'false');
            console.log('❌ [调试] WalletRepository功能已禁用');
            console.log('💡 [调试] 请刷新页面以应用更改');
        };
        
        // 测试WalletRepository功能
        window.FA_testWalletRepository = async () => {
            const repositoryFactory = window.__FA_RepositoryFactory;
            if (!repositoryFactory) {
                console.error('❌ [调试] RepositoryFactory未找到');
                return false;
            }
            
            return await demoWalletRepositoryIntegration(repositoryFactory);
        };
        
        // 获取WalletRepository统计信息
        window.FA_getWalletRepositoryStats = () => {
            const repositoryFactory = window.__FA_RepositoryFactory;
            if (!repositoryFactory) {
                console.error('❌ [调试] RepositoryFactory未找到');
                return null;
            }
            
            const walletRepo = repositoryFactory.getRepository('WalletRepository');
            return walletRepo ? walletRepo.getExtendedStats() : null;
        };
        
        console.log('🛠️ [调试] WalletRepository调试函数已注册');
        console.log('💡 [调试] 可用函数:');
        console.log('   - window.FA_enableWalletRepository() - 启用钱包Repository');
        console.log('   - window.FA_disableWalletRepository() - 禁用钱包Repository');
        console.log('   - window.FA_testWalletRepository() - 测试钱包Repository');
        console.log('   - window.FA_getWalletRepositoryStats() - 获取统计信息');
    }
} 