// 模态框处理模块

import { showModal, hideModal } from '../../../components/modal.js';
import { showToast } from '../../../components/toast.js';

// 打开添加/编辑代理的模态框
export function openProxyModal(proxyData = null) {
    showModal('tpl-modal-proxy-form', (modalElement) => {
        const form = modalElement.querySelector('#proxy-form');
        const title = modalElement.querySelector('.modal-title');
        const saveBtn = modalElement.querySelector('#modal-save-proxy-btn');

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
        } else {
            // 添加模式
            title.textContent = '添加代理配置';
            if (form.elements['id']) form.elements['id'].value = '';
            if (form.elements['password']) {
                form.elements['password'].placeholder = '输入密码 (可选)';
            }
        }

        // 保存按钮事件
        saveBtn.onclick = () => handleProxyFormSubmit(form, proxyData);
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