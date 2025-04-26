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
            const importBtn = contentAreaCache?.querySelector('#import-wallets-btn');
            if (importBtn) importBtn.disabled = true;

            try {
                const walletsToImport = JSON.parse(e.target.result);
                if (!Array.isArray(walletsToImport)) { throw new Error("导入文件需为钱包对象数组。 "); }
                
                showToast(`开始导入 ${walletsToImport.length} 个钱包...`, 'info');

                for (const walletData of walletsToImport) {
                    if (!walletData.address) {
                        errors.push(`跳过无效条目 (缺少地址): ${JSON.stringify(walletData).substring(0, 50)}...`); 
                        errorCount++; 
                        continue;
                    }

                    let encryptedPk = null;
                    let encryptedMn = null;
                    let encryptionFailed = false;

                    try {
                        // *** 新增：在保存前加密私钥（如果存在） ***
                        if (walletData.privateKey && typeof walletData.privateKey === 'string') {
                            console.log(`[Import] Encrypting private key for ${walletData.address}...`);
                            encryptedPk = await window.electron.ipcRenderer.invoke('app:encryptData', walletData.privateKey);
                             if (!encryptedPk) throw new Error('加密私钥返回空值'); // 增加检查
                        }
                        // *** 新增：在保存前加密助记词（如果存在） ***
                        if (walletData.mnemonic && typeof walletData.mnemonic === 'string') {
                            console.log(`[Import] Encrypting mnemonic for ${walletData.address}...`);
                            encryptedMn = await window.electron.ipcRenderer.invoke('app:encryptData', walletData.mnemonic);
                             if (!encryptedMn) throw new Error('加密助记词返回空值'); // 增加检查
                        }
                    } catch (encError) {
                        console.error(`[Import] 加密导入钱包 ${walletData.address} 的数据失败:`, encError);
                        errors.push(`加密 ${walletData.address} 失败 (${encError.message})，跳过。`);
                        errorCount++;
                        encryptionFailed = true; 
                    }

                    if (encryptionFailed) continue; // 如果加密失败，跳过这个钱包的添加

                    try {
                         // 准备数据，确保使用加密后的值和正确的字段名
                         const dataToSave = {
                             address: walletData.address,
                             name: walletData.name || null,
                             notes: walletData.notes || null,
                             groupId: walletData.groupId ? parseInt(walletData.groupId) : null,
                             encryptedPrivateKey: encryptedPk, // 使用加密后的私钥
                             mnemonic: encryptedMn,           // 使用加密后的助记词
                             derivationPath: walletData.derivationPath || null
                             // 可以选择性地处理 createdAt/updatedAt，通常不需要导入
                         };

                         // 从 dataToSave 中移除原始的明文私钥（如果存在于 walletData 中）
                         // delete dataToSave.privateKey; // 实际上我们没有把它加进去

                         await window.dbAPI.addWallet(dataToSave);
                         successCount++;
                    } catch (error) {
                        errorCount++;
                        if (error.message?.includes('UNIQUE constraint failed: wallets.address')) {
                            errors.push(`地址 ${walletData.address} 已存在，跳过。 `);
                        } else { 
                            errors.push(`导入 ${walletData.address} 失败: ${error.message}`); 
                            console.error(`导入错误 - 钱包: ${walletData.address}`, error);
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
                if (importBtn) importBtn.disabled = false;
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
 * 处理导出选中钱包的逻辑 (使用自定义确认模态框)。
 */
export async function handleExportWallets() {
    const selectedIds = getSelectedWalletIds();
         
    if (selectedIds.length === 0) { 
        showToast("请先选择要导出的钱包！", 'warning');
        return; 
    }

    const exportBtn = contentAreaCache?.querySelector('#export-wallets-btn');
    if (exportBtn) exportBtn.disabled = true;
    showToast('正在准备导出...', 'info');

    try {
        // 第一步：调用后端检查解锁状态并请求确认
        const checkResult = await window.electron.ipcRenderer.invoke('app:exportWallets', selectedIds);

        if (checkResult && checkResult.needsConfirmation) {
            // 需要前端显示确认模态框
            showModal('tpl-confirm-dialog', (modalElement) => {
                const messageElement = modalElement.querySelector('.confirm-message');
                const confirmBtn = modalElement.querySelector('.modal-confirm-btn');
                const cancelBtn = modalElement.querySelector('.modal-cancel-btn'); // 获取取消按钮

                if (!messageElement || !confirmBtn || !cancelBtn) {
                    console.error("确认框元素缺失"); 
                    hideModal(); 
                    if (exportBtn) exportBtn.disabled = false;
                    showToast('显示确认框时出错', 'error');
                    return; 
                }

                // 设置确认信息和按钮文本
                 modalElement.querySelector('.modal-title').textContent = '安全风险警告'; // 设置标题
                messageElement.innerHTML = `
                    <strong style="color: #dc3545;"><i class="fas fa-exclamation-triangle"></i> 确认导出明文密钥?</strong><br><br>
                    这将导出包含 **未加密** 的私钥和助记词的 JSON 文件！<br>
                    任何获取此文件的人都可以 **完全控制** 您的钱包。<br><br>
                    请务必妥善保管导出的文件，并在使用后 **立即安全删除**。
                    强烈建议不要在不安全的环境中执行此操作。
                `;
                confirmBtn.textContent = '确认导出明文';
                confirmBtn.classList.add('btn-danger'); // 确认按钮用红色
                cancelBtn.textContent = '取消';

                // 处理确认按钮点击
                const handleConfirmExport = async () => {
                    confirmBtn.removeEventListener('click', handleConfirmExport);
                    cancelBtn.removeEventListener('click', hideModal); // 移除取消监听
                    confirmBtn.disabled = true;
                    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 导出中...';
                    hideModal(); // 可以先关掉确认框
                    showToast('正在执行导出操作...', 'info');

                    try {
                        // 第二步：调用后端执行实际的导出操作
                        const exportResult = await window.electron.ipcRenderer.invoke('app:performPlaintextExport', selectedIds);
                        if (exportResult.success) {
                            showToast(`成功导出 ${selectedIds.length} 个钱包到 ${exportResult.filePath}`, 'success', 5000);
                        } else if (exportResult.canceled) {
                            showToast('导出已取消', 'info');
                        } else {
                            console.error("导出钱包失败 (来自主进程 - perform):", exportResult.error);
                            showToast(`导出钱包失败: ${exportResult.error || '未知错误'}`, 'error');
                        }
                    } catch (performError) {
                        console.error("调用执行导出功能时出错:", performError);
                        showToast(`导出钱包时发生错误: ${performError.message}`, 'error');
                    } finally {
                         if (exportBtn) exportBtn.disabled = false; // 无论成功失败都启用按钮
                    }
                };
                confirmBtn.addEventListener('click', handleConfirmExport);

                // 取消按钮只需关闭模态框
                cancelBtn.addEventListener('click', () => { if (exportBtn) exportBtn.disabled = false; hideModal(); });
            });
        } else {
            // 如果 checkResult 返回的不是 needsConfirmation，说明可能有错误
            // 或者主进程逻辑有变，这里直接抛出错误或显示提示
            console.error('请求导出确认失败，未收到预期响应:', checkResult);
            throw new Error(checkResult?.error || '请求导出确认时发生未知错误');
        }

    } catch (error) {
        // 处理第一步 invoke 抛出的错误 (例如应用锁定)
        console.error("请求导出确认时出错:", error);
        showToast(`导出准备失败: ${error.message}`, 'error');
        if (exportBtn) exportBtn.disabled = false;
    }
    // 注意：finally 块移到了确认回调内部，因为按钮需要在异步操作完成后才启用
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