// 代理相关模块

/**
 * 设置代理选择界面和交互
 * @param {HTMLElement} container - 详情页面容器元素
 */
export function setupProxySelection(container) {
    const directRadio = container.querySelector('#directConnection');
    const proxyRadio = container.querySelector('#proxyConnection');
    const proxySettings = container.querySelector('.proxy-settings');
    const proxySelect = container.querySelector('#proxySelect');
    const proxyInfo = container.querySelector('#proxyInfo');
    
    if (!directRadio || !proxyRadio || !proxySettings || !proxySelect) {
        console.error('代理设置相关元素未找到');
        return;
    }
    
    // 加载代理列表
    loadProxyList(proxySelect, proxyInfo);
    
    // 显示/隐藏代理设置
    directRadio.addEventListener('change', () => {
        if (directRadio.checked) {
            proxySettings.style.display = 'none';
        }
    });
    
    proxyRadio.addEventListener('change', () => {
        if (proxyRadio.checked) {
            proxySettings.style.display = '';
            // 如果列表为空，尝试重新加载
            if (proxySelect.options.length <= 1) {
                loadProxyList(proxySelect, proxyInfo);
            }
        }
    });
    
    // 代理选择变化时更新信息显示
    proxySelect.addEventListener('change', () => {
        const selectedOption = proxySelect.options[proxySelect.selectedIndex];
        if (selectedOption && selectedOption.value) {
            const proxyId = selectedOption.value;
            const proxyData = selectedOption.dataset;
            
            // 显示代理信息
            if (proxyData.host && proxyData.port) {
                let infoHtml = `<div class="proxy-details">`;
                infoHtml += `<span class="proxy-host">${proxyData.host}:${proxyData.port}</span>`;
                
                if (proxyData.type) {
                    infoHtml += `<span class="proxy-type">[${proxyData.type}]</span>`;
                }
                
                if (proxyData.country) {
                    infoHtml += `<span class="proxy-location">${proxyData.country}${proxyData.city ? '-' + proxyData.city : ''}</span>`;
                }
                
                infoHtml += `</div>`;
                proxyInfo.innerHTML = infoHtml;
            } else {
                proxyInfo.innerHTML = '';
            }
        } else {
            proxyInfo.innerHTML = '';
        }
    });
}

/**
 * 从后端加载代理列表
 * @param {HTMLSelectElement} selectElement - 代理选择下拉框元素
 * @param {HTMLElement} infoElement - 代理信息显示元素
 */
async function loadProxyList(selectElement, infoElement) {
    if (!selectElement) return;
    
    // 重置选择框状态
    selectElement.disabled = true;
    selectElement.innerHTML = '<option value="">加载代理列表中...</option>';
    infoElement.innerHTML = '';
    
    try {
        // 调用API获取代理列表
        const options = {
            limit: 100,  // 最多获取100个代理
            sortBy: 'status',
            sortOrder: 'ASC',
            status: '可用'  // 只获取可用的代理
        };
        
        const result = await window.electron.ipcRenderer.invoke('db:getProxies', options);
        
        // 解析结果
        let proxies = [];
        if (result && result.proxies && Array.isArray(result.proxies)) {
            proxies = result.proxies;
        } else if (Array.isArray(result)) {
            proxies = result;
        } else if (result && result.data && Array.isArray(result.data)) {
            proxies = result.data;
        }
        
        // 更新选择框
        if (proxies.length > 0) {
            // 创建选项元素
            const options = proxies.map(proxy => {
                // 格式化显示文本
                const label = `${proxy.name || '#' + proxy.id} - ${proxy.host}:${proxy.port} [${proxy.type}]${proxy.country ? ' - ' + proxy.country : ''}`;
                
                // 创建选项
                const option = document.createElement('option');
                option.value = proxy.id;
                option.textContent = label;
                
                // 存储代理详细信息
                option.dataset.host = proxy.host;
                option.dataset.port = proxy.port;
                option.dataset.type = proxy.type;
                option.dataset.country = proxy.country || '';
                option.dataset.city = proxy.city || '';
                
                return option;
            });
            
            // 添加默认选项
            selectElement.innerHTML = '<option value="">请选择代理</option>';
            
            // 添加代理选项
            options.forEach(option => {
                selectElement.appendChild(option);
            });
            
            console.log(`加载了 ${proxies.length} 个代理`);
        } else {
            selectElement.innerHTML = '<option value="">没有可用代理</option>';
            console.log('没有找到可用的代理');
        }
    } catch (error) {
        console.error('加载代理列表出错:', error);
        selectElement.innerHTML = '<option value="">加载失败</option>';
    } finally {
        selectElement.disabled = false;
    }
} 