import { showModal, hideModal } from '../../../components/modal.js';
import { showToast } from '../../../components/toast.js';

/**
 * 显示查看钱包详情的模态框。
 * @param {number} walletId 要查看的钱包 ID。
 */
export function showViewDetailsModal(walletId) {
    showModal('tpl-view-wallet-details', async (modalElement) => {
        const addressEl = modalElement.querySelector('#view-wallet-address-value');
        const privateKeyEl = modalElement.querySelector('#view-private-key');
        const mnemonicEl = modalElement.querySelector('#view-mnemonic');
        const copyBtns = modalElement.querySelectorAll('.copy-btn');
        const modalTitle = modalElement.querySelector('.modal-title');

        // 设置初始加载状态
        if(addressEl) addressEl.textContent = '加载中...';
        if(privateKeyEl) privateKeyEl.textContent = '加载中...';
        if(mnemonicEl) mnemonicEl.textContent = '加载中...';
        if(modalTitle) modalTitle.textContent = '查看钱包详情'; // Reset title

        try {
            // 1. 从主进程获取钱包详情 (包含加密数据)
            console.log(`[WalletsModals] Fetching details for wallet ID: ${walletId}`);
            const details = await window.dbAPI.getWalletDetails(walletId);
            console.log('[WalletsModals] Received details:', details);

            if (!details) {
                throw new Error('未能获取到钱包详情。');
            }

            // 填充地址 (地址通常不加密)
            if(addressEl) addressEl.textContent = details.address || 'N/A';
            if(modalTitle && details.name) modalTitle.textContent = `查看详情: ${details.name} (${details.address.substring(0,6)}...)`;
            else if (modalTitle) modalTitle.textContent = `查看详情: ${details.address.substring(0,6)}...`;


            // 2. 解密私钥和助记词
            let decryptedPrivateKey = '[解密失败或无数据]';
            let decryptedMnemonic = '[解密失败或无数据]';

            if (details.encryptedPrivateKey) {
                try {
                    console.log('[WalletsModals] Attempting to decrypt private key...');
                    decryptedPrivateKey = await window.electron.ipcRenderer.invoke('app:decryptData', details.encryptedPrivateKey);
                    console.log('[WalletsModals] Private key decrypted.');
                    if (!decryptedPrivateKey) decryptedPrivateKey = '[解密返回空]';
                } catch (error) {
                    console.error('[WalletsModals] Failed to decrypt private key:', error);
                    decryptedPrivateKey = `[解密错误: ${error.message}]`;
                }
            } else {
                 decryptedPrivateKey = '[未存储]';
            }

            if (details.encryptedMnemonic) {
                try {
                    console.log('[WalletsModals] Attempting to decrypt mnemonic...');
                    decryptedMnemonic = await window.electron.ipcRenderer.invoke('app:decryptData', details.encryptedMnemonic);
                    console.log('[WalletsModals] Mnemonic decrypted.');
                    if (!decryptedMnemonic) decryptedMnemonic = '[解密返回空]';
                } catch (error) {
                    console.error('[WalletsModals] Failed to decrypt mnemonic:', error);
                    decryptedMnemonic = `[解密错误: ${error.message}]`;
                }
            } else {
                 decryptedMnemonic = '[未存储]';
            }

            // *** 新增：在填充 UI 前打印最终的解密结果 ***
            console.log('[WalletsModals] Final value for Private Key before UI update:', decryptedPrivateKey);
            console.log('[WalletsModals] Final value for Mnemonic before UI update:', decryptedMnemonic);

            // 3. 填充解密后的数据
            if(privateKeyEl) {
                console.log('[WalletsModals] Setting private key text content.');
                privateKeyEl.textContent = decryptedPrivateKey;
            } else {
                 console.error('[WalletsModals] privateKeyEl not found when trying to set text!');
            }
            if(mnemonicEl) {
                 console.log('[WalletsModals] Setting mnemonic text content.');
                 mnemonicEl.textContent = decryptedMnemonic;
             } else {
                  console.error('[WalletsModals] mnemonicEl not found when trying to set text!');
             }

            // 重新设置复制按钮的目标 (确保它们能复制解密后的内容)
            setupCopyButtons(modalElement);

        } catch (error) {
            console.error('[WalletsModals] Error showing view details modal:', error);
            showToast(`加载钱包详情失败: ${error.message}`, 'error');
            // 可以选择关闭模态框或显示错误信息
             if(addressEl) addressEl.textContent = '加载失败';
             if(privateKeyEl) privateKeyEl.textContent = '加载失败';
             if(mnemonicEl) mnemonicEl.textContent = '加载失败';
             hideModal(); // 或者保留模态框让用户看到错误
        }
    });
}

// Helper function for copy buttons (if not already defined elsewhere)
function setupCopyButtons(containerElement) {
    const copyBtns = containerElement.querySelectorAll('.copy-btn');
    copyBtns.forEach(btn => {
        // Remove existing listener to prevent duplicates if modal is reused
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', async () => {
            const targetId = newBtn.dataset.target;
            const targetElement = containerElement.querySelector(`#${targetId}`);
            if (targetElement) {
                const textToCopy = targetElement.textContent;
                 if (textToCopy && !textToCopy.startsWith('[')) { // Don't copy error messages
                    try {
                        await navigator.clipboard.writeText(textToCopy);
                        showToast('已复制到剪贴板', 'success');
                    } catch (err) {
                        console.error('无法复制文本: ', err);
                        showToast('复制失败', 'error');
                    }
                } else {
                    showToast('没有有效内容可复制', 'warning');
                }
            }
        });
    });
} 