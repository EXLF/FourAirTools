import { showModal, hideModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
// 导入 table 模块中的函数，用于刷新
import { loadAndRenderWallets, loadGroupFilters } from './table.js'; 

// --- 新增：缓存用于新增钱包模态框的状态 ---
let deriveAddressTimeout = null;
// -----------------------------------------

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

/**
 * 打开新增钱包（手动输入）模态框。
 */
export async function openAddWalletManualModal() {
    showModal('tpl-add-wallet-manual-form', async (modalElement) => {
        const form = modalElement.querySelector('#add-wallet-manual-form-actual');
        const seedTypeRadios = form.querySelectorAll('input[name="seedType"]');
        const privateKeyGroup = modalElement.querySelector('.private-key-group');
        const mnemonicGroup = modalElement.querySelector('.mnemonic-group');
        const privateKeyInput = modalElement.querySelector('#wallet-private-key');
        const mnemonicInput = modalElement.querySelector('#wallet-mnemonic');
        const derivedAddressGroup = modalElement.querySelector('.derived-address-group');
        const addressDisplaySpan = modalElement.querySelector('.address-text');
        const addressErrorSpan = modalElement.querySelector('.address-error-text');
        const addressLoadingSpinner = modalElement.querySelector('.address-loading-spinner');
        const groupSelect = modalElement.querySelector('#wallet-group');
        const newGroupNameInput = modalElement.querySelector('.new-group-name-input');
        const saveBtn = modalElement.querySelector('.modal-save-btn');
        const toggleVisibilityBtns = modalElement.querySelectorAll('.toggle-visibility-btn');

        let derivedAddress = null; // Store the successfully derived address

        // Function to toggle input visibility
        const toggleInputVisibility = (inputElement, iconElement) => {
             if (inputElement.type === 'password') {
                 inputElement.type = 'text';
                 iconElement.classList.remove('fa-eye');
                 iconElement.classList.add('fa-eye-slash');
             } else {
                 inputElement.type = 'password';
                 iconElement.classList.remove('fa-eye-slash');
                 iconElement.classList.add('fa-eye');
             }
        };

        // Add listeners to toggle buttons
        toggleVisibilityBtns.forEach(btn => {
            const inputGroup = btn.closest('.input-field-group');
            const input = inputGroup.querySelector('input[type="password"], input[type="text"], textarea');
            const icon = btn.querySelector('i');
            if (input && icon) {
                 btn.addEventListener('click', () => toggleInputVisibility(input, icon));
            }
        });

        // Handle seed type change
        seedTypeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const selectedType = form.elements.seedType.value;
                privateKeyGroup.style.display = selectedType === 'privateKey' ? '' : 'none';
                mnemonicGroup.style.display = selectedType === 'mnemonic' ? '' : 'none';
                // Clear other input and reset address display on type change
                if (selectedType === 'privateKey') mnemonicInput.value = '';
                else privateKeyInput.value = '';
                derivedAddressGroup.style.display = 'none';
                addressDisplaySpan.textContent = '';
                addressErrorSpan.textContent = ''; addressErrorSpan.style.display = 'none';
                addressLoadingSpinner.style.display = 'none';
                derivedAddress = null;
                saveBtn.disabled = true; // Disable save until address is derived
            });
        });

        // Function to trigger address derivation
        const triggerDeriveAddress = async () => {
            clearTimeout(deriveAddressTimeout); // Clear previous timeout
            const seedType = form.elements.seedType.value;
            const seed = (seedType === 'privateKey' ? privateKeyInput.value : mnemonicInput.value).trim();

            derivedAddressGroup.style.display = 'none'; // Hide initially
            addressLoadingSpinner.style.display = 'none';
            addressErrorSpan.style.display = 'none';
            addressDisplaySpan.textContent = '';
            derivedAddress = null;
            saveBtn.disabled = true;

            if (!seed) return; // Don't derive if input is empty

            derivedAddressGroup.style.display = ''; // Show the group
            addressLoadingSpinner.style.display = ''; // Show spinner

            try {
                console.log(`[IPC] Sending derive request: Type=${seedType}, Seed Length=${seed.length}`);
                const result = await window.dbAPI.deriveAddressFromSeed({ seedType, seed });
                console.log('[IPC] Derive response:', result);
                addressLoadingSpinner.style.display = 'none';
                if (result.address) {
                    addressDisplaySpan.textContent = result.address;
                    derivedAddress = result.address;
                    addressErrorSpan.style.display = 'none';
                    saveBtn.disabled = false; // Enable save button
                } else {
                    addressErrorSpan.textContent = result.error || '派生失败';
                    addressErrorSpan.style.display = '';
                    derivedAddress = null;
                    saveBtn.disabled = true;
                }
            } catch (error) {
                 console.error('IPC Error deriving address:', error);
                 addressLoadingSpinner.style.display = 'none';
                 addressErrorSpan.textContent = `请求派生地址失败: ${error.message}`;
                 addressErrorSpan.style.display = '';
                 derivedAddress = null;
                 saveBtn.disabled = true;
            }
        };

        // Debounced derivation trigger on input
        const handleSeedInput = () => {
             clearTimeout(deriveAddressTimeout);
             deriveAddressTimeout = setTimeout(triggerDeriveAddress, 600); // Delay derivation
        };

        privateKeyInput.addEventListener('input', handleSeedInput);
        mnemonicInput.addEventListener('input', handleSeedInput);

        // Load groups
        try {
            const groups = await window.dbAPI.getGroups();
            groupSelect.innerHTML = '<option value="">无分组</option>';
            let defaultGroupId = null;
            groups.forEach(group => {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name;
                if (group.name === '默认分组') defaultGroupId = group.id;
                groupSelect.appendChild(option);
            });
            if (defaultGroupId) { // Auto-select default group
                 const defaultOption = groupSelect.querySelector(`option[value="${defaultGroupId}"]`);
                 if (defaultOption) defaultOption.selected = true;
            }
        } catch (error) {
            console.error("加载分组失败:", error);
            showToast("加载分组选项失败", 'error');
            groupSelect.innerHTML = '<option value="">加载失败</option>';
        }

        // New group input handler
        const handleNewGroupEnter = async (event) => {
             if (event.key === 'Enter') {
                 event.preventDefault();
                 const newGroupName = newGroupNameInput.value.trim();
                 if (!newGroupName) {
                     showToast('请输入新分组名称', 'warning'); return;
                 }
                 const existingOption = Array.from(groupSelect.options).find(opt => opt.textContent.toLowerCase() === newGroupName.toLowerCase());
                 if (existingOption) {
                     showToast(`分组 "${newGroupName}" 已存在`, 'warning');
                     groupSelect.value = existingOption.value;
                     newGroupNameInput.value = '';
                     return;
                 }
                 newGroupNameInput.disabled = true; newGroupNameInput.placeholder = '添加中...';
                 try {
                     const newGroupId = await window.dbAPI.addGroup(newGroupName);
                     showToast(`分组 "${newGroupName}" 添加成功`, 'success');
                     const newOption = document.createElement('option');
                     newOption.value = newGroupId; newOption.textContent = newGroupName; newOption.selected = true;
                     groupSelect.appendChild(newOption);
                     newGroupNameInput.value = '';
                     await loadGroupFilters(); // Refresh main page filter
                 } catch (error) {
                     console.error("添加新分组失败:", error);
                     showToast(`添加分组失败: ${error.message}`, 'error');
                 } finally {
                     newGroupNameInput.disabled = false; newGroupNameInput.placeholder = '或输入新分组名后按回车添加';
                 }
             }
        };
        newGroupNameInput.removeEventListener('keydown', handleNewGroupEnter);
        newGroupNameInput.addEventListener('keydown', handleNewGroupEnter);

        // Form submission
        const handleSubmit = async (event) => {
            event.preventDefault();
            if (!derivedAddress) {
                showToast('无法保存：钱包地址未成功派生或无效。', 'error');
                return;
            }

            saveBtn.disabled = true;
            saveBtn.textContent = '保存中...';

            const seedType = form.elements.seedType.value;
            const seedValue = seedType === 'privateKey' ? privateKeyInput.value.trim() : mnemonicInput.value.trim();

            let encryptedSeedValue = null;
            try {
                // --- 在保存前加密种子值 --- 
                 console.log(`Encrypting ${seedType} for saving...`);
                 encryptedSeedValue = await window.dbAPI.encryptData(seedValue);
                 console.log(`Encryption result length: ${encryptedSeedValue?.length}`);
                 if (typeof encryptedSeedValue !== 'string') { // IPC 错误或加密服务未解锁可能抛出
                      throw new Error('加密种子值失败，返回类型不正确。');
                 }
                 // ---------------------------
            } catch (encError) {
                 console.error('加密种子值失败:', encError);
                 showToast(`保存失败：无法加密敏感信息 (${encError.message})`, 'error');
                 saveBtn.disabled = false;
                 saveBtn.textContent = '保存钱包';
                 return;
            }

            const dataToSave = {
                address: derivedAddress,
                name: form.elements.name.value.trim() || null,
                notes: form.elements.notes.value.trim() || null,
                groupId: form.elements.groupId.value ? parseInt(form.elements.groupId.value) : null,
                // --- 保存加密后的值 --- 
                encryptedPrivateKey: seedType === 'privateKey' ? encryptedSeedValue : null,
                mnemonic: seedType === 'mnemonic' ? encryptedSeedValue : null,
                // -----------------------
                derivationPath: null // Path is unknown for manual import
            };

            try {
                console.log('Adding new wallet:', {
                     ...dataToSave,
                     encryptedPrivateKey: dataToSave.encryptedPrivateKey ? '[ENCRYPTED]' : null, // Avoid logging encrypted data
                     mnemonic: dataToSave.mnemonic ? '[ENCRYPTED]' : null
                });
                const newId = await window.dbAPI.addWallet(dataToSave);
                console.log('Wallet added successfully, ID:', newId);
                showToast('钱包添加成功！', 'success');
                hideModal();
                await loadAndRenderWallets(); // Refresh wallet list
            } catch (error) {
                 console.error('Error saving new wallet:', error);
                 // Check for unique constraint error specifically for address
                 if (error.message?.toLowerCase().includes('unique constraint failed: wallets.address')) {
                     showToast('保存失败：该钱包地址已存在。', 'error');
                 } else {
                     showToast(`保存钱包失败: ${error.message}`, 'error');
                 }
                 saveBtn.disabled = false;
                 saveBtn.textContent = '保存钱包';
            }
        };

        form.removeEventListener('submit', handleSubmit);
        form.addEventListener('submit', handleSubmit);

        // Initial state: disable save button
        saveBtn.disabled = true;
    });
}

/**
 * 打开分组管理模态框。
 */
export async function openManageGroupsModal() {
     showModal('tpl-manage-groups', async (modalElement) => {
        const groupListElement = modalElement.querySelector('.group-list');
        const newGroupNameInput = modalElement.querySelector('#new-group-name');
        const addGroupBtn = modalElement.querySelector('.add-group-btn');

        if (!groupListElement || !newGroupNameInput || !addGroupBtn) {
            console.error("分组管理模态框缺少必要的元素 (.group-list, #new-group-name, .add-group-btn)。");
            hideModal(); return;
        }

        const renderGroupList = async () => {
            groupListElement.innerHTML = '加载中...';
            try {
                const groups = await window.dbAPI.getGroups();
                groupListElement.innerHTML = ''; 
                if (groups.length === 0) {
                    groupListElement.innerHTML = '<li style="padding: 10px; text-align: center; color: #888;">暂无分组。</li>';
                    return;
                }
                groups.forEach(group => {
                    const li = document.createElement('li');
                    li.dataset.id = group.id;
                    li.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 10px 5px; border-bottom: 1px solid #eee;`;

                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = group.name;
                    nameSpan.style.cssText = `flex-grow: 1; margin-right: 10px;`;

                    const actionsDiv = document.createElement('div');
                    actionsDiv.className = 'group-actions';
                    actionsDiv.style.flexShrink = '0';

                    const editBtn = document.createElement('button');
                    editBtn.innerHTML = '<i class="fa fa-edit"></i>';
                    editBtn.title = '重命名';
                    editBtn.className = 'btn-icon btn-icon-sm';
                    editBtn.style.marginRight = '5px';
                    
                    editBtn.addEventListener('click', () => {
                        li.classList.add('editing');
                        nameSpan.style.display = 'none';
                        actionsDiv.style.display = 'none';

                        const input = document.createElement('input');
                        input.type = 'text'; input.value = group.name;
                        input.className = 'input input-sm group-edit-input';
                        input.style.cssText = `flex-grow: 1; margin-right: 10px; font-size: 14px; padding: 8px 12px; height: auto; border-radius: 4px; border: 1px solid #ddd;`;

                        const saveBtn = document.createElement('button');
                        saveBtn.innerHTML = '<i class="fas fa-check"></i>'; saveBtn.title = '保存';
                        saveBtn.className = 'btn-icon btn-icon-sm btn-success'; saveBtn.style.marginRight = '5px';

                        const cancelBtn = document.createElement('button');
                        cancelBtn.innerHTML = '<i class="fas fa-times"></i>'; cancelBtn.title = '取消';
                        cancelBtn.className = 'btn-icon btn-icon-sm btn-secondary';

                        const editControls = document.createElement('div');
                        editControls.className = 'group-edit-controls';
                        editControls.style.cssText = `display: flex; align-items: center; flex-grow: 1;`;
                        editControls.appendChild(input); editControls.appendChild(saveBtn); editControls.appendChild(cancelBtn);
                        
                        li.insertBefore(editControls, nameSpan);
                        input.focus(); input.select();

                        const cancelEdit = () => {
                            li.removeChild(editControls);
                            nameSpan.style.display = '';
                            actionsDiv.style.display = '';
                            li.classList.remove('editing');
                        };

                        saveBtn.addEventListener('click', async () => {
                            const newName = input.value.trim();
                            if (!newName) { showToast('分组名称不能为空', 'warning'); return; }
                            if (newName === group.name) { cancelEdit(); return; }
                            
                            const otherGroupNames = Array.from(groupListElement.querySelectorAll('li:not(.editing) span')).map(span => span.textContent.toLowerCase());
                            if (otherGroupNames.includes(newName.toLowerCase())) {
                                showToast(`分组名称 "${newName}" 已存在`, 'warning'); return;
                            }

                            saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                            try {
                                await window.dbAPI.updateGroup(group.id, newName);
                                showToast(`分组已重命名为 "${newName}"`, 'success');
                                group.name = newName;
                                nameSpan.textContent = newName;
                                cancelEdit();
                                await loadGroupFilters(); // 刷新主页筛选器
                            } catch (error) {
                                if (error.message?.includes('UNIQUE constraint failed')) {
                                    showToast(`重命名失败：分组名称 "${newName}" 已存在！`, 'error');
                                } else { showToast(`重命名分组失败: ${error.message}`, 'error'); }
                                saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-check"></i>';
                            }
                        });
                        cancelBtn.addEventListener('click', cancelEdit);
                        input.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); }
                             else if (e.key === 'Escape') { cancelEdit(); }
                        });
                    });

                    const deleteBtn = document.createElement('button');
                    deleteBtn.innerHTML = '<i class="fa fa-trash"></i>';
                    deleteBtn.title = '删除';
                    deleteBtn.className = 'btn-icon btn-icon-sm';
                     if (group.name === '默认分组') {
                         deleteBtn.disabled = true; deleteBtn.title = '不能删除默认分组';
                         deleteBtn.style.cssText = `opacity: 0.5; cursor: not-allowed;`;
                     } else {
                         deleteBtn.addEventListener('click', async () => {
                            showModal('tpl-confirm-dialog', (confirmModalElement) => {
                                const messageElement = confirmModalElement.querySelector('.confirm-message');
                                const confirmBtnModal = confirmModalElement.querySelector('.modal-confirm-btn');
                                if (!messageElement || !confirmBtnModal) { console.error("确认框元素缺失"); hideModal(); return; }

                                messageElement.innerHTML = `确定删除分组 "<b>${group.name}</b>"？<br>关联的钱包或社交账户将变为"无分组"。`;

                                const handleConfirmGroupDelete = async () => {
                                    confirmBtnModal.removeEventListener('click', handleConfirmGroupDelete);
                                    hideModal();
                                    try {
                                        await window.dbAPI.deleteGroup(group.id);
                                        showToast(`分组 "${group.name}" 已删除`, 'success');
                                        await renderGroupList(); // 刷新分组列表
                                        await loadGroupFilters(); // 刷新主页筛选器
                                        await loadAndRenderWallets(); // 刷新钱包列表
                                    } catch (error) { showToast(`删除分组失败: ${error.message}`, 'error'); }
                                };
                                confirmBtnModal.addEventListener('click', handleConfirmGroupDelete);
                            });
                         });
                     }

                    actionsDiv.appendChild(editBtn); actionsDiv.appendChild(deleteBtn);
                    li.appendChild(nameSpan); li.appendChild(actionsDiv);
                    groupListElement.appendChild(li);
                });
                if (groupListElement.lastElementChild) { groupListElement.lastElementChild.style.borderBottom = 'none'; }
            } catch (error) {
                console.error("IPC: 加载分组列表失败:", error);
                groupListElement.innerHTML = '<li style="padding: 10px; color:red;">加载分组失败。</li>';
            }
        };

        const handleAddGroup = async () => {
            const name = newGroupNameInput.value.trim();
            if (name) {
                addGroupBtn.disabled = true;
                try {
                    await window.dbAPI.addGroup(name);
                    showToast(`分组 "${name}" 添加成功`, 'success');
                    newGroupNameInput.value = '';
                    await renderGroupList();
                    await loadGroupFilters(); // 刷新主页筛选器
                } catch (error) {
                     if (error.message?.includes('UNIQUE constraint failed')) {
                         showToast(`添加失败：分组名称 "${name}" 已存在！`, 'error');
                     } else { showToast(`添加分组失败: ${error.message}`, 'error'); }
                } finally { addGroupBtn.disabled = false; }
            }
        };

        // Handle form submission via button click or Enter key
        const groupAddContainer = addGroupBtn.closest('.group-add-form');
        if (groupAddContainer) {
             groupAddContainer.addEventListener('submit', (e) => { e.preventDefault(); handleAddGroup(); }); // Submit on form submit
             newGroupNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddGroup(); } });
             addGroupBtn.addEventListener('click', handleAddGroup); // Also handle click
        } else {
             // Fallback if structure changes
             addGroupBtn.addEventListener('click', handleAddGroup);
             newGroupNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddGroup(); } });
        }

        await renderGroupList(); // Initial render
     });
}

/**
 * 打开批量生成钱包模态框。
 */
export async function openGenerateWalletsModal() {
    showModal('tpl-generate-wallets', async (modalElement) => {
        const form = modalElement.querySelector('#generate-wallet-form');
        const countInput = modalElement.querySelector('#generate-count');
        const groupSelect = modalElement.querySelector('#generate-group');
        const generateBtn = modalElement.querySelector('.modal-generate-btn');
        const cancelBtn = modalElement.querySelector('.modal-cancel-btn');
        const progressDiv = modalElement.querySelector('#generate-progress');
        const progressBar = progressDiv?.querySelector('progress'); // Use optional chaining
        const progressText = progressDiv?.querySelector('#generate-progress-text');

        if (!form || !countInput || !groupSelect || !generateBtn || !cancelBtn || !progressDiv || !progressBar || !progressText) {
            console.error(`[${Date.now()}] openGenerateWalletsModal: Missing elements`);
            hideModal(); return;
        }

        // Reset state
        generateBtn.style.display = 'inline-block';
        cancelBtn.style.display = 'inline-block';
        cancelBtn.textContent = '取消';
        progressDiv.style.display = 'none';
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fa fa-cogs"></i> 开始生成';

        // Focus on input
        requestAnimationFrame(() => countInput.focus());

        // Populate groups
        try {
            const groups = await window.dbAPI.getGroups();
            groupSelect.innerHTML = '<option value="">不指定分组</option>';
            let defaultGroupId = "";
            groups.forEach(group => {
                const option = document.createElement('option');
                option.value = group.id; option.textContent = group.name;
                groupSelect.appendChild(option);
                if (group.name === '默认分组') { defaultGroupId = group.id; }
            });
            if (defaultGroupId) { groupSelect.value = defaultGroupId; }
        } catch (error) { console.error("IPC: 填充生成模态框分组失败:", error); }

        const handleGenerateSubmit = async (event) => {
            event.preventDefault();
            const count = parseInt(countInput.value);
            const groupId = groupSelect.value ? parseInt(groupSelect.value) : null;

            if (isNaN(count) || count <= 0) { showToast("请输入有效的生成数量 (>0)。", 'warning'); return; }
            if (count > 1000) { showToast("一次最多生成 1000 个钱包。", 'warning'); return; }

            generateBtn.disabled = true;
            generateBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 生成中...';
            progressDiv.style.display = 'block';
            progressBar.value = 0; progressBar.max = count;
            progressText.textContent = `正在生成 0 / ${count}...`;

            try {
                console.log(`请求批量生成: ${count} 个钱包, 分组ID: ${groupId}`);
                const result = await window.dbAPI.generateWallets({ count, groupId });
                console.log("批量生成结果:", result);

                let message = `批量生成完成！\n成功生成 ${result.generatedCount} 个钱包。`;
                if (result.errors?.length > 0) {
                    message += `\n\n出现 ${result.errors.length} 个错误:\n - ${result.errors.slice(0, 10).join('\n - ')}`;
                    if (result.errors.length > 10) message += '\n - ... (更多错误请查看控制台)';
                    console.warn("批量生成错误:", result.errors);
                }

                progressBar.value = progressBar.max;
                progressText.innerHTML = message.replace(/\n/g, '<br>');

                generateBtn.style.display = 'none';
                cancelBtn.textContent = '关闭';
                cancelBtn.style.display = 'inline-block';

                // Refresh wallet list in the background
                requestAnimationFrame(() => {
                    setTimeout(loadAndRenderWallets, 0);
                });

            } catch (error) {
                console.error("IPC: 调用钱包生成功能失败:", error);
                progressText.textContent = `批量生成过程中发生错误: ${error.message}`;
                progressText.style.color = 'red';
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="fa fa-cogs"></i> 重新生成';
                generateBtn.style.display = 'inline-block';
                cancelBtn.style.display = 'inline-block';
                cancelBtn.textContent = '取消';
            }
        };

        form.removeEventListener('submit', handleGenerateSubmit);
        form.addEventListener('submit', handleGenerateSubmit);

        // Ensure cancel button closes the modal
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener('click', hideModal);
    });
}

/**
 * 显示查看钱包详情的模态框。
 * @param {number} walletId 要查看的钱包 ID。
 */
export function showViewDetailsModal(walletId) {
    showModal('tpl-view-wallet-details', async (modalElement) => {
        const addressEl = modalElement.querySelector('#view-wallet-address-value');
        const privateKeyEl = modalElement.querySelector('#view-private-key');
        const mnemonicEl = modalElement.querySelector('#view-mnemonic');
        const copyBtns = modalElement.querySelectorAll('.copy-btn');
        const modalTitle = modalElement.querySelector('.modal-title');

        // 设置初始加载状态
        if(addressEl) addressEl.textContent = '加载中...';
        if(privateKeyEl) privateKeyEl.textContent = '加载中...';
        if(mnemonicEl) mnemonicEl.textContent = '加载中...';
        if(modalTitle) modalTitle.textContent = '查看钱包详情'; // Reset title

        try {
            // 1. 从主进程获取钱包详情 (包含加密数据)
            console.log(`[WalletsModals] Fetching details for wallet ID: ${walletId}`);
            const details = await window.dbAPI.getWalletDetails(walletId);
            console.log('[WalletsModals] Received details:', details);

            if (!details) {
                throw new Error('未能获取到钱包详情。');
            }

            // 填充地址 (地址通常不加密)
            if(addressEl) addressEl.textContent = details.address || 'N/A';
            if(modalTitle && details.name) modalTitle.textContent = `查看详情: ${details.name} (${details.address.substring(0,6)}...)`;
            else if (modalTitle) modalTitle.textContent = `查看详情: ${details.address.substring(0,6)}...`;


            // 2. 解密私钥和助记词
            let decryptedPrivateKey = '[解密失败或无数据]';
            let decryptedMnemonic = '[解密失败或无数据]';

            if (details.encryptedPrivateKey) {
                try {
                    console.log('[WalletsModals] Attempting to decrypt private key...');
                    decryptedPrivateKey = await window.electron.ipcRenderer.invoke('app:decryptData', details.encryptedPrivateKey);
                    console.log('[WalletsModals] Private key decrypted.');
                    if (!decryptedPrivateKey) decryptedPrivateKey = '[解密返回空]';
                } catch (error) {
                    console.error('[WalletsModals] Failed to decrypt private key:', error);
                    decryptedPrivateKey = `[解密错误: ${error.message}]`;
                }
            } else {
                 decryptedPrivateKey = '[未存储]';
            }

            if (details.mnemonic) {
                try {
                    console.log('[WalletsModals] Attempting to decrypt mnemonic...');
                    decryptedMnemonic = await window.electron.ipcRenderer.invoke('app:decryptData', details.mnemonic);
                    console.log('[WalletsModals] Mnemonic decrypted.');
                    if (!decryptedMnemonic) decryptedMnemonic = '[解密返回空]';
                } catch (error) {
                    console.error('[WalletsModals] Failed to decrypt mnemonic:', error);
                    decryptedMnemonic = `[解密错误: ${error.message}]`;
                }
            } else {
                 decryptedMnemonic = '[未存储]';
            }

            // *** 新增：在填充 UI 前打印最终的解密结果 ***
            console.log('[WalletsModals] Final value for Private Key before UI update:', decryptedPrivateKey);
            console.log('[WalletsModals] Final value for Mnemonic before UI update:', decryptedMnemonic);

            // 3. 填充解密后的数据
            if(privateKeyEl) {
                console.log('[WalletsModals] Setting private key text content.');
                privateKeyEl.textContent = decryptedPrivateKey;
            } else {
                 console.error('[WalletsModals] privateKeyEl not found when trying to set text!');
            }
            if(mnemonicEl) {
                 console.log('[WalletsModals] Setting mnemonic text content.');
                 mnemonicEl.textContent = decryptedMnemonic;
             } else {
                  console.error('[WalletsModals] mnemonicEl not found when trying to set text!');
             }

            // 重新设置复制按钮的目标 (确保它们能复制解密后的内容)
            setupCopyButtons(modalElement);

        } catch (error) {
            console.error('[WalletsModals] Error showing view details modal:', error);
            showToast(`加载钱包详情失败: ${error.message}`, 'error');
            // 可以选择关闭模态框或显示错误信息
             if(addressEl) addressEl.textContent = '加载失败';
             if(privateKeyEl) privateKeyEl.textContent = '加载失败';
             if(mnemonicEl) mnemonicEl.textContent = '加载失败';
             hideModal(); // 或者保留模态框让用户看到错误
        }
    });
}

// Helper function for copy buttons (if not already defined elsewhere)
function setupCopyButtons(containerElement) {
    const copyBtns = containerElement.querySelectorAll('.copy-btn');
    copyBtns.forEach(btn => {
        // Remove existing listener to prevent duplicates if modal is reused
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', async () => {
            const targetId = newBtn.dataset.target;
            const targetElement = containerElement.querySelector(`#${targetId}`);
            if (targetElement) {
                const textToCopy = targetElement.textContent;
                 if (textToCopy && !textToCopy.startsWith('[')) { // Don't copy error messages
                    try {
                        await navigator.clipboard.writeText(textToCopy);
                        showToast('已复制到剪贴板', 'success');
                    } catch (err) {
                        console.error('无法复制文本: ', err);
                        showToast('复制失败', 'error');
                    }
                } else {
                    showToast('没有有效内容可复制', 'warning');
                }
            }
        });
    });
} 