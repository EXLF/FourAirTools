document.addEventListener('DOMContentLoaded', () => {
    const updateStatusEl = document.getElementById('update-status');
    const downloadUpdateBtn = document.getElementById('download-update-btn');
    const installUpdateBtn = document.getElementById('install-update-btn');

    if (!updateStatusEl || !downloadUpdateBtn || !installUpdateBtn) {
        console.error('Updater UI elements not found in HTML.');
        return;
    }

    // 监听主进程的更新状态消息
    window.electron.ipcRenderer.on('update-checking', () => {
        updateStatusEl.textContent = '正在检查更新...';
        downloadUpdateBtn.style.display = 'none';
        installUpdateBtn.style.display = 'none';
    });

    window.electron.ipcRenderer.on('update-available', (info) => {
        updateStatusEl.innerHTML = `发现新版本: ${info.version} <a href=\"#\" id=\"show-release-notes\" data-url=\"${info.releaseNotes || '#'}\">(发行说明)</a>`; 
        downloadUpdateBtn.textContent = `下载 v${info.version}`;
        downloadUpdateBtn.style.display = 'inline-block';
        downloadUpdateBtn.disabled = false; // 重置按钮状态
        installUpdateBtn.style.display = 'none';

        const releaseNotesLink = document.getElementById('show-release-notes');
        if(releaseNotesLink) {
            releaseNotesLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (e.target.dataset.url && e.target.dataset.url !== '#') {
                     window.electron.ipcRenderer.send('open-external-link', e.target.dataset.url);
                }
            });
        }
    });

    window.electron.ipcRenderer.on('update-not-available', (info) => {
        updateStatusEl.textContent = '已是最新版本。'; 
        downloadUpdateBtn.style.display = 'none';
        installUpdateBtn.style.display = 'none';
        setTimeout(() => {
            if (updateStatusEl.textContent === '已是最新版本。') {
                updateStatusEl.textContent = '';
            }
        }, 5000);
    });

    window.electron.ipcRenderer.on('update-error', (errorMessage) => {
        updateStatusEl.innerHTML = `<span style=\"color: red;\">更新错误: ${errorMessage}</span>`;
        downloadUpdateBtn.style.display = 'inline-block'; // 允许用户重试下载
        downloadUpdateBtn.disabled = false;
        downloadUpdateBtn.textContent = '重试下载'; // 或者恢复到之前的版本号提示
        installUpdateBtn.style.display = 'none';
    });

    window.electron.ipcRenderer.on('update-download-progress', (progressObj) => {
        updateStatusEl.textContent = `下载中: ${Math.round(progressObj.percent)}% (${formatBytes(progressObj.transferred)} / ${formatBytes(progressObj.total)})`;
        downloadUpdateBtn.style.display = 'none'; 
        installUpdateBtn.style.display = 'none';
    });

    window.electron.ipcRenderer.on('update-downloaded', (info) => {
        updateStatusEl.textContent = `新版本 v${info.version} 已下载完毕。`;
        downloadUpdateBtn.style.display = 'none';
        installUpdateBtn.textContent = `立即重启并安装 v${info.version}`;
        installUpdateBtn.style.display = 'inline-block';
    });

    // 按钮事件监听
    downloadUpdateBtn.addEventListener('click', () => {
        updateStatusEl.textContent = '准备开始下载...';
        window.electron.ipcRenderer.send('updater-start-download');
        downloadUpdateBtn.disabled = true; 
        downloadUpdateBtn.textContent = '下载请求中...';
    });

    installUpdateBtn.addEventListener('click', () => {
        updateStatusEl.textContent = '正在准备安装...';
        window.electron.ipcRenderer.send('updater-quit-and-install');
    });

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
}); 