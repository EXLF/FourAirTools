import { showModal, hideModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

// Basic password strength check (can be improved)
function checkPasswordStrength(password) {
    let score = 0;
    if (!password || password.length < 8) return { score: 0, text: '密码太短' };
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++; // Special characters

    let text = '';
    let color = '#dc3545'; // Red (Weak)
    let width = '20%';

    if (score <= 2) {
        text = '弱';
    } else if (score <= 4) {
        text = '中等';
        color = '#ffc107'; // Yellow
        width = '60%';
    } else {
        text = '强';
        color = '#28a745'; // Green
        width = '100%';
    }
    return { score, text, color, width };
}

/**
 * 显示设置主密码的模态框。
 */
export function showSetupPasswordModal() {
    showModal('tpl-setup-password', (modalElement) => {
        const form = modalElement.querySelector('#setup-password-form-actual');
        const passwordInput = modalElement.querySelector('#master-password');
        const confirmInput = modalElement.querySelector('#confirm-password');
        const strengthMeter = modalElement.querySelector('.strength-meter');
        const strengthText = modalElement.querySelector('.strength-text');
        const errorElement = modalElement.querySelector('.setup-password-error');
        const setupBtn = modalElement.querySelector('.modal-setup-btn');

        if (!form || !passwordInput || !confirmInput || !strengthMeter || !strengthText || !errorElement || !setupBtn) {
            console.error('设置密码模态框缺少元素。');
            // Don't hide modal here, let user see the issue maybe?
            return;
        }

        // Update strength meter on password input
        const updateStrengthDisplay = () => {
            const strength = checkPasswordStrength(passwordInput.value);
            strengthMeter.style.width = strength.width;
            strengthMeter.style.backgroundColor = strength.color;
            strengthText.textContent = strength.text;
        };
        passwordInput.addEventListener('input', updateStrengthDisplay);
        updateStrengthDisplay(); // Initial check

        // Form submission handler
        const handleSubmit = async (event) => {
            event.preventDefault();
            errorElement.textContent = '';
            errorElement.style.display = 'none';

            const password = passwordInput.value;
            const confirm = confirmInput.value;
            const strength = checkPasswordStrength(password);

            if (password !== confirm) {
                errorElement.textContent = '两次输入的密码不一致。';
                errorElement.style.display = 'block';
                return;
            }
            if (strength.score < 2) { // Require at least medium strength?
                errorElement.textContent = '密码强度不足，请使用更复杂的密码。';
                errorElement.style.display = 'block';
                return;
            }

            setupBtn.disabled = true;
            setupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 设置中...';

            try {
                // Send password to main process for setup
                // Need to expose ipcRenderer securely via preload
                if (window.electron && window.electron.ipcRenderer) {
                    console.log('[AuthSetup] Sending auth:setupPassword to main...');
                    const result = await window.electron.ipcRenderer.invoke('auth:setupPassword', password);
                    console.log('[AuthSetup] Main process setup result:', result);
                    if (result.success) {
                        showToast('主密码设置成功！应用即将解锁。', 'success');
                        hideModal();
                        // Optional: Maybe trigger a refresh or specific action after setup
                        // window.location.reload(); // Simplest way to re-init everything
                    } else {
                        throw new Error(result.error || '主进程设置密码失败。');
                    }
                } else {
                     throw new Error('IPC 通信不可用。');
                }
            } catch (error) {
                console.error('设置主密码失败:', error);
                errorElement.textContent = `设置失败: ${error.message}`;
                errorElement.style.display = 'block';
                setupBtn.disabled = false;
                setupBtn.innerHTML = '设置密码并继续';
            }
        };

        form.addEventListener('submit', handleSubmit);
    });
} 