import { showModal, hideModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

/**
 * 显示解锁应用的模态框。
 * 这个模态框应该是持久的，不允许用户通过点击背景或按 Esc 关闭。
 */
export function showUnlockModal() {
    // 创建遮罩，防止访问下面的UI
    const existingOverlay = document.getElementById('lock-overlay');
    if (!existingOverlay) {
        const overlay = document.createElement('div');
        overlay.id = 'lock-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        overlay.style.zIndex = '9998'; // 确保在其他内容之上
        document.body.appendChild(overlay);
    }
    
    // 注意：使用 'modal.js' 的 showModal，它默认不是持久的
    // 创建一个不可关闭的模态框
    showModal('tpl-unlock-app', (modalElement) => {
        // 调整模态框样式
        modalElement.style.zIndex = '9999'; // 确保在遮罩之上
        
        // 禁用关闭按钮
        const closeBtn = modalElement.querySelector('.modal-close-btn');
        if (closeBtn) {
            closeBtn.style.display = 'none';
        }
        
        const form = modalElement.querySelector('#unlock-form-actual');
        const passwordInput = modalElement.querySelector('#unlock-password');
        const errorElement = modalElement.querySelector('.unlock-error');
        const unlockBtn = modalElement.querySelector('.modal-unlock-btn');

        if (!form || !passwordInput || !errorElement || !unlockBtn) {
            console.error('解锁模态框缺少必要的元素。');
            // 也许显示一个通用错误给用户？
            return;
        }

        // 清空之前的错误信息
        errorElement.textContent = '';
        errorElement.style.display = 'none';
        passwordInput.value = ''; // 清空密码字段
        passwordInput.focus(); // 自动聚焦密码输入框

        // 解锁表单提交处理
        const handleSubmit = async (event) => {
            event.preventDefault();
            errorElement.textContent = '';
            errorElement.style.display = 'none';
            unlockBtn.disabled = true;
            unlockBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 解锁中...';

            const password = passwordInput.value;

            if (!password) {
                errorElement.textContent = '请输入主密码。';
                errorElement.style.display = 'block';
                unlockBtn.disabled = false;
                unlockBtn.innerHTML = '<i class="fa fa-unlock-alt"></i> 解锁';
                return;
            }

            try {
                // 通过 IPC 调用主进程进行解锁验证
                if (window.electron && window.electron.ipcRenderer) {
                    console.log('[AuthUnlock] Sending auth:unlockApp to main...');
                    const result = await window.electron.ipcRenderer.invoke('auth:unlockApp', password);
                    console.log('[AuthUnlock] Main process unlock result:', result);

                    if (result.success) {
                        showToast('应用解锁成功！', 'success');
                        // 移除锁定遮罩
                        const overlay = document.getElementById('lock-overlay');
                        if (overlay) {
                            overlay.remove();
                        }
                        hideModal(); // 解锁成功后关闭模态框
                        // 这里可能需要触发一些事件或重新加载UI来反映解锁状态
                        // 例如: document.dispatchEvent(new Event('app-unlocked'));
                    } else {
                        // 密码错误或其他失败情况
                        throw new Error(result.error || '主密码不正确或解锁失败。');
                    }
                } else {
                    throw new Error('IPC 通信不可用。');
                }

            } catch (error) {
                console.error('解锁应用失败:', error);
                passwordInput.value = ''; // 清空密码以便重试
                passwordInput.focus();
                errorElement.textContent = `解锁失败: ${error.message}`;
                errorElement.style.display = 'block';
                unlockBtn.disabled = false;
                unlockBtn.innerHTML = '<i class="fa fa-unlock-alt"></i> 解锁';
            }
        };

        form.addEventListener('submit', handleSubmit);

        // 阻止一切可能关闭模态框的操作
        // 阻止点击背景关闭模态框
        const modalOverlay = document.querySelector('.modal-overlay');
        if (modalOverlay) {
            const originalClickHandler = modalOverlay.onclick;
            modalOverlay.onclick = (e) => {
                e.stopPropagation();
                return false;
            };
        }

        // 阻止ESC键关闭
        document.addEventListener('keydown', function preventEsc(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
            }
        });

    }, { persistent: true }); // 假设 modal.js 支持 persistent 选项
} 