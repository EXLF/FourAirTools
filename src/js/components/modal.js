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

    currentOpenModal = template.content.firstElementChild.cloneNode(true);

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
    document.body.appendChild(currentOpenModal);
    requestAnimationFrame(() => {
        // 添加 class 前检查模态框是否仍然存在（可能因设置错误而被移除）
        if(currentOpenModal) {
            currentOpenModal.classList.add('visible');
        }
    });
}

/**
 * 隐藏并移除当前打开的模态框，并处理过渡效果。
 */
export function hideModal() {
    if (!currentOpenModal) return;

    const modalToRemove = currentOpenModal; // 保留引用以进行异步移除
    currentOpenModal = null; // 立即标记为没有模态框打开

    modalToRemove.classList.remove('visible');

    // 定义移除逻辑
    const removeElement = () => {
        if (modalToRemove && modalToRemove.parentNode === document.body) {
            document.body.removeChild(modalToRemove);
        }
    };

    // 使用 transitionend 实现平滑移除
    let transitionEnded = false;
    modalToRemove.addEventListener('transitionend', (e) => {
        // 确保我们响应的是遮罩层的过渡，而不是子元素的
        if (e.target === modalToRemove && e.propertyName === 'opacity') {
            transitionEnded = true;
            removeElement();
        }
    }, { once: true });

     // 如果 transitionend 未触发，则执行后备移除逻辑
     setTimeout(() => {
         if (!transitionEnded) {
             console.warn("模态框 transitionend 后备逻辑已触发。");
             removeElement();
         }
     }, 350); // 比过渡持续时间稍长
} 