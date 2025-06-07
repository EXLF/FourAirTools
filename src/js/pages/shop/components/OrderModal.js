/**
 * 订单创建模态框组件
 */

export class OrderModal {
    constructor(product, onSubmit) {
        this.product = product;
        this.onSubmit = onSubmit;
        this.modal = null;
        
        // 支付组件将在需要时动态导入
        this.paymentModal = null;
        
        // 绑定支付事件
        this.bindPaymentEvents();
    }

    /**
     * 显示订单模态框
     */
    show() {
        this.modal = this.createModal();
        document.body.appendChild(this.modal);
        
        // 添加样式
        this.addStyles();
        
        // 绑定事件
        this.bindEvents();
        
        // 焦点到第一个输入框
        setTimeout(() => {
            const firstInput = this.modal.querySelector('input');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    /**
     * 创建模态框DOM
     * @returns {HTMLElement} 模态框元素
     */
    createModal() {
        const modal = document.createElement('div');
        modal.className = 'order-modal';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-shopping-cart"></i> 确认购买</h3>
                    <button class="modal-close" type="button">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-body">
                    <!-- 商品信息 -->
                    <div class="order-product-info">
                        <div class="product-image-small">
                            <img src="${this.product.image}" alt="${this.product.name}" 
                                 onerror="this.src='src/assets/icons/default-product.png'">
                        </div>
                        <div class="product-details">
                            <h4>${this.product.name}</h4>
                            <p class="product-category">${this.product.category}</p>
                            <div class="product-price-info">
                                <span class="price-amount">¥${this.formatPrice(this.product.price)}</span>
                                <span class="stock-status">库存: ${this.product.stock} 件</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 订单表单 -->
                    <form id="order-form" class="order-form">
                        <div class="form-section">
                            <h5><i class="fas fa-cube"></i> 购买数量</h5>
                            <div class="quantity-selector">
                                <button type="button" class="quantity-btn quantity-minus" disabled>-</button>
                                <input type="number" id="quantity" name="quantity" value="1" min="1" max="${this.product.stock}" readonly>
                                <button type="button" class="quantity-btn quantity-plus" ${this.product.stock <= 1 ? 'disabled' : ''}>+</button>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <h5><i class="fas fa-address-card"></i> 联系方式</h5>
                            <div class="form-group">
                                <label for="contact-method">联系方式</label>
                                <select id="contact-method" name="contactMethod" required>
                                    <option value="">请选择联系方式</option>
                                    <option value="qq">QQ</option>
                                    <option value="wechat">微信</option>
                                    <option value="telegram">Telegram</option>
                                    <option value="email">邮箱</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="contact-value">联系账号</label>
                                <input type="text" id="contact-value" name="contactValue" placeholder="请输入您的联系账号" required>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <h5><i class="fas fa-comment"></i> 备注信息</h5>
                            <div class="form-group">
                                <label for="notes">特殊要求（可选）</label>
                                <textarea id="notes" name="notes" placeholder="如有特殊要求请在此说明..." maxlength="500"></textarea>
                            </div>
                        </div>
                        
                        <!-- 订单汇总 -->
                        <div class="order-summary">
                            <div class="summary-row">
                                <span>商品单价:</span>
                                <span>¥${this.formatPrice(this.product.price)}</span>
                            </div>
                            <div class="summary-row">
                                <span>购买数量:</span>
                                <span id="summary-quantity">1</span>
                            </div>
                            <div class="summary-row total">
                                <span>订单总额:</span>
                                <span id="summary-total">¥${this.formatPrice(this.product.price)}</span>
                            </div>
                        </div>
                    </form>
                </div>
                
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary modal-cancel">取消</button>
                    <button type="submit" form="order-form" class="btn btn-primary modal-submit">
                        <i class="fas fa-credit-card"></i>
                        确认下单
                    </button>
                </div>
            </div>
        `;
        
        return modal;
    }

    /**
     * 添加样式
     */
    addStyles() {
        if (document.querySelector('#order-modal-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'order-modal-styles';
        styles.textContent = `
            .order-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.3s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .order-modal .modal-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
            }
            
            .order-modal .modal-content {
                position: relative;
                background: white;
                border-radius: 16px;
                width: 90%;
                max-width: 500px;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
                animation: slideIn 0.3s ease;
            }
            
            @keyframes slideIn {
                from { transform: translateY(-20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            .order-modal .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid #eee;
            }
            
            .order-modal .modal-header h3 {
                margin: 0;
                color: #333;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .order-modal .modal-close {
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                color: #999;
                padding: 5px;
                border-radius: 4px;
                transition: all 0.3s ease;
            }
            
            .order-modal .modal-close:hover {
                background: #f0f0f0;
                color: #333;
            }
            
            .order-modal .modal-body {
                padding: 20px;
            }
            
            .order-product-info {
                display: flex;
                gap: 15px;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 12px;
                margin-bottom: 20px;
            }
            
            .product-image-small {
                width: 80px;
                height: 80px;
                border-radius: 8px;
                overflow: hidden;
                flex-shrink: 0;
            }
            
            .product-image-small img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            
            .product-details {
                flex: 1;
            }
            
            .product-details h4 {
                margin: 0 0 5px 0;
                font-size: 16px;
                color: #333;
            }
            
            .product-category {
                color: #667eea;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                margin-bottom: 8px;
            }
            
            .product-price-info {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .price-amount {
                font-size: 18px;
                font-weight: 700;
                color: #28a745;
            }
            
            .stock-status {
                font-size: 12px;
                color: #6c757d;
            }
            
            .form-section {
                margin-bottom: 20px;
            }
            
            .form-section h5 {
                margin: 0 0 15px 0;
                font-size: 14px;
                color: #333;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .form-group {
                margin-bottom: 15px;
            }
            
            .form-group label {
                display: block;
                margin-bottom: 5px;
                font-weight: 500;
                color: #333;
                font-size: 14px;
            }
            
            .form-group input,
            .form-group select,
            .form-group textarea {
                width: 100%;
                padding: 10px 12px;
                border: 2px solid #e9ecef;
                border-radius: 8px;
                font-size: 14px;
                transition: all 0.3s ease;
            }
            
            .form-group input:focus,
            .form-group select:focus,
            .form-group textarea:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            
            .form-group textarea {
                resize: vertical;
                min-height: 80px;
            }
            
            .quantity-selector {
                display: flex;
                align-items: center;
                gap: 0;
                max-width: 150px;
            }
            
            .quantity-btn {
                width: 35px;
                height: 35px;
                border: 2px solid #e9ecef;
                background: white;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                transition: all 0.3s ease;
            }
            
            .quantity-minus {
                border-radius: 8px 0 0 8px;
            }
            
            .quantity-plus {
                border-radius: 0 8px 8px 0;
            }
            
            .quantity-btn:hover:not(:disabled) {
                background: #f8f9fa;
                border-color: #667eea;
            }
            
            .quantity-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .quantity-selector input {
                width: 60px;
                text-align: center;
                border-radius: 0;
                border-left: none;
                border-right: none;
                margin: 0;
            }
            
            .order-summary {
                background: #f8f9fa;
                border-radius: 12px;
                padding: 15px;
                margin-top: 20px;
            }
            
            .summary-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                font-size: 14px;
            }
            
            .summary-row.total {
                border-top: 1px solid #ddd;
                padding-top: 8px;
                margin-top: 8px;
                font-weight: 600;
                font-size: 16px;
                color: #333;
            }
            
            .modal-footer {
                display: flex;
                gap: 10px;
                padding: 20px;
                border-top: 1px solid #eee;
                justify-content: flex-end;
            }
            
            .modal-footer .btn {
                padding: 10px 20px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .btn-secondary {
                background: #f8f9fa;
                border: 2px solid #e9ecef;
                color: #495057;
            }
            
            .btn-secondary:hover {
                background: #e9ecef;
            }
            
            .btn-primary {
                background: #667eea;
                border: 2px solid #667eea;
                color: white;
            }
            
            .btn-primary:hover {
                background: #5a67d8;
                border-color: #5a67d8;
            }
        `;
        
        document.head.appendChild(styles);
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        if (!this.modal) return;
        
        // 关闭模态框事件
        const backdrop = this.modal.querySelector('.modal-backdrop');
        const closeBtn = this.modal.querySelector('.modal-close');
        const cancelBtn = this.modal.querySelector('.modal-cancel');
        
        [backdrop, closeBtn, cancelBtn].forEach(element => {
            if (element) {
                element.addEventListener('click', () => this.close());
            }
        });
        
        // 数量选择器事件
        const quantityInput = this.modal.querySelector('#quantity');
        const minusBtn = this.modal.querySelector('.quantity-minus');
        const plusBtn = this.modal.querySelector('.quantity-plus');
        
        if (minusBtn) {
            minusBtn.addEventListener('click', () => {
                const current = parseInt(quantityInput.value);
                if (current > 1) {
                    quantityInput.value = current - 1;
                    this.updateQuantity();
                }
            });
        }
        
        if (plusBtn) {
            plusBtn.addEventListener('click', () => {
                const current = parseInt(quantityInput.value);
                if (current < this.product.stock) {
                    quantityInput.value = current + 1;
                    this.updateQuantity();
                }
            });
        }
        
        if (quantityInput) {
            quantityInput.addEventListener('input', () => {
                this.updateQuantity();
            });
        }
        
        // 表单提交事件
        const form = this.modal.querySelector('#order-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmit();
            });
        }
    }

    /**
     * 更新数量相关的UI
     */
    updateQuantity() {
        const quantityInput = this.modal.querySelector('#quantity');
        const minusBtn = this.modal.querySelector('.quantity-minus');
        const plusBtn = this.modal.querySelector('.quantity-plus');
        const summaryQuantity = this.modal.querySelector('#summary-quantity');
        const summaryTotal = this.modal.querySelector('#summary-total');
        
        const quantity = parseInt(quantityInput.value) || 1;
        const total = quantity * this.product.price;
        
        // 更新按钮状态
        if (minusBtn) minusBtn.disabled = quantity <= 1;
        if (plusBtn) plusBtn.disabled = quantity >= this.product.stock;
        
        // 更新汇总信息
        if (summaryQuantity) summaryQuantity.textContent = quantity;
        if (summaryTotal) summaryTotal.textContent = `¥${this.formatPrice(total)}`;
    }

    /**
     * 处理表单提交
     */
    async handleSubmit() {
        const form = this.modal.querySelector('#order-form');
        if (!form) return;
        
        const formData = new FormData(form);
        const orderData = {
            productId: this.product.id,
            quantity: parseInt(formData.get('quantity')) || 1,
            contactInfo: {
                method: formData.get('contactMethod'),
                value: formData.get('contactValue')
            },
            notes: formData.get('notes') || ''
        };
        
        // 验证表单
        if (!orderData.contactInfo.method || !orderData.contactInfo.value) {
            alert('请填写联系方式');
            return;
        }
        
        if (orderData.quantity <= 0 || orderData.quantity > this.product.stock) {
            alert('购买数量无效');
            return;
        }
        
        // 显示提交按钮加载状态
        const submitBtn = this.modal.querySelector('.modal-submit');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 创建订单中...';
        submitBtn.disabled = true;
        
        try {
            // 创建订单
            const result = await this.onSubmit(orderData);
            
            if (result && result.success) {
                // 关闭订单弹窗
                this.close();
                
                // 显示支付弹窗
                const paymentData = {
                    orderNo: result.orderNo,
                    orderId: result.orderId,
                    productName: this.product.name,
                    quantity: orderData.quantity,
                    totalAmount: result.totalAmount
                };
                
                // 动态创建PaymentModal
                if (!this.paymentModal) {
                    this.paymentModal = new window.PaymentModal();
                }
                this.paymentModal.show(paymentData);
            } else {
                throw new Error(result?.error || '订单创建失败');
            }
        } catch (error) {
            console.error('订单提交失败:', error);
            alert(error.message || '订单创建失败，请重试');
        } finally {
            // 恢复按钮状态
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    /**
     * 关闭模态框
     */
    close() {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
    }

    /**
     * 绑定支付事件
     */
    bindPaymentEvents() {
        // 支付成功事件
        window.addEventListener('payment:success', (e) => {
            const { orderNo, paymentMethod } = e.detail;
            console.log('支付成功:', orderNo, paymentMethod);
            
            // 可以在这里触发订单状态更新、页面刷新等操作
            if (window.shopManager) {
                window.shopManager.loadProducts();
            }
        });
        
        // 支付取消事件
        window.addEventListener('payment:cancelled', (e) => {
            const { orderNo } = e.detail;
            console.log('支付取消:', orderNo);
        });
        
        // 查看订单事件
        window.addEventListener('payment:view-order', (e) => {
            const { orderNo } = e.detail;
            console.log('查看订单:', orderNo);
            // 这里可以跳转到订单页面
        });
        
        // 联系客服事件
        window.addEventListener('payment:contact-support', (e) => {
            const { orderNo } = e.detail;
            console.log('联系客服:', orderNo);
            // 这里可以打开客服聊天窗口
        });
    }

    /**
     * 格式化价格
     * @param {number} price 价格
     * @returns {string} 格式化后的价格
     */
    formatPrice(price) {
        if (typeof price !== 'number') {
            return '0.00';
        }
        return price.toFixed(2);
    }
} 