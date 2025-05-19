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

/**
 * 处理社交账户的批量导入功能。
 * 从用户选择的CSV或JSON文件中读取账户数据，根据平台类型处理字段。
 */
export function handleBulkImportSocialAccounts() {
    showModal('tpl-confirm-dialog', (modalElement) => {
        // 修改确认模态框为导入界面
        const modalTitle = modalElement.querySelector('.modal-title');
        const messageElement = modalElement.querySelector('.confirm-message');
        const confirmBtn = modalElement.querySelector('.modal-confirm-btn');
        const cancelBtn = modalElement.querySelector('.modal-cancel-btn');
        
        if (!modalTitle || !messageElement || !confirmBtn || !cancelBtn) {
            console.error("导入模态框缺少必要元素");
            hideModal();
            return;
        }
        
        modalTitle.textContent = '批量导入社交账户';
        messageElement.innerHTML = `
            <div class="import-container">
                <div class="file-upload-area">
                    <i class="fas fa-file-upload fa-2x mb-2"></i>
                    <p>点击选择或拖拽文件到此处</p>
                    <input type="file" id="social-import-file" accept=".csv,.json" style="display: none;">
                    <button class="btn btn-outline-primary mt-2" id="select-import-file-btn">选择文件</button>
                </div>
                <div id="selected-file-info" style="display: none;">
                    <p><strong>已选择文件:</strong> <span id="selected-filename"></span></p>
                    <p><strong>文件类型:</strong> <span id="selected-filetype"></span></p>
                </div>
                <div class="format-selection">
                    <label class="radio-label">
                        <input type="radio" name="import-format" value="json" checked>
                        JSON 格式
                    </label>
                    <label class="radio-label">
                        <input type="radio" name="import-format" value="csv">
                        CSV 格式
                    </label>
                </div>
            </div>
        `;
        
        // 更改按钮样式和文字
        confirmBtn.textContent = '开始导入';
        confirmBtn.disabled = true;
        
        // 添加文件选择相关事件
        const fileInput = modalElement.querySelector('#social-import-file');
        const selectFileBtn = modalElement.querySelector('#select-import-file-btn');
        const selectedFileInfo = modalElement.querySelector('#selected-file-info');
        const selectedFilename = modalElement.querySelector('#selected-filename');
        const selectedFiletype = modalElement.querySelector('#selected-filetype');
        const fileUploadArea = modalElement.querySelector('.file-upload-area');
        const formatRadios = modalElement.querySelectorAll('input[name="import-format"]');
        
        if (!fileInput || !selectFileBtn || !selectedFileInfo || !selectedFilename || !selectedFiletype) {
            console.error("文件选择相关元素缺失");
            hideModal();
            return;
        }
        
        // 选择文件按钮点击事件
        selectFileBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        // 文件拖放处理
        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('drag-over');
        });
        
        fileUploadArea.addEventListener('dragleave', () => {
            fileUploadArea.classList.remove('drag-over');
        });
        
        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                handleFileSelection(e.dataTransfer.files[0]);
            }
        });
        
        // 文件选择处理
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelection(e.target.files[0]);
            }
        });
        
        // 处理选择的文件
        function handleFileSelection(file) {
            const fileName = file.name;
            const fileExt = fileName.split('.').pop().toLowerCase();
            
            if (fileExt !== 'json' && fileExt !== 'csv') {
                showToast('请选择JSON或CSV格式的文件', 'error');
                return;
            }
            
            selectedFilename.textContent = fileName;
            selectedFiletype.textContent = fileExt.toUpperCase();
            selectedFileInfo.style.display = 'block';
            
            // 自动选择匹配的文件格式单选按钮
            formatRadios.forEach(radio => {
                if (radio.value === fileExt) {
                    radio.checked = true;
                }
            });
            
            confirmBtn.disabled = false;
            confirmBtn._selectedFile = file; // 在按钮上存储文件引用
        }
        
        // 确认导入按钮点击事件
        const handleFirstStepConfirm = async () => {
            if (!confirmBtn._selectedFile) {
                showToast('请先选择要导入的文件', 'warning');
                return;
            }
            
            const selectedFormat = modalElement.querySelector('input[name="import-format"]:checked').value;
            const file = confirmBtn._selectedFile;
            
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 导入中...';
            
            try {
                const accounts = await readAndParseFile(file, selectedFormat);
                if (!accounts || accounts.length === 0) {
                    throw new Error('没有找到有效的账户数据或文件格式不正确');
                }
                
                // 检查账户数据格式
                const invalidAccounts = [];
                const validAccounts = [];
                
                for (const account of accounts) {
                    if (!account.platform || !account.identifier) {
                        invalidAccounts.push(account);
                        continue;
                    }
                    
                    // 规范化平台名称
                    account.platform = normalizePlatformName(account.platform);
                    
                    // 根据平台类型验证必要字段
                    let isValid = true;
                    
                    // 这里添加特定平台的验证逻辑，根据需要扩展
                    if (account.platform === 'Twitter' || 
                        account.platform === 'Discord' || 
                        account.platform === 'Telegram' || 
                        account.platform === 'Email') {
                        
                        validAccounts.push(account);
                    } else {
                        invalidAccounts.push(account);
                    }
                }
                
                if (validAccounts.length === 0) {
                    throw new Error('没有发现有效的社交账户数据');
                }
                
                // 显示导入确认和统计
                confirmBtn.innerHTML = '确认导入';
                confirmBtn.disabled = false;
                
                messageElement.innerHTML = `
                    <div class="import-summary">
                        <h4>导入确认</h4>
                        <p>发现 <strong>${validAccounts.length}</strong> 个有效账户</p>
                        ${invalidAccounts.length > 0 ? `<p>忽略 <strong>${invalidAccounts.length}</strong> 个无效账户</p>` : ''}
                        
                        <div class="platform-stats">
                            <h5>按平台统计：</h5>
                            <ul>
                                <li>Twitter: ${validAccounts.filter(a => a.platform === 'Twitter').length}个</li>
                                <li>Discord: ${validAccounts.filter(a => a.platform === 'Discord').length}个</li>
                                <li>Telegram: ${validAccounts.filter(a => a.platform === 'Telegram').length}个</li>
                                <li>Email: ${validAccounts.filter(a => a.platform === 'Email').length}个</li>
                            </ul>
                        </div>
                        
                        <div class="import-warning">
                            <p><i class="fas fa-exclamation-triangle"></i> 确认导入这些账户？此操作会加密敏感数据存储到数据库。</p>
                        </div>
                    </div>
                `;
                
                // 移除之前的事件处理器并添加新的导入处理器
                confirmBtn.removeEventListener('click', handleFirstStepConfirm);
                confirmBtn.addEventListener('click', () => processImport(validAccounts));
                
                // 存储当前有效账户数据供后续导入使用
                confirmBtn._validAccounts = validAccounts;
            } catch (error) {
                console.error('导入文件处理出错:', error);
                showToast(`导入失败: ${error.message}`, 'error');
                confirmBtn.disabled = false;
                confirmBtn.textContent = '重试导入';
            }
        };
        
        // 绑定确认按钮点击事件
        confirmBtn.addEventListener('click', handleFirstStepConfirm);
        
        // 读取和解析文件
        function readAndParseFile(file, format) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                
                reader.onload = async (e) => {
                    try {
                        let data;
                        if (format === 'json') {
                            data = JSON.parse(e.target.result);
                        } else if (format === 'csv') {
                            data = parseCSV(e.target.result);
                        } else {
                            reject(new Error('不支持的文件格式'));
                            return;
                        }
                        
                        if (!Array.isArray(data)) {
                            if (typeof data === 'object') {
                                // 处理单个对象的情况
                                data = [data];
                            } else {
                                reject(new Error('导入数据必须是数组格式'));
                                return;
                            }
                        }
                        
                        resolve(data);
                    } catch (error) {
                        console.error('解析导入文件失败:', error);
                        reject(new Error(`文件解析失败: ${error.message}`));
                    }
                };
                
                reader.onerror = () => reject(new Error('读取文件失败'));
                
                if (format === 'json') {
                    reader.readAsText(file);
                } else if (format === 'csv') {
                    reader.readAsText(file);
                } else {
                    reject(new Error('不支持的文件格式'));
                }
            });
        }
        
        // 解析CSV文件
        function parseCSV(csvText) {
            // 简单CSV解析，可根据需要使用更健壮的库
            const lines = csvText.split('\n');
            if (lines.length < 2) return [];
            
            const headers = lines[0].split(',').map(h => h.trim());
            const results = [];
            
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                
                const values = parseCSVLine(lines[i]);
                const obj = {};
                
                headers.forEach((header, index) => {
                    if (index < values.length) {
                        // 去除值中的引号
                        let value = values[index];
                        if (value.startsWith('"') && value.endsWith('"')) {
                            value = value.substring(1, value.length - 1);
                        }
                        obj[header] = value;
                    }
                });
                
                results.push(obj);
            }
            
            return results;
        }
        
        // 解析CSV行（处理引号中的逗号）
        function parseCSVLine(line) {
            const result = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            
            result.push(current); // 添加最后一个值
            return result;
        }
        
        // 规范化平台名称
        function normalizePlatformName(platform) {
            const name = platform.trim().toLowerCase();
            if (name.includes('twitter') || name.includes('x')) return 'Twitter';
            if (name.includes('discord')) return 'Discord';
            if (name.includes('telegram')) return 'Telegram';
            if (name.includes('email') || name.includes('mail')) return 'Email';
            return platform; // 保持原样如果未能匹配
        }
        
        // 处理最终导入
        async function processImport(accounts) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 导入处理中...';
            
            let successCount = 0;
            let errorCount = 0;
            let errors = [];
            
            for (const account of accounts) {
                try {
                    // 准备数据，确保每个平台类型有正确的字段
                    const accountData = prepareAccountData(account);
                    
                    // 调用API添加账户
                    await window.dbAPI.addSocialAccount(accountData);
                    successCount++;
                } catch (error) {
                    console.error(`导入账户 ${account.identifier} 失败:`, error);
                    errorCount++;
                    errors.push({ account: account.identifier, error: error.message });
                }
            }
            
            // 显示导入结果
            confirmBtn.innerHTML = '导入完成';
            
            let resultMessage = `成功导入 ${successCount} 个账户`;
            if (errorCount > 0) {
                resultMessage += `，${errorCount} 个账户导入失败`;
            }
            
            showToast(resultMessage, successCount > 0 ? 'success' : 'error');
            
            // 关闭模态框并刷新列表
            hideModal();
            
            if (successCount > 0) {
                await loadAndRenderSocialAccounts();
            }
        }
        
        // 按平台类型准备账户数据
        function prepareAccountData(account) {
            const accountData = {
                platform: account.platform,
                identifier: account.identifier,
                notes: account.notes || null,
                group_id: account.group_id || null
            };
            
            // 根据平台添加特定字段
            switch (account.platform) {
                case 'Twitter':
                    accountData.password = account.password || null;
                    accountData.twitter_2fa = account.twitter_2fa || null;
                    accountData.twitter_email = account.twitter_email || null;
                    break;
                case 'Discord':
                    accountData.discord_password = account.discord_password || null;
                    accountData.discord_token = account.discord_token || null;
                    break;
                case 'Telegram':
                    accountData.telegram_password = account.telegram_password || null;
                    accountData.telegram_login_api = account.telegram_login_api || null;
                    break;
                case 'Email':
                    accountData.password = account.password || null;
                    accountData.email_recovery_email = account.email_recovery_email || null;
                    break;
            }
            
            return accountData;
        }
    });
}

/**
 * 处理导出选中社交账户的功能。
 * 根据不同平台导出相应字段。
 */
export async function handleExportSelectedSocialAccounts() {
    const selectedIds = getSelectedSocialAccountIds();
    
    if (selectedIds.length === 0) {
        showToast('请至少选择一个社交账户进行导出', 'warning');
        return;
    }
    
    showModal('tpl-confirm-dialog', (modalElement) => {
        const modalTitle = modalElement.querySelector('.modal-title');
        const messageElement = modalElement.querySelector('.confirm-message');
        const confirmBtn = modalElement.querySelector('.modal-confirm-btn');
        
        if (!modalTitle || !messageElement || !confirmBtn) {
            console.error("导出确认对话框缺少必要元素");
            hideModal();
            return;
        }
        
        modalTitle.textContent = '导出社交账户';
        messageElement.innerHTML = `
            <div class="export-container">
                <p>您已选择 <strong>${selectedIds.length}</strong> 个社交账户进行导出。</p>
                
                <div class="format-selection mb-3">
                    <h5>选择导出格式:</h5>
                    <label class="radio-label">
                        <input type="radio" name="export-format" value="json" checked>
                        JSON 格式
                    </label>
                    <label class="radio-label">
                        <input type="radio" name="export-format" value="csv">
                        CSV 格式
                    </label>
                </div>
                
                <div class="field-selection">
                    <h5>选择导出字段:</h5>
                    <div class="field-checkboxes">
                        <label class="checkbox-label">
                            <input type="checkbox" name="export-field" value="id" checked>
                            ID
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" name="export-field" value="platform" checked>
                            平台
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" name="export-field" value="identifier" checked>
                            账户名/邮箱
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" name="export-field" value="sensitiveData" checked>
                            敏感数据(密码等)
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" name="export-field" value="notes" checked>
                            备注
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" name="export-field" value="group" checked>
                            分组
                        </label>
                    </div>
                </div>
                
                <div class="export-warning mt-3">
                    <p><i class="fas fa-exclamation-triangle"></i> <strong>警告：</strong>导出文件将包含<strong>未加密</strong>的敏感数据！</p>
                </div>
            </div>
        `;
        
        confirmBtn.textContent = '开始导出';
        
        // 绑定导出事件
        confirmBtn.addEventListener('click', async () => {
            const exportFormat = modalElement.querySelector('input[name="export-format"]:checked').value;
            const selectedFields = [...modalElement.querySelectorAll('input[name="export-field"]:checked')].map(cb => cb.value);
            
            if (selectedFields.length === 0) {
                showToast('请至少选择一个要导出的字段', 'warning');
                return;
            }
            
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 导出处理中...';
            
            try {
                // 获取选中的账户数据
                const accounts = [];
                for (const id of selectedIds) {
                    try {
                        const account = await window.dbAPI.getSocialAccountById(id);
                        if (account) {
                            accounts.push(account);
                        }
                    } catch (error) {
                        console.error(`获取社交账户 ID ${id} 详情失败:`, error);
                    }
                }
                
                if (accounts.length === 0) {
                    throw new Error('获取账户数据失败');
                }
                
                // 对账户按平台分组，为不同平台准备不同的字段
                const accountsByPlatform = {};
                accounts.forEach(account => {
                    if (!accountsByPlatform[account.platform]) {
                        accountsByPlatform[account.platform] = [];
                    }
                    accountsByPlatform[account.platform].push(account);
                });
                
                // 准备解密和导出的数据
                const exportData = await processExportData(accounts, selectedFields);
                
                // 导出为选定格式
                const fileName = `social_accounts_export_${Date.now()}.${exportFormat}`;
                let fileContent;
                
                if (exportFormat === 'json') {
                    fileContent = JSON.stringify(exportData, null, 2);
                } else {
                    // CSV 格式导出
                    fileContent = generateCSV(exportData);
                }
                
                // 使用主进程保存文件
                const saveResult = await window.dbAPI.saveFile({
                    defaultPath: fileName,
                    content: fileContent
                });
                
                if (saveResult && saveResult.success) {
                    showToast(`已成功导出 ${accounts.length} 个社交账户到 ${saveResult.filePath}`, 'success');
                } else {
                    throw new Error(saveResult?.error || '保存文件失败');
                }
            } catch (error) {
                console.error('导出社交账户失败:', error);
                showToast(`导出失败: ${error.message}`, 'error');
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.textContent = '开始导出';
                hideModal();
            }
        });
        
        // 处理导出数据，进行必要的解密
        async function processExportData(accounts, selectedFields) {
            const exportData = [];
            
            for (const account of accounts) {
                const exportAccount = {};
                
                // 只导出选中的字段
                if (selectedFields.includes('id')) {
                    exportAccount.id = account.id;
                }
                
                if (selectedFields.includes('platform')) {
                    exportAccount.platform = account.platform;
                }
                
                if (selectedFields.includes('identifier')) {
                    exportAccount.identifier = account.identifier;
                }
                
                if (selectedFields.includes('notes')) {
                    exportAccount.notes = account.notes;
                }
                
                if (selectedFields.includes('group')) {
                    exportAccount.group_id = account.group_id;
                    exportAccount.groupName = account.groupName;
                }
                
                // 敏感数据需要解密
                if (selectedFields.includes('sensitiveData')) {
                    // 根据平台类型解密相应字段
                    switch (account.platform) {
                        case 'Twitter':
                            if (account.password) {
                                try {
                                    exportAccount.password = await window.electron.ipcRenderer.invoke('app:decryptData', account.password);
                                } catch (error) {
                                    console.error(`解密Twitter账户 ${account.id} 密码失败:`, error);
                                    exportAccount.password = '[解密失败]';
                                }
                            }
                            
                            if (account.twitter_2fa) {
                                try {
                                    exportAccount.twitter_2fa = await window.electron.ipcRenderer.invoke('app:decryptData', account.twitter_2fa);
                                } catch (error) {
                                    console.error(`解密Twitter账户 ${account.id} 2FA失败:`, error);
                                    exportAccount.twitter_2fa = '[解密失败]';
                                }
                            }
                            
                            if (account.twitter_email) {
                                exportAccount.twitter_email = account.twitter_email;
                            }
                            break;
                            
                        case 'Discord':
                            if (account.discord_password) {
                                try {
                                    exportAccount.discord_password = await window.electron.ipcRenderer.invoke('app:decryptData', account.discord_password);
                                } catch (error) {
                                    console.error(`解密Discord账户 ${account.id} 密码失败:`, error);
                                    exportAccount.discord_password = '[解密失败]';
                                }
                            }
                            
                            if (account.discord_token) {
                                try {
                                    exportAccount.discord_token = await window.electron.ipcRenderer.invoke('app:decryptData', account.discord_token);
                                } catch (error) {
                                    console.error(`解密Discord账户 ${account.id} Token失败:`, error);
                                    exportAccount.discord_token = '[解密失败]';
                                }
                            }
                            break;
                            
                        case 'Telegram':
                            if (account.telegram_password) {
                                try {
                                    exportAccount.telegram_password = await window.electron.ipcRenderer.invoke('app:decryptData', account.telegram_password);
                                } catch (error) {
                                    console.error(`解密Telegram账户 ${account.id} 密码失败:`, error);
                                    exportAccount.telegram_password = '[解密失败]';
                                }
                            }
                            
                            if (account.telegram_login_api) {
                                try {
                                    exportAccount.telegram_login_api = await window.electron.ipcRenderer.invoke('app:decryptData', account.telegram_login_api);
                                } catch (error) {
                                    console.error(`解密Telegram账户 ${account.id} API信息失败:`, error);
                                    exportAccount.telegram_login_api = '[解密失败]';
                                }
                            }
                            break;
                            
                        case 'Email':
                            if (account.password) {
                                try {
                                    exportAccount.password = await window.electron.ipcRenderer.invoke('app:decryptData', account.password);
                                } catch (error) {
                                    console.error(`解密Email账户 ${account.id} 密码失败:`, error);
                                    exportAccount.password = '[解密失败]';
                                }
                            }
                            
                            if (account.email_recovery_email) {
                                exportAccount.email_recovery_email = account.email_recovery_email;
                            }
                            break;
                    }
                }
                
                exportData.push(exportAccount);
            }
            
            return exportData;
        }
        
        // 生成CSV格式数据
        function generateCSV(data) {
            if (data.length === 0) return '';
            
            // 获取所有可能的字段
            const allFields = new Set();
            data.forEach(item => {
                Object.keys(item).forEach(key => allFields.add(key));
            });
            
            const headers = Array.from(allFields);
            let csv = headers.join(',') + '\n';
            
            // 添加每行数据
            data.forEach(item => {
                const values = headers.map(header => {
                    const value = item[header] === undefined ? '' : String(item[header]);
                    // 处理特殊字符
                    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                });
                csv += values.join(',') + '\n';
            });
            
            return csv;
        }
    });
} 