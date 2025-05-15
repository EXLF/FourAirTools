import { showModal, hideModal } from '../../../components/modal.js';
import { showToast } from '../../../components/toast.js';
import { loadAndRenderWallets, loadGroupFilters } from '../table.js';

let deriveAddressTimeout = null;

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
                encryptedMnemonic: seedType === 'mnemonic' ? encryptedSeedValue : null,
                // -----------------------
                derivationPath: null // Path is unknown for manual import
            };

            try {
                console.log('Adding new wallet:', {
                     ...dataToSave,
                     encryptedPrivateKey: dataToSave.encryptedPrivateKey ? '[ENCRYPTED]' : null, // Avoid logging encrypted data
                     encryptedMnemonic: dataToSave.encryptedMnemonic ? '[ENCRYPTED]' : null
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