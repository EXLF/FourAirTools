// 模态框处理模块

import { showModal, hideModal } from '../../../components/modal.js';
import { showToast } from '../../../components/toast.js';
import { parseProxyList } from './import-export.js';

// 打开添加/编辑代理的模态框
export function openProxyModal(proxyData = null) {
    showModal('tpl-modal-proxy-form', (modalElement) => {
        const form = modalElement.querySelector('#proxy-form');
        const title = modalElement.querySelector('.modal-title');
        const saveBtn = modalElement.querySelector('#modal-save-proxy-btn');
        const batchImportBtn = modalElement.querySelector('#batch-import-btn');
        const batchImportTextarea = modalElement.querySelector('#proxy-batch-import');
        const batchImportSection = modalElement.querySelector('.form-section');

        // 重置表单
        form.reset();
        
        if (proxyData) {
            // 编辑模式
            console.log('正在编辑代理', proxyData);
            title.textContent = '编辑代理配置';
            
            // 设置表单字段值
            if (form.elements['id']) form.elements['id'].value = proxyData.id || '';
            if (form.elements['type']) form.elements['type'].value = proxyData.type || 'HTTP';
            if (form.elements['host']) form.elements['host'].value = proxyData.host || '';
            if (form.elements['port']) form.elements['port'].value = proxyData.port || '';
            if (form.elements['username']) form.elements['username'].value = proxyData.username || '';
            if (form.elements['password']) {
                form.elements['password'].value = proxyData.password || '';
                form.elements['password'].placeholder = '留空则不修改密码';
            }
            
            if (form.elements['name'] && proxyData.name) {
                form.elements['name'].value = proxyData.name;
            }
            
            // 编辑模式不显示批量导入区域
            if (batchImportSection) {
                batchImportSection.style.display = 'none';
            }
        } else {
            // 添加模式
            title.textContent = '添加代理配置';
            if (form.elements['id']) form.elements['id'].value = '';
            if (form.elements['password']) {
                form.elements['password'].placeholder = '输入密码 (可选)';
            }
            
            // 添加模式显示批量导入区域
            if (batchImportSection) {
                batchImportSection.style.display = 'block';
            }
        }

        // 批量导入按钮点击事件
        if (batchImportBtn && batchImportTextarea) {
            batchImportBtn.onclick = () => handleBatchImport(batchImportTextarea.value);
        }

        // 保存按钮事件
        saveBtn.onclick = () => handleProxyFormSubmit(form, proxyData);
    });
}

// 处理批量导入
async function handleBatchImport(content) {
    if (!content || content.trim() === '') {
        showToast('请输入要导入的代理配置', 'warning');
        return;
    }

    const proxies = parseProxyList(content);
    if (proxies.length === 0) {
        showToast('未能解析出有效的代理配置，请检查格式', 'error');
        return;
    }

    // 显示导入确认对话框
    showModal('tpl-confirm-dialog', (modalElement) => {
        const messageElement = modalElement.querySelector('.confirm-message');
        const confirmBtn = modalElement.querySelector('.modal-confirm-btn');
        const titleElement = modalElement.querySelector('.modal-title');

        if (!messageElement || !confirmBtn || !titleElement) {
            console.error("确认框元素缺失");
            hideModal();
            return;
        }

        titleElement.textContent = '确认批量导入代理';
        messageElement.textContent = `发现 ${proxies.length} 个代理配置，是否导入？`;
        
        // 创建代理列表预览
        const previewContainer = document.createElement('div');
        previewContainer.style.cssText = 'margin-top:10px;font-size:0.9em;color:#666;';
        
        const previewHTML = `
            <p>将导入以下代理：</p>
            <div style="max-height:150px;overflow-y:auto;background:#f8f9fa;padding:8px;border-radius:4px;font-family:monospace;font-size:12px;">
                ${proxies.map((p, index) => 
                    `<div>${index+1}. ${p.type || 'HTTP'}://${p.host}:${p.port}${p.username ? ' (用户名: ' + p.username + ')' : ''}</div>`
                ).join('')}
            </div>
        `;
        
        previewContainer.innerHTML = previewHTML;
        messageElement.appendChild(previewContainer);
        
        confirmBtn.textContent = `确认导入 (${proxies.length})`;
        confirmBtn.classList.remove('btn-danger');
        confirmBtn.classList.add('btn-primary');

        const handleConfirm = async () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = `<i class="fa fa-spinner fa-spin"></i> 导入中...`;

            try {
                let successCount = 0;
                let errorCount = 0;
                const errors = [];

                for (const proxy of proxies) {
                    try {
                        await window.dbAPI.addProxy({
                            type: proxy.type || 'HTTP',
                            host: proxy.host,
                            port: proxy.port,
                            username: proxy.username || null,
                            password: proxy.password || null,
                            group_id: null
                        });
                        successCount++;
                    } catch (err) {
                        errorCount++;
                        errors.push(`${proxy.host}:${proxy.port} - ${err.message}`);
                    }
                }

                if (errorCount > 0) {
                    showToast(`导入完成: ${successCount} 成功, ${errorCount} 失败`, 'warning');
                    console.error('导入错误:', errors);
                } else {
                    showToast(`成功导入 ${successCount} 个代理`, 'success');
                }

                hideModal(); // 关闭确认对话框
                hideModal(); // 关闭添加代理对话框
                
                // 派发事件通知列表需要更新
                document.dispatchEvent(new CustomEvent('proxy-list-updated'));
            } catch (error) {
                console.error('导入代理失败:', error);
                showToast(`导入失败: ${error.message}`, 'error');
                confirmBtn.disabled = false;
                confirmBtn.textContent = '重试导入';
            }
        };

        confirmBtn.addEventListener('click', handleConfirm);
    });
}

// 处理代理表单提交
export async function handleProxyFormSubmit(form, proxyData) {
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const formData = new FormData(form);
    const data = {};
    let hasPassword = false;
    formData.forEach((value, key) => {
        // 跳过批量导入字段
        if (key === 'batchImport') {
            return;
        }
        
        if (key === 'password') {
            if (value.trim() !== '') {
                data[key] = value;
                hasPassword = true;
            }
        } else {
            data[key] = value;
        }
    });

    data.port = parseInt(data.port, 10);
    const isEditing = !!data.id;

    try {
        if (isEditing) {
            data.id = parseInt(data.id, 10);
            await window.dbAPI.updateProxy(data.id, data);
            showToast('代理配置已更新', 'success');
        } else {
            delete data.id;
            await window.dbAPI.addProxy(data);
            showToast('代理配置已添加', 'success');
        }
        hideModal();
        // 派发事件通知列表需要更新
        document.dispatchEvent(new CustomEvent('proxy-list-updated')); 
        // 需要在外部调用 loadProxies() 刷新列表
    } catch (error) {
        console.error('保存代理配置失败:', error);
        let userMessage = '保存失败，请检查输入是否正确';
        if (error.message.includes('already exists') || error.message.includes('已存在')) {
            userMessage = '该IP地址已存在，请勿重复添加';
        } else if (error.message.includes('required') || error.message.includes('缺少')) {
            userMessage = '请填写所有必填项';
        }
        showToast(userMessage, 'error');
    }
} 