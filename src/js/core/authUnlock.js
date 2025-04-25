import { showModal, hideModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

/**
 * 显示解锁应用的模态框。
 * 这个模态框应该是持久的，不允许用户通过点击背景或按 Esc 关闭。
 */
export function showUnlockModal() {
    // 注意：使用 'modal.js' 的 showModal，它默认不是持久的
    // 可能需要修改 modal.js 或在这里添加额外逻辑来阻止关闭
    showModal('tpl-unlock-app', (modalElement) => {
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

        // 注意：我们没有添加 modalElement.querySelector('.modal-close-btn') 的监听
        // 因为这个模态框不应该有关闭按钮。同时，需要确保 modal.js 不会因为点击背景而关闭它。
        // 可能需要给 modal overlay 添加一个特定类或属性，让 modal.js 知道它不应被关闭。
        // 或者修改 showModal 接受一个 'persistent' 选项。 (待办)

    }, { persistent: true }); // 假设 modal.js 支持 persistent 选项
} 