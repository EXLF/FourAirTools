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

// Helper function to show/hide platform-specific fields
function updatePlatformFieldsVisibility(modalElement, selectedPlatform) {
    const allPlatformFieldsets = modalElement.querySelectorAll('[class^="platform-fields-"]');
    allPlatformFieldsets.forEach(fieldset => {
        fieldset.style.display = 'none'; // Hide all initially
    });

    if (selectedPlatform) {
        const specificFieldset = modalElement.querySelector(`.platform-fields-${selectedPlatform.toLowerCase()}`);
        if (specificFieldset) {
            specificFieldset.style.display = 'block'; // Show the relevant one
        }
    }
}

/**
 * Opens the Add/Edit Social Account modal.
 * Dynamically adjusts form fields based on the platform.
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
            // IMPORTANT: accountData will contain *encrypted* sensitive fields.
            // We will not display them directly.
        } catch (error) {
            console.error(`IPC: 获取社交账户 ${accountId} 数据失败:`, error);
            showToast(`加载编辑数据失败: ${error.message}`, 'error');
            return;
        }
    }

    showModal('tpl-social-account-form', async (modalElement) => {
        const form = modalElement.querySelector('#social-account-form-actual');
        const platformSelect = modalElement.querySelector('#social-platform');
        const groupSelect = modalElement.querySelector('#social-group');
        const saveBtn = modalElement.querySelector('.modal-save-btn');
        const title = modalElement.querySelector('.modal-title');
        const accountIdInput = form.elements['account-id'];
        const newGroupNameInput = modalElement.querySelector('.new-group-name-input');

        if (!form || !platformSelect || !groupSelect || !saveBtn || !title || !accountIdInput || !newGroupNameInput) {
            console.error("添加/编辑社交账户模态框缺少必要的元素。");
            hideModal();
            showToast("模态框加载失败，缺少元素", 'error');
            return;
        }

        // Setup title and form defaults based on mode
        title.textContent = isEditMode ? '编辑社交账户' : '添加社交账户';
        accountIdInput.value = isEditMode ? accountId : '';

        // Populate common fields / reset form
        if (isEditMode) {
            form.elements['social-platform'].value = accountData.platform || '';
            form.elements['social-identifier'].value = accountData.identifier || ''; // Use identifier
            // DO NOT populate social-binding (removed)
            form.elements['social-notes'].value = accountData.notes || '';
            // DO NOT populate password or other sensitive fields. Leave them blank or with placeholder.
            // Example: Add placeholders in the HTML template or clear them here:
            const sensitiveFields = [
                'social-password', 'social-twitter-2fa', 'social-twitter-email', 'social-twitter-recovery-email',
                'social-discord-password', 'social-discord-token',
                'social-telegram-password', 'social-telegram-login-api'
            ];
             sensitiveFields.forEach(fieldName => {
                if (form.elements[fieldName]) {
                     form.elements[fieldName].value = ''; // Clear on edit load
                     form.elements[fieldName].placeholder = '如需更改，请输入新值';
                 }
             });

            // Group selection is handled after loading groups
        } else {
            form.reset(); // Reset all fields for add mode
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
                if (group.name === '默认分组') defaultGroupId = group.id; // Check for default group by name
                // **Use group_id for comparison**
                if (isEditMode && accountData.group_id === group.id) option.selected = true;
                groupSelect.appendChild(option);
            });
            // Select default group in add mode if found
            if (!isEditMode && defaultGroupId !== null) {
                groupSelect.value = defaultGroupId; // Simply set the value
            }
        } catch (error) {
            console.error("加载分组失败:", error);
            showToast("加载分组选项失败", 'error');
            groupSelect.innerHTML = '<option value="">加载失败</option>';
        }

        // Add listener for platform change to show/hide fields
        platformSelect.removeEventListener('change', handlePlatformChange); // Prevent duplicates
        platformSelect.addEventListener('change', handlePlatformChange);

        function handlePlatformChange() {
            updatePlatformFieldsVisibility(modalElement, platformSelect.value);
        }
        // Initial visibility setup
        handlePlatformChange();


        // New group input handler (Enter key) - logic remains the same
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
                    showToast(`分组 \"${newGroupName}\" 已存在`, 'warning');
                    groupSelect.value = existingOption.value;
                    newGroupNameInput.value = '';
                    return;
                }
                // Add the new group
                newGroupNameInput.disabled = true; newGroupNameInput.placeholder = '添加中...';
                try {
                    const newGroupId = await window.dbAPI.addGroup(newGroupName);
                    showToast(`分组 \"${newGroupName}\" 添加成功`, 'success');
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
            const selectedPlatform = formData.get('social-platform');

            // Basic data structure
            const dataToSave = {
                platform: selectedPlatform,
                identifier: formData.get('social-identifier').trim(),
                notes: formData.get('social-notes').trim() || null,
                 // **Use group_id, parsing as integer**
                group_id: formData.get('social-group') ? parseInt(formData.get('social-group')) : null,
                 // Initialize sensitive fields - collect only if *new* value is entered
                 // Backend will handle encryption
                password: formData.get('social-password')?.trim() || (isEditMode ? undefined : null), // Send undefined if editing and empty, null if adding and empty
                twitter_2fa: formData.get('social-twitter-2fa')?.trim() || (isEditMode ? undefined : null),
                twitter_email: formData.get('social-twitter-email')?.trim() || (isEditMode ? undefined : null),
                twitter_recovery_email: formData.get('social-twitter-recovery-email')?.trim() || (isEditMode ? undefined : null),
                discord_password: formData.get('social-discord-password')?.trim() || (isEditMode ? undefined : null),
                discord_token: formData.get('social-discord-token')?.trim() || (isEditMode ? undefined : null),
                telegram_password: formData.get('social-telegram-password')?.trim() || (isEditMode ? undefined : null),
                telegram_login_api: formData.get('social-telegram-login-api')?.trim() || (isEditMode ? undefined : null),
             };

            // Clean up dataToSave: remove fields that are not applicable to the selected platform
            // AND remove sensitive fields if they were empty during an edit (sent as undefined)
            Object.keys(dataToSave).forEach(key => {
                if (dataToSave[key] === undefined) {
                     delete dataToSave[key]; // Remove fields marked as undefined (empty during edit)
                 }
                // Optional: More specific cleanup based on platform
                // e.g., if platform is 'Twitter', remove discord_* and telegram_* fields
                // This might be better handled server-side or in the DB function, but can be done here too.
             });


            // **Validation: Check identifier**
            if (!dataToSave.platform || !dataToSave.identifier) {
                showToast("平台和账户不能为空！", 'warning'); return; // Updated field name in message
            }

            saveBtn.disabled = true; saveBtn.textContent = '保存中...';

            try {
                const currentAccountId = parseInt(accountIdInput.value);
                if (!isNaN(currentAccountId) && currentAccountId > 0) { // Edit mode
                    // `updateSocialAccount` expects only fields to be updated.
                    // Sending `undefined` for empty sensitive fields achieves this.
                    await window.dbAPI.updateSocialAccount(currentAccountId, dataToSave);
                    showToast('社交账户更新成功', 'success');
                } else { // Add mode
                    // `addSocialAccount` expects all necessary fields.
                    // Sending `null` for empty sensitive fields is fine.
                    await window.dbAPI.addSocialAccount(dataToSave);
                    showToast('社交账户添加成功', 'success');
                }
                hideModal();
                // Refresh the main table using the imported function
                await loadAndRenderSocialAccounts();
            } catch (error) {
                console.error(`保存社交账户失败 (${isEditMode ? '更新' : '添加'}):`, error);
                 // Improve error message parsing if possible
                 let displayError = error.message;
                 if (error.message?.includes('UNIQUE constraint failed: social_accounts.identifier')) {
                    displayError = '该账户已存在，请使用其他账户。';
                 } else if (error.message?.includes('UNIQUE constraint failed')) {
                     displayError = '保存失败，可能存在重复数据。';
                 }
                 showToast(`${isEditMode ? '更新' : '添加'}失败: ${displayError}`, 'error');
             } finally {
                saveBtn.disabled = false; saveBtn.textContent = '保存';
            }
        };
        // Ensure listener is not duplicated
        form.removeEventListener('submit', handleSubmit);
        form.addEventListener('submit', handleSubmit);
    });
} 