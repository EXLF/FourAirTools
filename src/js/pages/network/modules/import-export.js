// 导入导出模块

import { showModal, hideModal } from '../../../components/modal.js';
import { showToast } from '../../../components/toast.js';
import { isValidIP, isValidPort, downloadTextFile } from './utils.js';

// 处理导入代理
export function handleImportClick(loadProxies) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt,.csv';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    fileInput.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) {
            document.body.removeChild(fileInput);
            return;
        }

        try {
            const content = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(new Error('读取文件失败'));
                reader.readAsText(file);
            });

            const proxies = parseProxyList(content);
            if (proxies.length === 0) {
                showToast('未找到有效的代理配置', 'warning');
                document.body.removeChild(fileInput);
                return;
            }

            showImportConfirmDialog(proxies, loadProxies);
        } catch (error) {
            console.error('处理文件失败:', error);
            showToast(`处理文件失败: ${error.message}`, 'error');
        } finally {
            document.body.removeChild(fileInput);
        }
    };

    fileInput.click();
}

// 显示导入确认对话框
function showImportConfirmDialog(proxies, loadProxies) {
    showModal('tpl-confirm-dialog', (modalElement) => {
        const messageElement = modalElement.querySelector('.confirm-message');
        const confirmBtn = modalElement.querySelector('.modal-confirm-btn');
        const titleElement = modalElement.querySelector('.modal-title');

        if (!messageElement || !confirmBtn || !titleElement) {
            console.error("确认框元素缺失");
            hideModal();
            return;
        }

        titleElement.textContent = '确认导入代理';
        messageElement.textContent = `发现 ${proxies.length} 个代理配置，是否导入？`;
        messageElement.innerHTML += `<div style="margin-top:10px;font-size:0.9em;color:#666;">
            <p>支持格式：</p>
            <p>1. IP:端口</p>
            <p>2. IP:端口:用户名:密码</p>
            <p>3. 协议类型:IP:端口:用户名:密码</p>
            <p>注：如不指定协议类型，默认为HTTP</p>
        </div>`;
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

                hideModal();
                // 刷新列表
                if (typeof loadProxies === 'function') {
                    loadProxies();
                }
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

// 解析代理列表文本内容
export function parseProxyList(content, defaultType = 'HTTP') {
    const proxies = [];
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const parts = trimmed.split(':');
        if (parts.length < 2) {
            console.warn(`跳过无效的代理配置: ${trimmed} (格式错误)`);
            continue;
        }

        const hasProtocol = !isValidIP(parts[0]);
        let proxy = {};

        if (hasProtocol) {
            if (parts.length < 3) {
                console.warn(`跳过无效的代理配置: ${trimmed} (缺少必要参数)`);
                continue;
            }
            proxy.type = parts[0].toUpperCase();
            proxy.host = parts[1];
            proxy.port = parseInt(parts[2], 10);
            if (parts.length >= 5) {
                proxy.username = parts[3] || null;
                proxy.password = parts[4] || null;
            }
        } else {
            proxy.type = defaultType;
            proxy.host = parts[0];
            proxy.port = parseInt(parts[1], 10);
            if (parts.length >= 4) {
                proxy.username = parts[2] || null;
                proxy.password = parts[3] || null;
            }
        }

        if (!isValidIP(proxy.host)) {
            console.warn(`跳过无效的代理配置: ${trimmed} (IP地址无效)`);
            continue;
        }
        if (!isValidPort(proxy.port)) {
            console.warn(`跳过无效的代理配置: ${trimmed} (端口号无效)`);
            continue;
        }

        proxies.push(proxy);
    }

    return proxies;
}

// 处理导出代理
export function handleExportClick(loadProxies) {
    showModal('tpl-confirm-dialog', async (modalElement) => {
        const messageElement = modalElement.querySelector('.confirm-message');
        const confirmBtn = modalElement.querySelector('.modal-confirm-btn');
        const titleElement = modalElement.querySelector('.modal-title');
        const modalContent = modalElement.querySelector('.modal-content');

        if (!messageElement || !confirmBtn || !titleElement || !modalContent) {
            console.error("确认对话框元素缺失");
            hideModal();
            return;
        }

        titleElement.textContent = '导出代理配置';
        
        const exportOptions = document.createElement('div');
        exportOptions.className = 'export-options';
        exportOptions.style.marginTop = '15px';
        
        const exportSelection = document.createElement('div');
        exportSelection.className = 'form-group';
        exportSelection.innerHTML = `
            <label>
                <input type="radio" name="export-selection" value="all" checked>
                导出全部代理
            </label>
        `;

        const decryptionOption = document.createElement('div');
        decryptionOption.className = 'form-group';
        decryptionOption.style.marginTop = '10px';
        decryptionOption.innerHTML = `
            <label>
                <input type="checkbox" name="decrypt-passwords" checked>
                勾选导出账户密码，未勾选则只导出IP端口
            </label>
        `;

        exportOptions.appendChild(exportSelection);
        exportOptions.appendChild(decryptionOption);
        
        messageElement.textContent = '请选择导出选项:';
        modalContent.appendChild(exportOptions);

        confirmBtn.textContent = '确认导出';
        confirmBtn.classList.remove('btn-danger');
        confirmBtn.classList.add('btn-primary');

        const handleConfirm = async () => {
            const needDecryption = modalElement.querySelector('input[name="decrypt-passwords"]').checked;

            confirmBtn.removeEventListener('click', handleConfirm);
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 处理中...';

            try {
                const result = await window.dbAPI.getProxies({
                    sortBy: 'id',
                    sortOrder: 'asc',
                    limit: 99999
                });
                const proxies = result.proxies;

                if (!needDecryption) {
                    for (const proxy of proxies) {
                        proxy.password = null;
                    }
                }

                const content = formatProxiesForExport(proxies, needDecryption);
                downloadTextFile(content, 'proxies_export.txt');
                hideModal();
                showToast(`成功导出 ${proxies.length} 个代理配置`, 'success');
                
                // 刷新列表
                if (typeof loadProxies === 'function') {
                    loadProxies();
                }
            } catch (error) {
                console.error('导出代理失败:', error);
                showToast(`导出失败: ${error.message}`, 'error');
                confirmBtn.disabled = false;
                confirmBtn.textContent = '重试导出';
            }
        };

        confirmBtn.addEventListener('click', handleConfirm);
    });
}

// 格式化代理数据为导出格式
function formatProxiesForExport(proxies, includeAuth) {
    let content = '# FourAir IP代理导出\n';
    content += `# 导出时间: ${new Date().toLocaleString()}\n`;
    content += '# 格式: 协议类型:ip:端口:用户名:密码\n';
    content += '#\n\n';

    proxies.forEach(proxy => {
        let line = `${proxy.type || 'HTTP'}:${proxy.host}:${proxy.port}`;
        
        if (includeAuth) {
            const username = proxy.username || '';
            const password = proxy.password || '';
            line += `:${username}:${password}`;
        }
        
        content += line + '\n';
    });

    return content;
} 