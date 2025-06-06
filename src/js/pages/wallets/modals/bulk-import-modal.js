import { showModal, hideModal } from '../../../components/modal.js';
import { showToast } from '../../../components/toast.js';
import { loadAndRenderWallets } from '../table.js';

/**
 * 批量导入钱包模态框
 */
export async function openBulkImportModal() {
    showModal('tpl-bulk-import-wallets', async (modalElement) => {
        // 获取DOM元素
        const tabBtns = modalElement.querySelectorAll('.tab-btn');
        const tabContents = modalElement.querySelectorAll('.tab-content');
        const textarea = modalElement.querySelector('#bulk-import-textarea');
        const fileInput = modalElement.querySelector('#bulk-import-file');
        const fileUploadArea = modalElement.querySelector('#file-upload-area');
        const filePreview = modalElement.querySelector('#file-preview');
        const defaultGroupSelect = modalElement.querySelector('#default-group-select');
        const parseBtn = modalElement.querySelector('#parse-import-btn');
        const startImportBtn = modalElement.querySelector('#start-import-btn');
        const importPreview = modalElement.querySelector('#import-preview');
        const importProgress = modalElement.querySelector('#import-progress');
        const downloadCsvBtn = modalElement.querySelector('#download-csv-template');

        // 初始化状态
        let parsedData = [];
        let validData = [];
        let invalidData = [];
        let duplicateData = [];

        // 初始化分组选项
        await loadGroupOptions();

        // 设置标签页切换
        setupTabs();

        // 设置文件上传
        setupFileUpload();

        // 设置数据解析
        setupDataParsing();

        // 设置CSV模板下载
        setupCsvTemplate();

        /**
         * 加载分组选项
         */
        async function loadGroupOptions() {
            try {
                const groups = await window.dbAPI.getGroups();
                defaultGroupSelect.innerHTML = '<option value="">默认分组</option>';
                groups.forEach(group => {
                    const option = document.createElement('option');
                    option.value = group.id;
                    option.textContent = group.name;
                    defaultGroupSelect.appendChild(option);
                });
            } catch (error) {
                console.error('加载分组失败:', error);
                showToast('加载分组失败', 'error');
            }
        }

        /**
         * 设置标签页切换
         */
        function setupTabs() {
            tabBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const targetTab = btn.dataset.tab;
                    
                    // 切换按钮状态
                    tabBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    // 切换内容
                    tabContents.forEach(content => {
                        content.classList.remove('active');
                        if (content.id === `${targetTab}-tab`) {
                            content.classList.add('active');
                        }
                    });

                    // 重置预览
                    resetPreview();
                });
            });
        }

        /**
         * 设置文件上传
         */
        function setupFileUpload() {
            // 点击上传区域
            fileUploadArea.addEventListener('click', () => {
                fileInput.click();
            });

            // 文件选择
            fileInput.addEventListener('change', handleFileSelect);

            // 拖拽上传
            fileUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileUploadArea.classList.add('dragover');
            });

            fileUploadArea.addEventListener('dragleave', () => {
                fileUploadArea.classList.remove('dragover');
            });

            fileUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                fileUploadArea.classList.remove('dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    handleFileSelect({ target: { files } });
                }
            });
        }

        /**
         * 处理文件选择
         */
        async function handleFileSelect(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                showFilePreview(file.name, content);
                
                // 根据文件类型设置到对应的输入区域
                if (file.name.endsWith('.txt')) {
                    // 切换到文本导入标签页
                    switchToTab('text');
                    textarea.value = content;
                } else if (file.name.endsWith('.json')) {
                    // 切换到文本导入标签页，设置为混合模式
                    switchToTab('text');
                    const jsonRadio = modalElement.querySelector('input[name="textImportType"][value="mixed"]');
                    if (jsonRadio) jsonRadio.checked = true;
                    textarea.value = content;
                } else if (file.name.endsWith('.csv')) {
                    // 切换到CSV标签页
                    switchToTab('csv');
                    textarea.value = content;
                }
            };
            reader.readAsText(file);
        }

        /**
         * 显示文件预览
         */
        function showFilePreview(fileName, content) {
            filePreview.style.display = 'block';
            const previewContent = filePreview.querySelector('.preview-content');
            const truncatedContent = content.length > 1000 
                ? content.substring(0, 1000) + '\n...(内容已截断，显示前1000字符)'
                : content;
            previewContent.textContent = `文件: ${fileName}\n\n${truncatedContent}`;
        }

        /**
         * 切换到指定标签页
         */
        function switchToTab(tabName) {
            const targetBtn = modalElement.querySelector(`[data-tab="${tabName}"]`);
            if (targetBtn) {
                targetBtn.click();
            }
        }

        /**
         * 设置数据解析
         */
        function setupDataParsing() {
            parseBtn.addEventListener('click', async () => {
                parseBtn.disabled = true;
                parseBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 解析中...';
                
                try {
                    await parseInputData();
                    showPreview();
                    
                    if (validData.length > 0) {
                        startImportBtn.style.display = 'inline-block';
                        parseBtn.textContent = '重新解析';
                    } else {
                        showToast('没有找到有效的钱包数据', 'warning');
                    }
                } catch (error) {
                    console.error('解析数据失败:', error);
                    showToast(`解析失败: ${error.message}`, 'error');
                } finally {
                    parseBtn.disabled = false;
                    if (parseBtn.innerHTML.includes('spinner')) {
                        parseBtn.textContent = '解析数据';
                    }
                }
            });

            startImportBtn.addEventListener('click', async () => {
                if (validData.length === 0) {
                    showToast('没有有效数据可导入', 'warning');
                    return;
                }

                await performBulkImport();
            });
        }

        /**
         * 解析输入数据
         */
        async function parseInputData() {
            const activeTab = modalElement.querySelector('.tab-content.active').id;
            let rawData = '';

            // 获取原始数据
            if (activeTab === 'text-tab' || activeTab === 'csv-tab') {
                rawData = textarea.value.trim();
            }

            if (!rawData) {
                throw new Error('请输入要解析的数据');
            }

            // 解析数据
            parsedData = [];
            validData = [];
            invalidData = [];
            duplicateData = [];

            const lines = rawData.split('\n').filter(line => line.trim());
            const existingAddresses = await getExistingAddresses();
            const seenAddresses = new Set();

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                try {
                    const walletData = await parseLine(line, activeTab, i + 1);
                    if (walletData) {
                        parsedData.push(walletData);

                        // 验证钱包数据
                        const validation = await validateWalletData(walletData);
                        walletData.validation = validation;

                        if (validation.isValid) {
                            // 检查重复（统一转换为小写进行比较）
                            const normalizedAddress = walletData.address.toLowerCase();
                            const isDuplicate = existingAddresses.has(normalizedAddress) || 
                                             seenAddresses.has(normalizedAddress);
                            
                            if (isDuplicate) {
                                walletData.isDuplicate = true;
                                duplicateData.push(walletData);
                            } else {
                                validData.push(walletData);
                                seenAddresses.add(normalizedAddress);
                            }
                        } else {
                            invalidData.push(walletData);
                        }
                    }
                } catch (error) {
                    invalidData.push({
                        lineNumber: i + 1,
                        rawData: line,
                        error: error.message,
                        validation: { isValid: false, errors: [error.message] }
                    });
                }
            }
        }

        /**
         * 解析单行数据
         */
        async function parseLine(line, activeTab, lineNumber) {
            if (activeTab === 'csv-tab') {
                return await parseCsvLine(line, lineNumber);
            } else {
                return await parseTextLine(line, lineNumber);
            }
        }

        /**
         * 解析文本行
         */
        async function parseTextLine(line, lineNumber) {
            const importType = modalElement.querySelector('input[name="textImportType"]:checked').value;
            const defaultGroup = defaultGroupSelect.value || null;

            let walletData = {
                lineNumber,
                rawData: line,
                groupId: defaultGroup
            };

            if (importType === 'mixed') {
                // 混合格式: pk:0x123... 或 mnemonic:word1 word2...
                if (line.startsWith('pk:') || line.startsWith('privateKey:')) {
                    walletData.privateKey = line.substring(line.indexOf(':') + 1).trim();
                    walletData.type = 'privateKey';
                } else if (line.startsWith('mnemonic:') || line.startsWith('mn:')) {
                    walletData.mnemonic = line.substring(line.indexOf(':') + 1).trim();
                    walletData.type = 'mnemonic';
                } else {
                    // 尝试自动识别
                    if (line.startsWith('0x') && line.length === 66) {
                        walletData.privateKey = line;
                        walletData.type = 'privateKey';
                    } else if (line.split(' ').length >= 12) {
                        walletData.mnemonic = line;
                        walletData.type = 'mnemonic';
                    } else {
                        throw new Error('无法识别数据格式');
                    }
                }
            } else if (importType === 'privateKey') {
                walletData.privateKey = line;
                walletData.type = 'privateKey';
            } else if (importType === 'mnemonic') {
                walletData.mnemonic = line;
                walletData.type = 'mnemonic';
            }

            // 派生地址
            if (walletData.privateKey) {
                walletData.address = await deriveAddressFromPrivateKey(walletData.privateKey);
            } else if (walletData.mnemonic) {
                walletData.address = await deriveAddressFromMnemonic(walletData.mnemonic);
            }

            return walletData;
        }

        /**
         * 解析CSV行
         */
        async function parseCsvLine(line, lineNumber) {
            const parts = parseCSVLine(line);
            const defaultGroup = defaultGroupSelect.value || null;

            let walletData = {
                lineNumber,
                rawData: line,
                groupId: defaultGroup
            };

            // 根据CSV列数判断格式
            if (parts.length >= 3) {
                if (parts[0].toLowerCase() === 'type') {
                    // 格式3: type,data,name,notes,group
                    walletData.type = parts[1];
                    if (walletData.type === 'privateKey') {
                        walletData.privateKey = parts[1];
                    } else if (walletData.type === 'mnemonic') {
                        walletData.mnemonic = parts[1];
                    }
                    walletData.name = parts[2] || null;
                    walletData.notes = parts[3] || null;
                    walletData.groupName = parts[4] || null;
                } else if (parts[0].startsWith('0x')) {
                    // 格式1: privateKey,name,notes,group
                    walletData.privateKey = parts[0];
                    walletData.type = 'privateKey';
                    walletData.name = parts[1] || null;
                    walletData.notes = parts[2] || null;
                    walletData.groupName = parts[3] || null;
                } else {
                    // 格式2: mnemonic,name,notes,group
                    walletData.mnemonic = parts[0];
                    walletData.type = 'mnemonic';
                    walletData.name = parts[1] || null;
                    walletData.notes = parts[2] || null;
                    walletData.groupName = parts[3] || null;
                }

                // 处理分组
                if (walletData.groupName) {
                    const groupId = await findOrCreateGroup(walletData.groupName);
                    walletData.groupId = groupId;
                }
            }

            // 派生地址
            if (walletData.privateKey) {
                walletData.address = await deriveAddressFromPrivateKey(walletData.privateKey);
            } else if (walletData.mnemonic) {
                walletData.address = await deriveAddressFromMnemonic(walletData.mnemonic);
            }

            return walletData;
        }

        /**
         * 解析CSV行（处理引号和逗号）
         */
        function parseCSVLine(line) {
            const result = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            
            result.push(current.trim());
            return result;
        }

        /**
         * 验证钱包数据
         */
        async function validateWalletData(walletData) {
            const errors = [];
            let isValid = true;

            // 验证地址
            if (!walletData.address) {
                errors.push('无法派生钱包地址');
                isValid = false;
            } else if (!isValidEthereumAddress(walletData.address)) {
                errors.push('钱包地址格式无效');
                isValid = false;
            }

            // 验证私钥
            if (walletData.privateKey && !isValidPrivateKey(walletData.privateKey)) {
                errors.push('私钥格式无效');
                isValid = false;
            }

            // 验证助记词
            if (walletData.mnemonic && !isValidMnemonic(walletData.mnemonic)) {
                errors.push('助记词格式无效');
                isValid = false;
            }

            return { isValid, errors };
        }

        /**
         * 获取现有地址集合
         */
        async function getExistingAddresses() {
            try {
                const walletsResult = await window.dbAPI.getWallets();
                const wallets = walletsResult.wallets || walletsResult || [];
                return new Set(wallets.map(w => w.address.toLowerCase()));
            } catch (error) {
                console.error('获取现有钱包失败:', error);
                return new Set();
            }
        }

        /**
         * 查找或创建分组
         */
        async function findOrCreateGroup(groupName) {
            try {
                const groups = await window.dbAPI.getGroups();
                const existingGroup = groups.find(g => g.name === groupName);
                
                if (existingGroup) {
                    return existingGroup.id;
                }

                // 创建新分组
                const newGroup = await window.dbAPI.addGroup({ name: groupName });
                return newGroup.id;
            } catch (error) {
                console.error('处理分组失败:', error);
                return null;
            }
        }

        /**
         * 派生地址（从私钥）
         */
        async function deriveAddressFromPrivateKey(privateKey) {
            try {
                return await window.cryptoAPI.deriveAddressFromPrivateKey(privateKey);
            } catch (error) {
                console.error('从私钥派生地址失败:', error);
                return null;
            }
        }

        /**
         * 派生地址（从助记词）
         */
        async function deriveAddressFromMnemonic(mnemonic) {
            try {
                return await window.cryptoAPI.deriveAddressFromMnemonic(mnemonic);
            } catch (error) {
                console.error('从助记词派生地址失败:', error);
                return null;
            }
        }

        /**
         * 验证以太坊地址格式
         */
        function isValidEthereumAddress(address) {
            return /^0x[a-fA-F0-9]{40}$/.test(address);
        }

        /**
         * 验证私钥格式
         */
        function isValidPrivateKey(privateKey) {
            return /^0x[a-fA-F0-9]{64}$/.test(privateKey);
        }

        /**
         * 验证助记词格式
         */
        function isValidMnemonic(mnemonic) {
            const words = mnemonic.trim().split(/\s+/);
            return words.length === 12 || words.length === 24;
        }

        /**
         * 显示预览
         */
        function showPreview() {
            importPreview.style.display = 'block';

            // 更新统计
            updateStats();

            // 显示预览列表
            const previewList = modalElement.querySelector('#preview-list');
            previewList.innerHTML = '';

            const allData = [...validData, ...invalidData, ...duplicateData];
            allData.slice(0, 50).forEach(item => { // 只显示前50条
                const previewItem = createPreviewItem(item);
                previewList.appendChild(previewItem);
            });

            if (allData.length > 50) {
                const moreItem = document.createElement('div');
                moreItem.className = 'preview-item';
                moreItem.innerHTML = `<div class="preview-data">... 还有 ${allData.length - 50} 条数据</div>`;
                previewList.appendChild(moreItem);
            }
        }

        /**
         * 更新统计信息
         */
        function updateStats() {
            modalElement.querySelector('#total-count').textContent = parsedData.length;
            modalElement.querySelector('#valid-count').textContent = validData.length;
            modalElement.querySelector('#invalid-count').textContent = invalidData.length;
            modalElement.querySelector('#duplicate-count').textContent = duplicateData.length;
        }

        /**
         * 创建预览项
         */
        function createPreviewItem(item) {
            const div = document.createElement('div');
            div.className = 'preview-item';

            let statusClass = 'error';
            let statusText = '错误';

            if (item.validation && item.validation.isValid) {
                if (item.isDuplicate) {
                    statusClass = 'invalid';
                    statusText = '重复';
                } else {
                    statusClass = 'valid';
                    statusText = '有效';
                }
            } else {
                statusClass = 'error';
                statusText = '无效';
            }

            div.classList.add(statusClass);

            const displayData = item.address || item.rawData.substring(0, 50) + '...';
            const errorInfo = item.validation && item.validation.errors.length > 0 
                ? ` (${item.validation.errors[0]})` 
                : '';

            div.innerHTML = `
                <div class="preview-data">第${item.lineNumber}行: ${displayData}${errorInfo}</div>
                <div class="preview-status ${statusClass}">${statusText}</div>
            `;

            return div;
        }

        /**
         * 执行批量导入
         */
        async function performBulkImport() {
            if (validData.length === 0) {
                showToast('没有有效数据可导入', 'warning');
                return;
            }

            // 显示进度
            importProgress.style.display = 'block';
            startImportBtn.disabled = true;
            startImportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 导入中...';

            const progressFill = modalElement.querySelector('.progress-fill');
            const progressCurrent = modalElement.querySelector('#progress-current');
            const progressTotal = modalElement.querySelector('#progress-total');
            const progressPercentage = modalElement.querySelector('#progress-percentage');
            const progressDetails = modalElement.querySelector('#progress-details');

            progressTotal.textContent = validData.length;
            progressCurrent.textContent = '0';
            progressPercentage.textContent = '0';
            progressDetails.innerHTML = '';

            let successCount = 0;
            let errorCount = 0;
            const errors = [];

            try {
                for (let i = 0; i < validData.length; i++) {
                    const walletData = validData[i];
                    
                    try {
                        // 加密敏感数据
                        const dataToSave = {
                            address: walletData.address.toLowerCase(), // 确保地址以小写形式保存
                            name: walletData.name || null,
                            notes: walletData.notes || null,
                            groupId: walletData.groupId,
                            derivationPath: walletData.derivationPath || null
                        };

                        if (walletData.privateKey) {
                            dataToSave.encryptedPrivateKey = await window.electron.ipcRenderer.invoke(
                                'app:encryptData', 
                                walletData.privateKey
                            );
                        }

                        if (walletData.mnemonic) {
                            dataToSave.encryptedMnemonic = await window.electron.ipcRenderer.invoke(
                                'app:encryptData', 
                                walletData.mnemonic
                            );
                        }

                        await window.dbAPI.addWallet(dataToSave);
                        successCount++;
                        
                        const logEntry = `✓ 第${walletData.lineNumber}行: ${walletData.address}\n`;
                        progressDetails.innerHTML += logEntry;
                        
                    } catch (error) {
                        errorCount++;
                        const errorMsg = `✗ 第${walletData.lineNumber}行: ${error.message}`;
                        errors.push(errorMsg);
                        progressDetails.innerHTML += errorMsg + '\n';
                        console.error(`导入钱包失败 (第${walletData.lineNumber}行):`, error);
                    }

                    // 更新进度
                    const progress = ((i + 1) / validData.length) * 100;
                    progressFill.style.width = `${progress}%`;
                    progressCurrent.textContent = i + 1;
                    progressPercentage.textContent = Math.round(progress);

                    // 滚动到底部
                    progressDetails.scrollTop = progressDetails.scrollHeight;

                    // 短暂延迟以显示进度
                    await new Promise(resolve => setTimeout(resolve, 50));
                }

                // 完成提示
                let message = `批量导入完成！\n成功: ${successCount} 个\n失败: ${errorCount} 个`;
                if (errors.length > 0) {
                    message += `\n\n错误详情:\n${errors.slice(0, 5).join('\n')}`;
                    if (errors.length > 5) {
                        message += `\n... 还有 ${errors.length - 5} 个错误`;
                    }
                }

                showToast(message, errorCount > 0 ? 'warning' : 'success', 8000);

                // 刷新钱包列表
                await loadAndRenderWallets();

                // 如果全部成功，关闭模态框
                if (errorCount === 0) {
                    setTimeout(() => {
                        hideModal();
                    }, 2000);
                } else {
                    // 重置按钮状态以便重试
                    startImportBtn.disabled = false;
                    startImportBtn.innerHTML = '重新导入失败项';
                }

            } catch (error) {
                console.error('批量导入过程中发生错误:', error);
                showToast(`导入过程发生错误: ${error.message}`, 'error');
                startImportBtn.disabled = false;
                startImportBtn.innerHTML = '开始导入';
            }
        }

        /**
         * 设置CSV模板下载
         */
        function setupCsvTemplate() {
            downloadCsvBtn.addEventListener('click', () => {
                const csvContent = `type,data,name,notes,group
privateKey,0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef,示例钱包1,这是一个示例钱包,测试组
mnemonic,"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",示例钱包2,助记词钱包示例,主账户组`;

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'bulk_import_template.csv';
                link.click();
                URL.revokeObjectURL(link.href);

                showToast('CSV模板已下载', 'success');
            });
        }

        /**
         * 重置预览
         */
        function resetPreview() {
            importPreview.style.display = 'none';
            importProgress.style.display = 'none';
            startImportBtn.style.display = 'none';
            parseBtn.textContent = '解析数据';
            parsedData = [];
            validData = [];
            invalidData = [];
            duplicateData = [];
        }
    });
} 