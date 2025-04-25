import { showToast } from '../../components/toast.js';
import { showModal, hideModal } from '../../components/modal.js'; // 导入模态框函数, 用于删除确认
// 导入 table 模块中的函数
import { loadAndRenderWallets, getSelectedWalletIds } from './table.js';

let contentAreaCache; // 缓存 contentArea (由 index.js 传入)

/**
 * 初始化操作模块所需的 DOM 元素引用。
 * @param {object} elements - 包含 DOM 元素引用的对象。
 */
export function initActionElements(elements) {
    contentAreaCache = elements.contentAreaCache;
}

/**
 * 处理导入钱包按钮点击事件。
 */
export function handleImportWallets() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json'; // 只接受 JSON 文件
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            let successCount = 0, errorCount = 0; const errors = [];
            const importBtn = contentAreaCache?.querySelector('#import-wallets-btn'); // 从缓存获取按钮
            if (importBtn) importBtn.disabled = true; // 禁用按钮

            try {
                const walletsToImport = JSON.parse(e.target.result);
                if (!Array.isArray(walletsToImport)) { throw new Error("导入文件需为钱包对象数组。 "); }
                
                showToast(`开始导入 ${walletsToImport.length} 个钱包...`, 'info');

                for (const walletData of walletsToImport) {
                    // 基本验证
                    if (!walletData.address) {
                        errors.push(`跳过无效条目 (缺少地址): ${JSON.stringify(walletData).substring(0, 50)}...`); 
                        errorCount++; 
                        continue;
                    }
                    try {
                        // 准备数据，移除前端特定的或不应直接导入的字段
                         walletData.groupId = walletData.groupId ? parseInt(walletData.groupId) : null;
                         const { chain, type, isBackedUp, groupName, ...dataToSave } = walletData;
                         // 确保数据类型正确 (例如 groupId)

                         await window.dbAPI.addWallet(dataToSave);
                         successCount++;
                    } catch (error) {
                        errorCount++;
                        if (error.message?.includes('UNIQUE constraint failed: wallets.address')) {
                            errors.push(`地址 ${walletData.address} 已存在，跳过。 `);
                        } else { 
                            errors.push(`导入 ${walletData.address} 失败: ${error.message}`); 
                            console.error(`导入错误 - 钱包: ${walletData.address}`, error); // Log detailed error
                        }
                    }
                }
                
                let message = `导入完成！成功 ${successCount}，失败 ${errorCount}。 `;
                if (errors.length > 0) { 
                    message += "\n\n错误详情 (部分):\n" + errors.slice(0, 5).join('\n'); 
                    if (errors.length > 5) message += '\n... (更多错误请查看控制台)';
                    console.warn("导入错误:", errors); 
                }
                showToast(message, errorCount > 0 ? 'warning' : 'success', 7000); // 显示更长时间
                await loadAndRenderWallets(); // 导入完成后刷新列表

            } catch (error) { 
                console.error("解析或导入失败:", error); 
                showToast(`导入失败: ${error.message}`, 'error'); 
            } finally {
                if (importBtn) importBtn.disabled = false; // 重新启用按钮
            }
        };
        reader.onerror = (e) => { 
            console.error("读取文件失败:", e); 
            showToast("读取文件错误。 ", 'error'); 
            const importBtn = contentAreaCache?.querySelector('#import-wallets-btn');
             if (importBtn) importBtn.disabled = false;
        };
        reader.readAsText(file);
    });

    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
}

/**
 * 处理导出选中钱包的逻辑。
 */
export async function handleExportWallets() {
     const walletIdsToExport = getSelectedWalletIds(); // 从 table.js 获取选中的 ID
         
     if (walletIdsToExport.length === 0) { 
         showToast("请先选择要导出的钱包！ ", 'warning');
         return; 
     }

    try {
        const walletsToExport = await window.dbAPI.getWalletsByIds(walletIdsToExport);
        if (!walletsToExport || walletsToExport.length === 0) {
            showToast("错误：无法获取选定钱包的数据。 ", 'error'); 
            return;
        }

        // 移除 groupName 等前端字段，只导出数据库字段
        const exportData = walletsToExport.map(({ groupName, ...rest }) => rest);
        const jsonString = JSON.stringify(exportData, null, 2);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const defaultPath = `four-air-wallets-export-${timestamp}.json`;

        showToast('正在准备导出文件...', 'info');
        // 调用主进程保存文件对话框
        const result = await window.dbAPI.saveFile({ defaultPath: defaultPath, content: jsonString });

        if (result.success) {
            showToast(`成功导出 ${walletsToExport.length} 个钱包到 ${result.filePath}`, 'success', 5000);
            // 再次强调安全风险
            showToast(`**重要提示：** 导出的 JSON 文件包含钱包的明文私钥和助记词！请务必妥善保管此文件！`, 'warning', 10000);
        } else if (result.canceled) {
            showToast('导出已取消', 'info');
        } else {
            console.error("导出钱包失败:", result.error);
            showToast(`导出钱包失败: ${result.error || '未知错误'}`, 'error');
        }

    } catch (error) {
        console.error("IPC: 导出钱包时发生意外错误:", error);
        showToast(`导出钱包时发生错误: ${error.message}`, 'error');
    }
}

/**
 * 处理批量删除选中钱包的逻辑。
 */
export async function handleBulkDelete() {
    const ids = getSelectedWalletIds(); // 从 table.js 获取选中的 ID
    const count = ids.length;

    if (count === 0) {
        showToast('请至少选择一个钱包进行删除', 'warning');
        return;
    }

    // 使用自定义模态框确认
    showModal('tpl-confirm-dialog', (modalElement) => {
        const messageElement = modalElement.querySelector('.confirm-message');
        const confirmBtn = modalElement.querySelector('.modal-confirm-btn');
        if (!messageElement || !confirmBtn) { console.error("确认框元素缺失"); hideModal(); return; }

        messageElement.textContent = `确定删除选中的 ${count} 个钱包吗？此操作不可撤销！`;

        const handleConfirmBulkDelete = async () => {
            confirmBtn.removeEventListener('click', handleConfirmBulkDelete); // 防重复
            hideModal(); // 关闭确认框

            // --- 禁用按钮 --- 
            const bulkGenWalletsBtn = contentAreaCache?.querySelector('#bulk-generate-wallets-btn');
            const bulkDeleteBtn = contentAreaCache?.querySelector('#bulk-delete-btn');
            const exportWalletsBtn = contentAreaCache?.querySelector('#export-wallets-btn'); 
            const importWalletsBtn = contentAreaCache?.querySelector('#import-wallets-btn'); 
            if (bulkGenWalletsBtn) bulkGenWalletsBtn.disabled = true;
            if (bulkDeleteBtn) bulkDeleteBtn.disabled = true;
            if (exportWalletsBtn) exportWalletsBtn.disabled = true;
            if (importWalletsBtn) importWalletsBtn.disabled = true;
            // --- -------- ---

            showToast(`正在删除 ${count} 个钱包...`, 'info');
            let timeInterval = null; 
            const startTime = Date.now();

            try {
                console.log(`[${Date.now()}] handleBulkDelete: Calling IPC deleteWalletsByIds for ${ids.length} wallets`);
                
                // 简单的进度提示 (对于长时间操作)
                if (count > 20) { 
                    timeInterval = setInterval(() => { 
                        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
                        showToast(`正在删除钱包 (${elapsedTime}秒)...`, 'info');
                    }, 1000);
                }
                
                const result = await window.dbAPI.deleteWalletsByIds(ids);
                if (timeInterval) clearInterval(timeInterval); 
                
                console.log(`[${Date.now()}] handleBulkDelete: IPC deleteWalletsByIds returned`, result);
                
                if (result && typeof result.deletedCount === 'number') { // 检查返回结构
                    showToast(`成功删除 ${result.deletedCount} 个钱包`, 'success');
                    if (result.errors && result.errors.length > 0) {
                        console.warn('批量删除时出现错误:', result.errors);
                        showToast(`部分删除失败 (${result.errors.length}个)，详情见控制台`, 'warning');
                    }
                    // 刷新表格
                    await loadAndRenderWallets(); 
                } else {
                    // 处理未知的返回或失败
                    console.warn(`[${Date.now()}] handleBulkDelete: IPC deleteWalletsByIds reported failure or unexpected result:`, result);
                    showToast('删除钱包操作失败或未返回有效结果', 'error');
                }
            } catch (error) {
                if (timeInterval) clearInterval(timeInterval);
                console.error(`[${Date.now()}] handleBulkDelete: Error during bulk delete:`, error);
                showToast(`删除钱包时出错: ${error.message}`, 'error');
            } finally {
                // 重新启用按钮
                if (bulkGenWalletsBtn) bulkGenWalletsBtn.disabled = false;
                if (bulkDeleteBtn) bulkDeleteBtn.disabled = false;
                if (exportWalletsBtn) exportWalletsBtn.disabled = false;
                if (importWalletsBtn) importWalletsBtn.disabled = false;
                console.log(`[${Date.now()}] handleBulkDelete: Finished.`);
            }
        };

        confirmBtn.addEventListener('click', handleConfirmBulkDelete);
    });
}

/**
 * 处理单个钱包删除操作（供行内按钮调用）
 * @param {number} walletId 
 * @param {string} walletAddress 
 */
export async function handleSingleDelete(walletId, walletAddress) {
     // 使用自定义模态框进行确认
        showModal('tpl-confirm-dialog', (modalElement) => {
            const messageElement = modalElement.querySelector('.confirm-message');
            const confirmBtn = modalElement.querySelector('.modal-confirm-btn');
            if (!messageElement || !confirmBtn) { console.error("确认框元素缺失"); hideModal(); return; }

            messageElement.textContent = `确定删除钱包 ${walletAddress} 吗？此操作不可撤销。`;

            const handleConfirm = async () => {
                confirmBtn.removeEventListener('click', handleConfirm);
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 删除中...';

                try {
                    const changes = await window.dbAPI.deleteWallet(walletId);
                    if (changes > 0) {
                        showToast(`钱包 ${walletAddress} 已删除`, 'success');
                        hideModal(); 
                        await loadAndRenderWallets(); 
                    } else {
                        showToast(`删除钱包 ${walletAddress} 操作未执行或钱包不存在`, 'warning');
                         hideModal();
                    }
                } catch (error) {
                    showToast(`删除钱包失败: ${error.message}`, 'error');
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = '确认'; 
                    // 不关闭模态框，允许用户取消
                }
            };
            confirmBtn.addEventListener('click', handleConfirm);
        });
} 