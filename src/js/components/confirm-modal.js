class ConfirmModal {
    constructor() {
        this.modalElement = null;
        this.isOpen = false;
        this.currentResolver = null;
    }

    // 创建模态框HTML
    createModal() {
        const modalHTML = `
            <div class="custom-modal-overlay" id="confirm-modal-overlay">
                <div class="custom-modal-box">
                    <div class="custom-modal-header">
                        <h3 class="custom-modal-title" id="confirm-modal-title">确认操作</h3>
                    </div>
                    <div class="custom-modal-content">
                        <p class="custom-modal-message" id="confirm-modal-message">您确定要执行此操作吗？</p>
                    </div>
                    <div class="custom-modal-actions">
                        <button class="custom-btn custom-btn-secondary" id="confirm-modal-cancel">取消</button>
                        <button class="custom-btn custom-btn-primary" id="confirm-modal-confirm">确定</button>
                    </div>
                </div>
            </div>
        `;

        // 添加到页面
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);

        this.modalElement = document.getElementById('confirm-modal-overlay');
        this.bindEvents();
    }

    // 绑定事件
    bindEvents() {
        const cancelBtn = document.getElementById('confirm-modal-cancel');
        const confirmBtn = document.getElementById('confirm-modal-confirm');
        const overlay = this.modalElement;

        // 取消按钮
        cancelBtn.addEventListener('click', () => {
            this.close(false);
        });

        // 确定按钮
        confirmBtn.addEventListener('click', () => {
            this.close(true);
        });

        // 点击背景关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.close(false);
            }
        });

        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close(false);
            }
        });
    }

    // 显示确认框
    show(message, title = '确认操作', options = {}) {
        return new Promise((resolve) => {
            // 如果已经有模态框打开，先关闭
            if (this.isOpen) {
                this.close(false);
            }

            // 如果还没创建模态框，先创建
            if (!this.modalElement) {
                this.createModal();
            }

            this.currentResolver = resolve;
            this.isOpen = true;

            // 设置内容
            document.getElementById('confirm-modal-title').textContent = title;
            document.getElementById('confirm-modal-message').textContent = message;

            // 设置按钮文字
            if (options.confirmText) {
                document.getElementById('confirm-modal-confirm').textContent = options.confirmText;
            } else {
                document.getElementById('confirm-modal-confirm').textContent = '确定';
            }

            const cancelBtn = document.getElementById('confirm-modal-cancel');
            if (options.hideCancel || options.cancelText === '') {
                // 隐藏取消按钮
                cancelBtn.style.display = 'none';
            } else {
                // 显示取消按钮并设置文字
                cancelBtn.style.display = 'inline-flex';
                if (options.cancelText) {
                    cancelBtn.textContent = options.cancelText;
                } else {
                    cancelBtn.textContent = '取消';
                }
            }

            // 设置按钮样式
            const confirmBtn = document.getElementById('confirm-modal-confirm');
            if (options.danger) {
                confirmBtn.className = 'custom-btn custom-btn-danger';
            } else {
                confirmBtn.className = 'custom-btn custom-btn-primary';
            }

            // 显示模态框
            this.modalElement.style.display = 'flex';
            
            // 添加动画类
            setTimeout(() => {
                this.modalElement.classList.add('show');
            }, 10);

            // 聚焦到确定按钮
            setTimeout(() => {
                confirmBtn.focus();
            }, 100);
        });
    }

    // 关闭模态框
    close(result) {
        if (!this.isOpen) return;

        this.isOpen = false;
        
        // 添加关闭动画
        this.modalElement.classList.remove('show');
        
        setTimeout(() => {
            this.modalElement.style.display = 'none';
            
            // 解析Promise
            if (this.currentResolver) {
                this.currentResolver(result);
                this.currentResolver = null;
            }
        }, 200);
    }

    // 销毁模态框
    destroy() {
        if (this.modalElement) {
            this.modalElement.remove();
            this.modalElement = null;
        }
        this.isOpen = false;
        this.currentResolver = null;
    }
}

// 创建全局实例
window.confirmModal = new ConfirmModal();

// 提供便捷的全局函数
window.showConfirm = (message, title, options) => {
    return window.confirmModal.show(message, title, options);
};

// 导出类
export default ConfirmModal; 