import { showModal, hideModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
// Import functions from table.js needed after modal actions
import { loadAndRenderSocialAccounts, loadGroupFiltersForSocial } from './table.js';

// --- Module Variables (Cached Elements) ---
let addAccountBtn = null;
let contentAreaCache = null; // Cache content area if needed for finding elements like bulk delete btn

// --- Initialization ---
/**
 * Initializes the modal module for the social page.
 * Sets up listener for the main "Add Account" button.
 * @param {HTMLElement} contentArea - The main content area.
 */
export function initSocialModals(contentArea) {
    contentAreaCache = contentArea;
    addAccountBtn = contentArea.querySelector('#add-social-account-btn'); // Use a specific ID if possible

    if (addAccountBtn) {
        addAccountBtn.addEventListener('click', () => openSocialAccountModal());
    } else {
        console.warn("Add Social Account button not found for initialization.");
    }
}

// --- Modal Logic ---

/**
 * Opens the Add/Edit Social Account modal.
 * @param {number|null} [accountId=null] - Account ID for edit mode, null for add mode.
 */
export async function openSocialAccountModal(accountId = null) {
    const isEditMode = accountId !== null;
    let accountData = {};

    if (isEditMode) {
        try {
            accountData = await window.dbAPI.getSocialAccountById(accountId);
            if (!accountData) {
                showToast(`错误：找不到 ID 为 ${accountId} 的社交账户。`, 'error');
                return;
            }
        } catch (error) {
            console.error(`IPC: 获取社交账户 ${accountId} 数据失败:`, error);
            showToast(`加载编辑数据失败: ${error.message}`, 'error');
            return;
        }
    }

    showModal('tpl-social-account-form', async (modalElement) => {
        const form = modalElement.querySelector('#social-account-form-actual');
        const groupSelect = modalElement.querySelector('#social-group');
        const saveBtn = modalElement.querySelector('.modal-save-btn');
        const title = modalElement.querySelector('.modal-title');
        const accountIdInput = form.elements['account-id'];
        const newGroupNameInput = modalElement.querySelector('.new-group-name-input');

        if (!form || !groupSelect || !saveBtn || !title || !accountIdInput || !newGroupNameInput) {
            console.error("添加/编辑社交账户模态框缺少必要的元素。.");
            hideModal();
            showToast("模态框加载失败，缺少元素", 'error');
            return;
        }

        // Setup title and form defaults based on mode
        title.textContent = isEditMode ? '编辑社交账户' : '添加社交账户';
        accountIdInput.value = isEditMode ? accountId : '';
        if (isEditMode) {
            form.elements['social-platform'].value = accountData.platform || '';
            form.elements['social-username'].value = accountData.username || '';
            form.elements['social-binding'].value = accountData.binding || '';
            form.elements['social-notes'].value = accountData.notes || '';
            // Group selection is handled after loading groups
        } else {
            form.reset();
            accountIdInput.value = '';
        }

        // Load groups into the dropdown
        let defaultGroupId = null;
        try {
            const groups = await window.dbAPI.getGroups();
            groupSelect.innerHTML = '<option value="">无分组</option>';
            groups.forEach(group => {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name;
                if (group.name === '默认分组') defaultGroupId = group.id;
                if (isEditMode && accountData.groupId === group.id) option.selected = true;
                groupSelect.appendChild(option);
            });
            // Select default group in add mode
            if (!isEditMode && defaultGroupId) {
                const defaultOption = groupSelect.querySelector(`option[value="${defaultGroupId}"]`);
                if (defaultOption) defaultOption.selected = true;
            }
        } catch (error) {
            console.error("加载分组失败:", error);
            showToast("加载分组选项失败", 'error');
            groupSelect.innerHTML = '<option value="">加载失败</option>';
        }

        // New group input handler (Enter key)
        const handleNewGroupEnter = async (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                const newGroupName = newGroupNameInput.value.trim();
                if (!newGroupName) {
                    showToast('请输入新分组名称', 'warning'); return;
                }
                // Check existence (case-insensitive)
                const existingOption = Array.from(groupSelect.options).find(opt => opt.textContent.toLowerCase() === newGroupName.toLowerCase());
                if (existingOption) {
                    showToast(`分组 "${newGroupName}" 已存在`, 'warning');
                    groupSelect.value = existingOption.value;
                    newGroupNameInput.value = '';
                    return;
                }
                // Add the new group
                newGroupNameInput.disabled = true; newGroupNameInput.placeholder = '添加中...';
                try {
                    const newGroupId = await window.dbAPI.addGroup(newGroupName);
                    showToast(`分组 "${newGroupName}" 添加成功`, 'success');
                    const newOption = document.createElement('option');
                    newOption.value = newGroupId; newOption.textContent = newGroupName; newOption.selected = true;
                    groupSelect.appendChild(newOption);
                    newGroupNameInput.value = '';
                    // Refresh the main page's group filter using the imported function
                    await loadGroupFiltersForSocial();
                } catch (error) {
                    console.error("添加新分组失败:", error);
                    showToast(`添加分组失败: ${error.message}`, 'error');
                } finally {
                    newGroupNameInput.disabled = false; newGroupNameInput.placeholder = '或输入新分组名后按回车添加';
                }
            }
        };
        // Ensure listener is not duplicated
        newGroupNameInput.removeEventListener('keydown', handleNewGroupEnter);
        newGroupNameInput.addEventListener('keydown', handleNewGroupEnter);

        // Form submission handler
        const handleSubmit = async (event) => {
            event.preventDefault();
            const formData = new FormData(form);
            const dataToSave = {
                platform: formData.get('social-platform'),
                username: formData.get('social-username').trim(),
                binding: formData.get('social-binding').trim() || null,
                notes: formData.get('social-notes').trim() || null,
                groupId: formData.get('social-group') ? parseInt(formData.get('social-group')) : null,
            };

            if (!dataToSave.platform || !dataToSave.username) {
                showToast("平台和用户名不能为空！", 'warning'); return;
            }

            saveBtn.disabled = true; saveBtn.textContent = '保存中...';

            try {
                const currentAccountId = parseInt(accountIdInput.value);
                if (!isNaN(currentAccountId) && currentAccountId > 0) { // Edit mode
                    await window.dbAPI.updateSocialAccount(currentAccountId, dataToSave);
                    showToast('社交账户更新成功', 'success');
                } else { // Add mode
                    await window.dbAPI.addSocialAccount(dataToSave);
                    showToast('社交账户添加成功', 'success');
                }
                hideModal();
                // Refresh the main table using the imported function
                await loadAndRenderSocialAccounts();
            } catch (error) {
                console.error(`保存社交账户失败 (${isEditMode ? '更新' : '添加'}):`, error);
                showToast(`${isEditMode ? '更新' : '添加'}失败: ${error.message}`, 'error');
            } finally {
                saveBtn.disabled = false; saveBtn.textContent = '保存';
            }
        };
        // Ensure listener is not duplicated
        form.removeEventListener('submit', handleSubmit);
        form.addEventListener('submit', handleSubmit);
    });
} 