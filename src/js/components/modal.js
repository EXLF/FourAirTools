let currentOpenModal = null; // 跟踪当前打开的模态框元素
let modalCounter = 0; // 用于生成唯一的模态框ID

/**
 * 通过克隆其模板并将其添加到 body 来显示模态框。
 * 处理关闭先前的模态框和添加关闭监听器。
 * @param {string|HTMLElement|DocumentFragment} content - 模态框内容：模板ID或HTML内容
 * @param {function} setupFunction - 用于设置模态框内容和监听器的回调函数。接收 modalElement 作为参数。
 * @param {object} options - 模态框的选项，例如 { persistent: true } 表示模态框不能轻易关闭。
 * @returns {string} 生成的模态框ID
 */
export function showModal(content, setupFunction, options = {}) {
    if (currentOpenModal) {
        // 如果当前打开的是持久化模态框，并且尝试打开新的，则阻止
        if (currentOpenModal.dataset.persistent === 'true' && options.persistent) {
            console.warn("一个持久化模态框已打开，无法打开新的持久化模态框。");
            return null;
        }
        // 如果当前打开的是持久化模态框，但新打开的不是持久化的，也阻止（或根据需求调整）
        if (currentOpenModal.dataset.persistent === 'true' && !options.persistent) {
            console.warn("一个持久化模态框已打开，请先处理。");
            return null;
        }
        console.warn("另一个模态框已打开。正在先关闭它。");
        hideModal(); // 先关闭任何已存在的模态框
    }

    let newModalElement;
    
    // 判断内容类型
    if (typeof content === 'string' && document.getElementById(content)) {
        // 如果是字符串并且是有效的元素ID
        const template = document.getElementById(content);
        if (!template || !template.content) {
            console.error(`Modal template not found: ${content}`);
            return null;
        }
        newModalElement = template.content.firstElementChild.cloneNode(true);
    } else if (content instanceof Node) {
        // 如果是DOM节点或DocumentFragment
        if (content instanceof DocumentFragment) {
            // 如果是DocumentFragment，获取第一个元素
            newModalElement = content.firstElementChild.cloneNode(true);
        } else {
            // 直接使用传入的节点
            newModalElement = content.cloneNode(true);
        }
    } else {
        // 如果是HTML字符串或其他
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        newModalElement = tempDiv.firstElementChild;
    }

    // 生成唯一的模态框ID
    const modalId = `modal_${Date.now()}_${++modalCounter}`;
    newModalElement.id = modalId;
    
    const modalToShow = newModalElement; // 保存引用
    currentOpenModal = modalToShow; // 更新全局状态

    // 如果是持久化模态框，添加一个标记
    if (options.persistent) {
        currentOpenModal.dataset.persistent = 'true';
    }

    // 由调用者提供的内容和监听器设置
    if (setupFunction && typeof setupFunction === 'function') {
        try {
            setupFunction(currentOpenModal);
        } catch (error) {
            console.error(`模态框 ${modalId} 的设置函数出错:`, error);
            // 可选：移除损坏的模态框或显示错误消息
            if (currentOpenModal.parentNode === document.body) {
                 document.body.removeChild(currentOpenModal);
            }
            currentOpenModal = null;
            return null; // 如果设置失败则停止执行
        }
    }

    // 标准关闭监听器
    const closeButton = currentOpenModal.querySelector('.modal-close-btn');
    const cancelButton = currentOpenModal.querySelector('.modal-cancel-btn');
    const footerCloseButton = currentOpenModal.querySelector('.modal-close-btn-footer');

    // 仅当模态框不是持久化时才添加标准关闭监听器
    if (!options.persistent) {
        if (closeButton) {
            closeButton.addEventListener('click', () => hideModal());
        }
        if (cancelButton) {
            cancelButton.addEventListener('click', () => hideModal());
        }
        if (footerCloseButton) { // 为文章模态框页脚按钮添加
            footerCloseButton.addEventListener('click', () => hideModal());
        }

        // 可选：添加点击背景关闭的功能（仅非持久化时）
        // currentOpenModal.addEventListener('click', (e) => {
        //     if (e.target === currentOpenModal) { // 点击的是模态框本身（背景）
        //         hideModal();
        //     }
        // });
    }

    // 将模态框添加到 body 并使其可见
    document.body.appendChild(modalToShow);
    requestAnimationFrame(() => {
        // 使用局部变量来添加 class，即使全局 currentOpenModal 被改变
        if (modalToShow && document.body.contains(modalToShow)) { // 再次检查是否还在DOM中
            modalToShow.classList.add('visible');
        }
    });
    
    // 返回模态框ID，以便后续操作
    return modalId;
}

/**
 * 隐藏并移除当前打开的模态框，并处理过渡效果。
 */
export function hideModal() {
    console.log(`[${Date.now()}] hideModal: Start`); 
    if (!currentOpenModal) return;

    // 如果是持久化模态框，则阻止 hideModal 的默认行为，除非是强制关闭
    // 这里我们假设 hideModal() 被调用意味着意图是明确的关闭，
    // 而不是意外触发。如果需要更严格的持久化，
    // 可能需要一个额外的参数给 hideModal 如 forceHide = false
    if (currentOpenModal.dataset.persistent === 'true') {
        // 对于持久化模态框，通常不由 hideModal()直接关闭，
        // 除非是解锁成功等特定逻辑调用它。
        // 或者，我们可以添加一个 console.warn 或阻止关闭除非有特定条件
        console.log("[Modal] Attempting to hide a persistent modal. This should typically be handled by specific logic (e.g., unlock success).");
    }

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
 * closeModal函数 - hideModal的增强版，支持通过ID关闭特定模态框
 * @param {string} modalId - 可选的模态框ID
 */
export function closeModal(modalId = null) {
    // 如果未提供ID或ID与当前打开的模态框匹配，则关闭当前模态框
    if (!modalId || (currentOpenModal && currentOpenModal.id === modalId)) {
        hideModal();
        return;
    }
    
    // 如果指定了特定ID，但与当前打开的不匹配，则尝试查找并关闭
    const modalToClose = document.getElementById(modalId);
    if (modalToClose) {
        if (modalToClose === currentOpenModal) {
            hideModal();
        } else {
            // 如果不是当前正在跟踪的模态框，直接从DOM中移除
            if (modalToClose.parentNode === document.body) {
                document.body.removeChild(modalToClose);
            }
        }
    }
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
        // hideModal(); // 先关闭任何已存在的模态框 - 需要考虑持久化问题
        // 如果 currentOpenModal 是持久化的，不应该随便关闭
        if (currentOpenModal.dataset.persistent === 'true') {
            console.warn("一个持久化模态框已打开，无法显示确认对话框。请先处理持久化模态框。");
            return; // 阻止打开新的确认框
        }
        hideModal();
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

    // 防止点击背景关闭 (confirm-modal 特有逻辑)
    // 注意：这个背景点击关闭是 showConfirmDialog 的特性，不是 showModal 的。
    // 如果是持久化确认框 (虽然当前函数不支持)，这里也需要调整。
    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
            // 如果 confirm dialog 需要支持 persistent 选项，这里需要检查
            handleCancel();
        }
    });

    // 将模态框添加到 body 并使其可见
    document.body.appendChild(confirmModal);
} 