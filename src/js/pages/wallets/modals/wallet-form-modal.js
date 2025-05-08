import { showModal, hideModal } from '../../../components/modal.js';
import { showToast } from '../../../components/toast.js';
import { loadAndRenderWallets } from '../table.js';

/**
 * 打开钱包添加/编辑模态框。
 * @param {number} [walletId=null] - 如果提供 ID，则为编辑模式；否则为添加模式。
 */
export async function openWalletModal(walletId = null) {
    const isEditMode = walletId !== null;
    let walletData = {};

    if (isEditMode) {
        try {
            walletData = await window.dbAPI.getWalletById(walletId);
            if (!walletData) {
                showToast(`错误：找不到 ID 为 ${walletId} 的钱包。`, 'error');
                return;
            }
        } catch (error) {
            console.error(`IPC: 获取钱包 ${walletId} 数据失败:`, error);
            showToast(`加载编辑数据失败: ${error.message}`, 'error');
            return;
        }
    }

    showModal('tpl-wallet-form', async (modalElement) => {
        const modalBox = modalElement.querySelector('.modal-box'); 
        const form = modalBox.querySelector('form');        
        const title = modalBox.querySelector('.modal-title'); 
        const saveBtn = modalBox.querySelector('.modal-save-btn'); 
        const groupSelect = modalBox.querySelector('#wallet-group'); 
        const notesTextarea = modalBox.querySelector('#wallet-notes');

        if (!modalBox || !form || !title || !saveBtn || !groupSelect || !notesTextarea) { 
             console.error("钱包表单模态框错误: 缺少必要的元素 (modal-box, form, title, saveBtn, groupSelect, notesTextarea)。"); 
             hideModal(); 
             return; 
         }

        if (isEditMode) {
            title.textContent = `编辑钱包 (ID: ${walletId})`;
            form.elements['wallet-id'].value = walletId;
            notesTextarea.value = walletData.notes || '';
            try {
                const groups = await window.dbAPI.getGroups();
                groupSelect.innerHTML = '<option value="">无分组</option>';
                groups.forEach(group => {
                    const option = document.createElement('option');
                    option.value = group.id;
                    option.textContent = group.name;
                    if (walletData.groupId === group.id) { 
                        option.selected = true;
                    }
                    groupSelect.appendChild(option);
                });
            } catch (error) {
                console.error("IPC: 填充分组下拉菜单失败:", error);
            }
        } else {
            // 添加模式逻辑保留，但实际上此表单不再用于添加
            title.textContent = '添加新钱包'; // 可能需要更改或移除此表单
            form.reset();
            form.elements['wallet-id'].value = ''; 
            try {
                const groups = await window.dbAPI.getGroups();
                groupSelect.innerHTML = '<option value="">无分组</option>';
                groups.forEach(group => {
                    const option = document.createElement('option');
                    option.value = group.id;
                    option.textContent = group.name;
                    groupSelect.appendChild(option);
                });
            } catch (error) {
                console.error("IPC: 填充分组下拉菜单失败:", error);
            }
        }

        const handleSubmit = async (event) => {
            event.preventDefault();
            saveBtn.disabled = true;
            saveBtn.textContent = '保存中...';

            const formData = new FormData(form);
            let dataToSave = {};

            if (isEditMode) {
                dataToSave = {
                    notes: formData.get('wallet-notes').trim() || null,
                    groupId: formData.get('wallet-group') ? parseInt(formData.get('wallet-group')) : null,
                };
            } else {
                console.warn("尝试使用仅编辑的表单进行添加操作！");
                // 如果需要添加功能，需要从另一个模板获取全部数据
                showToast('错误：添加功能未在此处实现。请使用其他方式添加钱包。 ', 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = '保存';
                return;
            }

            try {
                if (isEditMode) {
                    console.log(`[${Date.now()}] handleSubmit: Updating wallet ${walletId} with data:`, dataToSave);
                    const changes = await window.dbAPI.updateWallet(walletId, dataToSave);
                    console.log(`IPC: 更新钱包 ${walletId} 结果: ${changes} 行受影响`);
                    if (changes > 0) {
                        showToast('钱包更新成功！', 'success');
                    } else {
                        showToast('未检测到更改', 'info');
                    }
                } else {
                    showToast('错误：此表单仅用于编辑。 ', 'error'); 
                }
                 hideModal();
                 await loadAndRenderWallets(); // 刷新列表
            } catch (error) {
                 console.error("IPC: 保存钱包失败:", error);
                 showToast(`保存钱包失败: ${error.message}`, 'error');
                 saveBtn.disabled = false;
                 saveBtn.textContent = '保存';
            }
        };

        // 确保移除旧的监听器
        form.removeEventListener('submit', handleSubmit);
        form.addEventListener('submit', handleSubmit);
    });
} 