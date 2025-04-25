import { showModal, hideModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
// 导入 table 模块的函数，用于刷新列表和获取选中项
import { loadAndRenderSocialAccounts, getSelectedSocialAccountIds } from './table.js'; // 恢复导入
// 导入 modals 模块的函数，用于编辑
import { openSocialAccountModal } from './modals.js';

let tableBody = null; // 缓存表格体 (由 index.js 传入)
let contentAreaCache = null; // 缓存 contentArea

/**
 * 初始化操作模块所需的 DOM 元素引用。
 * @param {object} elements - 包含 DOM 元素引用的对象。
 */
export function initActionElements(elements) {
    tableBody = elements.tableBody; // 需要 tableBody 来获取行信息
    contentAreaCache = elements.contentAreaCache;
}

/**
 * 处理社交账户表格行内的操作按钮点击事件。
 * @param {'edit' | 'delete'} action - 操作类型。
 * @param {number} accountId - 社交账户的 ID。
 */
export async function handleSocialAccountAction(action, accountId) {
    if (!tableBody) { console.error("操作模块未初始化表格体引用"); return; }
    console.log(`处理操作 "${action}" on 社交账户 ID: ${accountId}`);

    if (action === 'delete') {
        // 获取账户信息用于确认提示
        const accountRow = tableBody.querySelector(`tr[data-account-id="${accountId}"]`);
        const platform = accountRow?.cells[1]?.textContent?.trim() || '未知平台';
        const username = accountRow?.cells[2]?.textContent?.trim() || `ID: ${accountId}`;

        showModal('tpl-confirm-dialog', (modalElement) => {
            const messageElement = modalElement.querySelector('.confirm-message');
            const confirmBtn = modalElement.querySelector('.modal-confirm-btn');
            if (!messageElement || !confirmBtn) { console.error("确认模态框缺少元素"); hideModal(); return; }

            messageElement.innerHTML = `确定删除 ${platform} 账户 "<b>${username}</b>" 吗？`;

            const handleConfirmDelete = async () => {
                confirmBtn.removeEventListener('click', handleConfirmDelete);
                confirmBtn.disabled = true; confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 删除中...';
                try {
                    const changes = await window.dbAPI.deleteSocialAccount(accountId);
                    showToast(changes > 0 ? `账户 "${username}" 已删除` : `删除账户 "${username}" 操作未执行`, changes > 0 ? 'success' : 'warning');
                    hideModal();
                    if (changes > 0) await loadAndRenderSocialAccounts(); // 恢复刷新调用
                } catch (error) {
                    console.error(`删除账户 ID ${accountId} 失败:`, error);
                    showToast(`删除失败: ${error.message}`, 'error');
                    confirmBtn.disabled = false; confirmBtn.textContent = '确认';
                }
            };
            // 确保只添加一次监听器
            confirmBtn.removeEventListener('click', handleConfirmDelete);
            confirmBtn.addEventListener('click', handleConfirmDelete);
        });

    } else if (action === 'edit') {
        // 调用 modals 模块打开编辑模态框
        openSocialAccountModal(accountId);
    }
}

/**
 * 处理批量删除选中社交账户的逻辑 (如果需要)。
 */
export async function handleBulkDeleteSocialAccounts() {
    const ids = getSelectedSocialAccountIds(); // 使用导入的函数
    // 移除临时实现
    // if (!tableBody) { console.error("批量删除时表格体未初始化"); return; }
    // const selectedCheckboxes = tableBody.querySelectorAll('input[type="checkbox"]:checked:not(.select-all-checkbox)');
    // const ids = Array.from(selectedCheckboxes).map(cb => {
    //     const row = cb.closest('tr');
    //     return row ? parseInt(row.dataset.accountId, 10) : null;
    // }).filter(id => id !== null);

    const count = ids.length;

    if (count === 0) {
        showToast('请至少选择一个社交账户进行删除', 'warning');
        return;
    }

    showModal('tpl-confirm-dialog', (modalElement) => {
        const messageElement = modalElement.querySelector('.confirm-message');
        const confirmBtn = modalElement.querySelector('.modal-confirm-btn');
        if (!messageElement || !confirmBtn) { console.error("确认框元素缺失"); hideModal(); return; }

        messageElement.textContent = `确定删除选中的 ${count} 个社交账户吗？此操作不可撤销！`;

        const handleConfirmBulkDelete = async () => {
            confirmBtn.removeEventListener('click', handleConfirmBulkDelete);
            hideModal();

            // --- 禁用相关按钮 (如果模板中有的话) ---
            const bulkDeleteBtn = contentAreaCache?.querySelector('#bulk-delete-social-btn'); // 假设有这个按钮
             if (bulkDeleteBtn) bulkDeleteBtn.disabled = true;
            // --- -------------------------- ---

            showToast(`正在删除 ${count} 个社交账户...`, 'info');
            const startTime = Date.now();
            let timeInterval = null;

            try {
                 if (count > 20) {
                    timeInterval = setInterval(() => {
                        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
                        showToast(`正在删除账户 (${elapsedTime}秒)...`, 'info');
                    }, 1000);
                 }

                const result = await window.dbAPI.deleteSocialAccountsByIds(ids);
                if (timeInterval) clearInterval(timeInterval);

                if (result && typeof result.deletedCount === 'number') {
                    showToast(`成功删除 ${result.deletedCount} 个账户`, 'success');
                    if (result.errors?.length > 0) {
                        console.warn('批量删除社交账户时出现错误:', result.errors);
                        showToast(`部分删除失败 (${result.errors.length}个)，详情见控制台`, 'warning');
                    }
                    await loadAndRenderSocialAccounts(); // 恢复刷新调用
                } else {
                     console.warn(`批量删除社交账户失败或返回结果异常:`, result);
                     showToast('批量删除操作失败', 'error');
                }
            } catch (error) {
                if (timeInterval) clearInterval(timeInterval);
                console.error(`批量删除社交账户时出错:`, error);
                showToast(`批量删除时出错: ${error.message}`, 'error');
            } finally {
                 if (bulkDeleteBtn) bulkDeleteBtn.disabled = false;
            }
        };
        confirmBtn.removeEventListener('click', handleConfirmBulkDelete);
        confirmBtn.addEventListener('click', handleConfirmBulkDelete);
    });
} 