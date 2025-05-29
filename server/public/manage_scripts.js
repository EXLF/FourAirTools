document.addEventListener('DOMContentLoaded', () => {
    const scriptsTableBody = document.getElementById('scripts-list-body');
    const noScriptsMessage = document.getElementById('no-scripts-message');
    const uploadForm = document.getElementById('upload-script-form');
    const scriptModal = document.getElementById('script-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const metadataForm = document.getElementById('script-metadata-form');
    const modalTitle = document.getElementById('modal-title');
    const toastMessage = document.getElementById('toast-message');
    
    // 删除确认模态框元素
    const deleteModal = document.getElementById('delete-confirmation-modal');
    const closeDeleteModalBtn = document.getElementById('close-delete-modal-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const deleteScriptNameEl = document.getElementById('delete-script-name');
    
    let scriptToDelete = null; // 当前准备删除的脚本
    
    let currentScripts = []; // 存储从 manifest 加载的脚本
    let editingScript = null; // 当前正在编辑的脚本对象

    const API_BASE_URL = ''; // 使用相对路径，因为此页面由同一服务器提供服务

    // --- Toast 通知 --- 
    let toastTimeout = null;
    function showToast(message, type = 'info', duration = 3000) {
        toastMessage.textContent = message;
        toastMessage.className = `toast show ${type}`;
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toastMessage.className = toastMessage.className.replace('show', '');
        }, duration);
    }

    // --- 加载和渲染脚本列表 --- 
    async function fetchAndRenderScripts() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/scripts/manifest`);
            if (!response.ok) {
                throw new Error(`获取 manifest 失败: ${response.statusText}`);
            }
            const manifest = await response.json();
            currentScripts = manifest.scripts || [];
            renderScriptsTable();
        } catch (error) {
            console.error('获取脚本 manifest 错误:', error);
            showToast(`加载脚本列表失败: ${error.message}`, 'error');
            scriptsTableBody.innerHTML = '';
            noScriptsMessage.style.display = 'block';
            noScriptsMessage.textContent = '加载脚本列表失败。';
        }
    }

    function renderScriptsTable() {
        scriptsTableBody.innerHTML = ''; // 清空现有行
        if (currentScripts.length === 0) {
            noScriptsMessage.style.display = 'block';
            noScriptsMessage.textContent = '暂无脚本。请上传新脚本或检查 manifest 文件。'
            return;
        }
        noScriptsMessage.style.display = 'none';

        currentScripts.forEach(script => {
            const row = scriptsTableBody.insertRow();
            row.innerHTML = `
                <td>${script.id}</td>
                <td>${script.name}</td>
                <td>${script.version}</td>
                <td>${script.filename}</td>
                <td>${script.description.substring(0, 50)}${script.description.length > 50 ? '...' : ''}</td>
                <td class="actions">
                    <button class="edit-btn" data-script-id="${script.id}">编辑元数据</button>
                    <button class="delete-btn" data-script-id="${script.id}">删除</button>
                </td>
            `;
        });
    }

    // --- 模态框处理 --- 
    function openModal(scriptData = null, isNewAfterUpload = false, uploadedFilename = null) {
        metadataForm.reset();
        editingScript = scriptData;
        document.getElementById('edit-script-is-new').value = scriptData ? 'false' : 'true';
        
        if (scriptData) { // 编辑现有
            modalTitle.textContent = '编辑脚本元数据';
            document.getElementById('script-id').value = scriptData.id;
            document.getElementById('script-id').readOnly = true; // ID 通常不应更改
            document.getElementById('edit-script-original-id').value = scriptData.id;
            document.getElementById('script-name').value = scriptData.name;
            document.getElementById('script-version').value = scriptData.version;
            document.getElementById('script-description').value = scriptData.description;
            document.getElementById('script-author').value = scriptData.author || '';
            document.getElementById('script-category').value = scriptData.category || '';
            document.getElementById('script-filename').value = scriptData.filename;
            document.getElementById('script-filename').readOnly = true; // 文件名通常不应更改
            document.getElementById('script-checksum').value = scriptData.checksum || 'N/A';
            document.getElementById('script-lastModified').value = scriptData.lastModified || 'N/A';
        } else { // 新增 (可能在上传后)
            modalTitle.textContent = '添加新脚本元数据';
            document.getElementById('script-id').readOnly = false;
            document.getElementById('edit-script-original-id').value = '';
            if (uploadedFilename) {
                document.getElementById('script-filename').value = uploadedFilename;
                document.getElementById('script-filename').readOnly = true;
                // 尝试从文件名预填ID和名称
                const baseName = uploadedFilename.replace(/\.js$/i, '');
                document.getElementById('script-id').value = baseName.toLowerCase().replace(/[^a-z0-9_]/gi, '_');
                document.getElementById('script-name').value = baseName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            }
            document.getElementById('script-checksum').value = '上传后自动生成/校验';
            document.getElementById('script-lastModified').value = '保存时自动更新';
        }
        scriptModal.classList.add('show');
    }

    function closeModal() {
        scriptModal.classList.remove('show');
        editingScript = null;
    }

    closeModalBtn.addEventListener('click', closeModal);
    scriptModal.addEventListener('click', (event) => {
        if (event.target === scriptModal) closeModal();
    });

    // --- 文件上传处理 --- 
    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(uploadForm);
        const scriptFile = formData.get('scriptFile');

        if (!scriptFile || scriptFile.name === '') {
            showToast('请选择一个脚本文件。', 'error');
            return;
        }

        showToast('正在上传脚本...', 'info');
        try {
            const response = await fetch(`${API_BASE_URL}/api/scripts/upload`, {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || `上传失败: ${response.statusText}`);
            }
            showToast('脚本上传成功！文件名: ' + result.filename, 'success');
            uploadForm.reset();
            // 上传成功后，打开元数据模态框让用户填写/确认信息
            openModal(null, true, result.filename); 
            // fetchAndRenderScripts(); // 选择在元数据保存后再刷新列表
        } catch (error) {
            console.error('上传脚本错误:', error);
            showToast(`上传脚本失败: ${error.message}`, 'error');
        }
    });

    // --- 元数据表单提交 --- 
    metadataForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const isNew = document.getElementById('edit-script-is-new').value === 'true';
        const originalId = document.getElementById('edit-script-original-id').value;

        const formData = new FormData(metadataForm);
        const scriptData = {};
        formData.forEach((value, key) => scriptData[key] = value);
        
        // 对于manifest，我们不需要这些客户端填充的占位符
        delete scriptData.checksum; 
        delete scriptData.lastModified;

        console.log('Submitting metadata:', scriptData, 'Is new:', isNew, 'Original ID:', originalId);

        try {
            const response = await fetch(`${API_BASE_URL}/api/scripts/update_manifest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    script: scriptData, 
                    isNew: isNew, // 后端需要知道是新增还是更新 
                    originalId: isNew ? null : originalId // 如果是更新，传递原始ID
                }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || `保存元数据失败: ${response.statusText}`);
            }
            showToast('脚本元数据保存成功!', 'success');
            closeModal();
            fetchAndRenderScripts(); // 刷新列表
        } catch (error) {
            console.error('保存元数据错误:', error);
            showToast(`保存元数据失败: ${error.message}`, 'error');
        }
    });

    // --- 删除脚本模态框控制 ---
    function openDeleteModal(script) {
        scriptToDelete = script;
        if (script) {
            deleteScriptNameEl.textContent = `${script.name} (${script.id})`;
            deleteModal.classList.add('show');
        }
    }
    
    function closeDeleteModal() {
        deleteModal.classList.remove('show');
        scriptToDelete = null;
    }
    
    // 关闭删除模态框按钮
    closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    deleteModal.addEventListener('click', (event) => {
        if (event.target === deleteModal) closeDeleteModal();
    });
    
    // 确认删除按钮
    confirmDeleteBtn.addEventListener('click', () => {
        if (scriptToDelete) {
            deleteScript(scriptToDelete.id);
            closeDeleteModal();
        }
    });

    // --- 事件委托：编辑按钮和删除按钮 --- 
    scriptsTableBody.addEventListener('click', (event) => {
        if (event.target.classList.contains('edit-btn')) {
            const scriptId = event.target.dataset.scriptId;
            const scriptToEdit = currentScripts.find(s => s.id === scriptId);
            if (scriptToEdit) {
                openModal(scriptToEdit);
            } else {
                showToast('找不到要编辑的脚本信息。', 'error');
            }
        } else if (event.target.classList.contains('delete-btn')) {
            const scriptId = event.target.dataset.scriptId;
            const script = currentScripts.find(s => s.id === scriptId);
            if (script) {
                openDeleteModal(script);
            } else {
                showToast('找不到要删除的脚本信息。', 'error');
            }
        }
    });

    // --- 删除脚本 ---
    async function deleteScript(scriptId) {
        showToast('正在删除脚本...', 'info');
        try {
            const response = await fetch(`${API_BASE_URL}/api/scripts/${scriptId}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || `删除失败: ${response.statusText}`);
            }
            
            // 提示客户端需要同步清理本地文件
            const successMessage = `
                <div>
                    <p>脚本删除成功！</p>
                    <p>客户端本地脚本将在下次启动时自动清理。</p>
                    <p>如果您希望立即同步客户端，请在客户端应用中执行以下操作：</p>
                    <ol>
                        <li>转到任意脚本列表页面</li>
                        <li>点击"刷新列表"按钮</li>
                    </ol>
                    <p><small>(这将触发脚本同步并清理已删除的脚本)</small></p>
                </div>
            `;
            
            toastMessage.innerHTML = successMessage;
            toastMessage.className = `toast show success wide`;
            if (toastTimeout) clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
                toastMessage.className = toastMessage.className.replace('show', '');
                // 重置回纯文本
                setTimeout(() => { toastMessage.innerHTML = ''; }, 300);
            }, 10000); // 显示10秒钟
            
            fetchAndRenderScripts(); // 重新加载脚本列表
        } catch (error) {
            console.error('删除脚本错误:', error);
            showToast(`删除脚本失败: ${error.message}`, 'error');
        }
    }

    // --- 初始加载 ---
    fetchAndRenderScripts();
}); 