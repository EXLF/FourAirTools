// ================= 设置页面初始化 =================

/**
 * 初始化设置页面。
 * @param {HTMLElement} contentArea - 主要的内容区域。
 */
export function initSettingsPage(contentArea) {
    console.log("Initializing Settings Page...");

    // --- 通用设置 --- 
    // (此处可添加语言、主题选择的加载和保存逻辑)

    // --- 数据与备份 --- 
    const exportBtn = contentArea.querySelector('.card:nth-child(2) .btn-secondary:nth-of-type(1)');
    if(exportBtn) {
        exportBtn.addEventListener('click', () => alert('导出配置数据 (未实现)'));
    }

    const importBtn = contentArea.querySelector('.card:nth-child(2) .btn-secondary:nth-of-type(2)');
    if(importBtn) {
        importBtn.addEventListener('click', () => alert('导入配置数据 (未实现)'));
    }

    // --- 网络设置 --- 
    const ipQueryChannelSelect = contentArea.querySelector('#ip-query-channel');
    if (ipQueryChannelSelect) {
        // TODO: 从存储中加载当前设置并选中对应的选项
        // const currentChannel = settingsAPI.get('network.ipQueryChannel'); // 假设有 settingsAPI
        // ipQueryChannelSelect.value = currentChannel || 'ip-api'; // 默认值

        ipQueryChannelSelect.addEventListener('change', () => {
            const selectedChannel = ipQueryChannelSelect.value;
            console.log(`IP 查询渠道已更改为: ${selectedChannel}`);
            // TODO: 调用保存设置的函数
            // settingsAPI.set('network.ipQueryChannel', selectedChannel);
        });
    } else {
        console.warn('#ip-query-channel select not found.');
    }

    // --- 关于 --- 
    const updateLink = contentArea.querySelector('.card:nth-child(4) a'); // 更新选择器索引
    if (updateLink) {
        updateLink.addEventListener('click', (e) => {
            e.preventDefault();
            alert('检查更新 (未实现)');
        });
    } else {
        console.warn('Update link not found in About card.');
    }
} 