let currentOpenModal = null; // 跟踪当前打开的模态框元素

/**
 * 通过克隆其模板并将其添加到 body 来显示模态框。
 * 处理关闭先前的模态框和添加关闭监听器。
 * @param {string} templateId - 模态框模板元素的 ID。
 * @param {function} setupFunction - 用于设置模态框内容和监听器的回调函数。接收 modalElement 作为参数。
 */
export function showModal(templateId, setupFunction) {
    if (currentOpenModal) {
        console.warn("另一个模态框已打开。正在先关闭它。");
        hideModal(); // 先关闭任何已存在的模态框
    }

    const template = document.getElementById(templateId);
    if (!template || !template.content) {
        console.error(`Modal template not found: ${templateId}`);
        return;
    }

    const newModalElement = template.content.firstElementChild.cloneNode(true); // 使用局部变量
    const modalToShow = newModalElement; // 保存引用
    currentOpenModal = modalToShow; // 更新全局状态

    // 由调用者提供的内容和监听器设置
    if (setupFunction && typeof setupFunction === 'function') {
        try {
            setupFunction(currentOpenModal);
        } catch (error) {
            console.error(`模态框 ${templateId} 的设置函数出错:`, error);
            // 可选：移除损坏的模态框或显示错误消息
            if (currentOpenModal.parentNode === document.body) {
                 document.body.removeChild(currentOpenModal);
            }
            currentOpenModal = null;
            return; // 如果设置失败则停止执行
        }
    }

    // 标准关闭监听器
    const closeButton = currentOpenModal.querySelector('.modal-close-btn');
    const cancelButton = currentOpenModal.querySelector('.modal-cancel-btn');
    const footerCloseButton = currentOpenModal.querySelector('.modal-close-btn-footer');

    if (closeButton) {
        closeButton.addEventListener('click', hideModal);
    }
    if (cancelButton) {
        cancelButton.addEventListener('click', hideModal);
    }
    if (footerCloseButton) { // 为文章模态框页脚按钮添加
        footerCloseButton.addEventListener('click', hideModal);
    }

    // 将模态框添加到 body 并使其可见
    document.body.appendChild(modalToShow);
    requestAnimationFrame(() => {
        // 使用局部变量来添加 class，即使全局 currentOpenModal 被改变
        if (modalToShow && document.body.contains(modalToShow)) { // 再次检查是否还在DOM中
            modalToShow.classList.add('visible');
        }
    });
}

/**
 * 隐藏并移除当前打开的模态框，并处理过渡效果。
 */
export function hideModal() {
    console.log(`[${Date.now()}] hideModal: Start`); 
    if (!currentOpenModal) return;

    const modalToRemove = currentOpenModal; // 保留引用以进行异步移除
    currentOpenModal = null; // 立即标记为没有模态框打开

    // --- 直接移除，不使用过渡 ---
    console.log(`[${Date.now()}] hideModal: Removing element directly`); 
    if (modalToRemove && modalToRemove.parentNode === document.body) {
        document.body.removeChild(modalToRemove);
        console.log(`[${Date.now()}] hideModal: Element removed directly from DOM`); 
    }
    // --- ---------------------- ---
}

/**
 * 显示自定义确认对话框，替代原生confirm
 * @param {string} message - 显示的消息
 * @param {function} onConfirm - 确认按钮点击时的回调
 * @param {function} onCancel - 取消按钮点击时的回调
 * @param {string} confirmText - 确认按钮文本，默认为"确定"
 * @param {string} cancelText - 取消按钮文本，默认为"取消"
 */
export function showConfirmDialog(message, onConfirm, onCancel, confirmText = "确定", cancelText = "取消") {
    // 创建模态框元素
    const confirmModal = document.createElement('div');
    confirmModal.className = 'modal confirm-modal';
    confirmModal.style.position = 'fixed';
    confirmModal.style.top = '0';
    confirmModal.style.left = '0';
    confirmModal.style.width = '100%';
    confirmModal.style.height = '100%';
    confirmModal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    confirmModal.style.display = 'flex';
    confirmModal.style.justifyContent = 'center';
    confirmModal.style.alignItems = 'center';
    confirmModal.style.zIndex = '2000';
    
    confirmModal.innerHTML = `
        <div class="modal-content" style="max-width: 400px; background: white; border-radius: 8px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2); position: relative;">
            <div class="modal-header" style="border-bottom: 1px solid #e9ecef; padding: 15px 20px;">
                <h4 style="margin: 0; font-size: 18px; font-weight: 500;">确认操作</h4>
                <button class="modal-close-btn" style="position: absolute; top: 10px; right: 15px; background: none; border: none; font-size: 24px; color: #adb5bd; cursor: pointer; padding: 5px; line-height: 1;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <p style="margin: 0; font-size: 16px; color: #343a40;">${message}</p>
            </div>
            <div class="modal-footer" style="padding: 15px 20px; border-top: 1px solid #e9ecef; display: flex; justify-content: flex-end; gap: 10px;">
                <button class="btn btn-outline-secondary cancel-btn">${cancelText}</button>
                <button class="btn btn-primary confirm-btn">${confirmText}</button>
            </div>
        </div>
    `;

    // 记录当前模态框
    if (currentOpenModal) {
        console.warn("另一个模态框已打开。正在先关闭它。");
        hideModal(); // 先关闭任何已存在的模态框
    }
    currentOpenModal = confirmModal;

    // 添加事件监听器
    const closeBtn = confirmModal.querySelector('.modal-close-btn');
    const cancelBtn = confirmModal.querySelector('.cancel-btn');
    const confirmBtn = confirmModal.querySelector('.confirm-btn');

    const handleCancel = () => {
        hideModal();
        if (onCancel && typeof onCancel === 'function') {
            onCancel();
        }
    };

    const handleConfirm = () => {
        hideModal();
        if (onConfirm && typeof onConfirm === 'function') {
            onConfirm();
        }
    };

    if (closeBtn) closeBtn.addEventListener('click', handleCancel);
    if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
    if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);

    // 防止点击背景关闭
    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
            handleCancel();
        }
    });

    // 将模态框添加到 body 并使其可见
    document.body.appendChild(confirmModal);
} 