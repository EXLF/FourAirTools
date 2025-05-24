/**
 * @fileoverview 确认对话框组件
 * @module components/confirm
 */

/**
 * 显示确认对话框
 * @param {Object} options - 配置选项
 * @param {string} options.title - 标题
 * @param {string} options.message - 消息内容
 * @param {string} [options.confirmText='确定'] - 确认按钮文本
 * @param {string} [options.cancelText='取消'] - 取消按钮文本
 * @param {string} [options.type='info'] - 类型 (info|warning|danger|success)
 * @returns {Promise<boolean>} 用户是否确认
 */
export function showConfirmDialog(options = {}) {
    return new Promise((resolve) => {
        const {
            title = '确认',
            message = '确定要执行此操作吗？',
            confirmText = '确定',
            cancelText = '取消',
            type = 'info'
        } = options;

        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        
        // 创建对话框
        const dialog = document.createElement('div');
        dialog.className = `confirm-dialog confirm-${type}`;
        
        // 图标映射
        const iconMap = {
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle',
            danger: 'fa-exclamation-circle',
            success: 'fa-check-circle'
        };
        
        dialog.innerHTML = `
            <div class="confirm-header">
                <i class="fas ${iconMap[type] || iconMap.info}"></i>
                <h3>${title}</h3>
            </div>
            <div class="confirm-body">
                <p>${message}</p>
            </div>
            <div class="confirm-footer">
                <button class="btn btn-secondary cancel-btn">${cancelText}</button>
                <button class="btn btn-${type === 'danger' ? 'danger' : 'primary'} confirm-btn">${confirmText}</button>
            </div>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // 添加动画类
        requestAnimationFrame(() => {
            overlay.classList.add('show');
            dialog.classList.add('show');
        });
        
        // 关闭对话框的函数
        const closeDialog = (result) => {
            overlay.classList.remove('show');
            dialog.classList.remove('show');
            
            setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 300);
        };
        
        // 绑定事件
        const confirmBtn = dialog.querySelector('.confirm-btn');
        const cancelBtn = dialog.querySelector('.cancel-btn');
        
        confirmBtn.addEventListener('click', () => closeDialog(true));
        cancelBtn.addEventListener('click', () => closeDialog(false));
        
        // 点击遮罩层关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeDialog(false);
            }
        });
        
        // ESC键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeDialog(false);
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
        
        // 自动聚焦确认按钮
        confirmBtn.focus();
    });
}

// 添加样式
const style = document.createElement('style');
style.textContent = `
    .confirm-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    
    .confirm-overlay.show {
        opacity: 1;
    }
    
    .confirm-dialog {
        background: var(--bg-secondary, #fff);
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        min-width: 400px;
        max-width: 500px;
        transform: scale(0.9);
        transition: transform 0.3s ease;
    }
    
    .confirm-dialog.show {
        transform: scale(1);
    }
    
    .confirm-header {
        padding: 20px;
        border-bottom: 1px solid var(--border-color, #e0e0e0);
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .confirm-header i {
        font-size: 24px;
    }
    
    .confirm-info .confirm-header i { color: #2196F3; }
    .confirm-warning .confirm-header i { color: #FF9800; }
    .confirm-danger .confirm-header i { color: #F44336; }
    .confirm-success .confirm-header i { color: #4CAF50; }
    
    .confirm-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 500;
    }
    
    .confirm-body {
        padding: 20px;
    }
    
    .confirm-body p {
        margin: 0;
        color: var(--text-secondary, #666);
        line-height: 1.5;
    }
    
    .confirm-footer {
        padding: 16px 20px;
        border-top: 1px solid var(--border-color, #e0e0e0);
        display: flex;
        justify-content: flex-end;
        gap: 12px;
    }
    
    .confirm-footer .btn {
        min-width: 80px;
    }
`;

// 只添加一次样式
if (!document.querySelector('style[data-confirm-dialog]')) {
    style.setAttribute('data-confirm-dialog', 'true');
    document.head.appendChild(style);
} 