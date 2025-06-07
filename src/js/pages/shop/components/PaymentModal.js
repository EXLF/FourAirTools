/**
 * 支付模态框组件
 */

class PaymentModal {
    constructor() {
        this.modal = null;
        this.currentOrder = null;
        this.paymentTimer = null;
        this.initModal();
    }

    initModal() {
        // 创建模态框HTML
        const modalHTML = `
            <div id="paymentModal" class="payment-modal">
                <div class="payment-modal-content">
                    <div class="payment-modal-header">
                        <h3>订单支付</h3>
                        <button class="payment-close-btn" id="paymentCloseBtn">&times;</button>
                    </div>
                    
                    <div class="payment-modal-body">
                        <!-- 订单信息 -->
                        <div class="payment-order-info">
                            <h4>订单信息</h4>
                            <div class="order-details">
                                <div class="order-item">
                                    <span class="label">订单号：</span>
                                    <span class="value" id="paymentOrderNo">-</span>
                                </div>
                                <div class="order-item">
                                    <span class="label">商品：</span>
                                    <span class="value" id="paymentProductName">-</span>
                                </div>
                                <div class="order-item">
                                    <span class="label">金额：</span>
                                    <span class="value amount" id="paymentAmount">¥0.00</span>
                                </div>
                            </div>
                        </div>

                        <!-- 支付方式选择 -->
                        <div class="payment-method-section">
                            <h4>选择支付方式</h4>
                            <div class="payment-methods">
                                <div class="payment-method-card" data-method="binance">
                                    <div class="method-icon">
                                        <i class="fas fa-coins"></i>
                                    </div>
                                    <div class="method-info">
                                        <h5>币安支付</h5>
                                        <p>USDT支付，安全快捷</p>
                                    </div>
                                </div>
                                <div class="payment-method-card" data-method="okx">
                                    <div class="method-icon">
                                        <i class="fas fa-credit-card"></i>
                                    </div>
                                    <div class="method-info">
                                        <h5>OKX支付</h5>
                                        <p>USDT支付，即时到账</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 二维码支付区域 -->
                        <div class="payment-qr-section" style="display: none;">
                            <h4>扫码支付</h4>
                            <div class="qr-container">
                                <div class="qr-code">
                                    <div id="qrCodePlaceholder">
                                        <i class="fas fa-qrcode"></i>
                                        <p>二维码加载中...</p>
                                    </div>
                                </div>
                                <div class="payment-instructions">
                                    <h5 id="paymentMethodTitle">支付说明</h5>
                                    <ol id="paymentInstructions">
                                        <li>打开支付应用扫描二维码</li>
                                        <li>确认支付金额无误</li>
                                        <li>完成支付</li>
                                        <li>等待支付确认</li>
                                    </ol>
                                </div>
                            </div>
                            
                            <div class="payment-status">
                                <div class="status-waiting">
                                    <i class="fas fa-clock"></i>
                                    <span>等待支付确认...</span>
                                    <div class="payment-timer">
                                        剩余时间: <span id="paymentCountdown">15:00</span>
                                    </div>
                                </div>
                            </div>

                            <div class="payment-actions">
                                <button class="btn-secondary" id="paymentCancelBtn">取消支付</button>
                                <button class="btn-primary" id="paymentConfirmBtn">我已支付</button>
                            </div>
                        </div>

                        <!-- 支付结果 -->
                        <div class="payment-result-section" style="display: none;">
                            <div class="result-content">
                                <div class="result-icon">
                                    <i class="fas fa-check-circle"></i>
                                </div>
                                <h4 class="result-title">支付成功</h4>
                                <p class="result-message">您的订单已支付成功，商品将在1小时内发货</p>
                                <div class="result-actions">
                                    <button class="btn-secondary" id="contactSupportBtn">联系客服</button>
                                    <button class="btn-primary" id="viewOrderBtn">查看订单</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('paymentModal');
        
        this.bindEvents();
    }

    bindEvents() {
        // 关闭按钮
        const closeBtn = document.getElementById('paymentCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // 点击模态框外部关闭
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // 支付方式选择
        const methodCards = document.querySelectorAll('.payment-method-card');
        methodCards.forEach(card => {
            card.addEventListener('click', (e) => {
                const method = card.dataset.method;
                this.selectPaymentMethod(method);
            });
        });

        // 支付确认
        const confirmBtn = document.getElementById('paymentConfirmBtn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.confirmPayment());
        }

        // 取消支付
        const cancelBtn = document.getElementById('paymentCancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelPayment());
        }

        // 结果页面按钮
        const viewOrderBtn = document.getElementById('viewOrderBtn');
        const contactSupportBtn = document.getElementById('contactSupportBtn');
        
        if (viewOrderBtn) {
            viewOrderBtn.addEventListener('click', () => this.viewOrder());
        }
        
        if (contactSupportBtn) {
            contactSupportBtn.addEventListener('click', () => this.contactSupport());
        }
    }

    show(orderData) {
        this.currentOrder = orderData;
        
        // 填充订单信息
        document.getElementById('paymentOrderNo').textContent = orderData.orderNo;
        document.getElementById('paymentProductName').textContent = orderData.productName || '未知商品';
        document.getElementById('paymentAmount').textContent = `¥${orderData.totalAmount.toFixed(2)}`;
        
        // 显示模态框
        this.modal.style.display = 'flex';
        
        // 重置状态
        this.resetModal();
    }

    close() {
        if (this.paymentTimer) {
            clearInterval(this.paymentTimer);
            this.paymentTimer = null;
        }
        this.modal.style.display = 'none';
        this.currentOrder = null;
    }

    resetModal() {
        // 显示支付方式选择，隐藏其他区域
        document.querySelector('.payment-method-section').style.display = 'block';
        document.querySelector('.payment-qr-section').style.display = 'none';
        document.querySelector('.payment-result-section').style.display = 'none';
        
        // 清除选中状态
        document.querySelectorAll('.payment-method-card').forEach(card => {
            card.classList.remove('selected');
        });
    }

    selectPaymentMethod(method) {
        // 更新选中状态
        document.querySelectorAll('.payment-method-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`[data-method="${method}"]`).classList.add('selected');
        
        // 显示二维码支付区域
        document.querySelector('.payment-method-section').style.display = 'none';
        document.querySelector('.payment-qr-section').style.display = 'block';
        
        // 更新支付方式信息
        const methodTitle = document.getElementById('paymentMethodTitle');
        const instructions = document.getElementById('paymentInstructions');
        
        if (method === 'binance') {
            methodTitle.textContent = '币安支付说明';
            instructions.innerHTML = `
                <li>打开币安App，扫描下方二维码</li>
                <li>确认支付金额为 ¥${this.currentOrder.totalAmount.toFixed(2)}</li>
                <li>选择USDT完成支付</li>
                <li>支付成功后点击"我已支付"</li>
            `;
        } else if (method === 'okx') {
            methodTitle.textContent = 'OKX支付说明';
            instructions.innerHTML = `
                <li>打开OKX App，扫描下方二维码</li>
                <li>确认支付金额为 ¥${this.currentOrder.totalAmount.toFixed(2)}</li>
                <li>选择USDT完成支付</li>
                <li>支付成功后点击"我已支付"</li>
            `;
        }
        
        // 生成二维码
        this.generateQRCode(method);
        
        // 开始倒计时
        this.startPaymentTimer();
    }

    generateQRCode(method) {
        const qrPlaceholder = document.getElementById('qrCodePlaceholder');
        
        // 模拟二维码生成（实际项目中应该调用后端API获取真实的支付二维码）
        const qrData = {
            binance: `binance://pay?amount=${this.currentOrder.totalAmount}&currency=USDT&orderId=${this.currentOrder.orderNo}`,
            okx: `okx://pay?amount=${this.currentOrder.totalAmount}&currency=USDT&orderId=${this.currentOrder.orderNo}`
        };
        
        // 简单的二维码占位符
        qrPlaceholder.innerHTML = `
            <div class="qr-code-display">
                <div class="qr-placeholder">
                    <i class="fas fa-qrcode" style="font-size: 120px; color: #333;"></i>
                    <p>支付二维码</p>
                    <small>${method.toUpperCase()} 支付</small>
                </div>
            </div>
        `;
    }

    startPaymentTimer() {
        let timeLeft = 15 * 60; // 15分钟
        const countdownElement = document.getElementById('paymentCountdown');
        
        this.paymentTimer = setInterval(() => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            countdownElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            if (timeLeft <= 0) {
                this.paymentTimeout();
            }
            
            timeLeft--;
        }, 1000);
    }

    paymentTimeout() {
        clearInterval(this.paymentTimer);
        this.showResult(false, '支付超时', '支付时间已超时，请重新创建订单');
    }

    async confirmPayment() {
        // 显示加载状态
        const confirmBtn = document.getElementById('paymentConfirmBtn');
        const originalText = confirmBtn.textContent;
        confirmBtn.textContent = '确认中...';
        confirmBtn.disabled = true;
        
        try {
            // 模拟支付确认（实际项目中应该调用后端API确认支付状态）
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 更新订单支付状态
            const result = await window.electron.ipcRenderer.invoke('shop:updatePaymentStatus', 
                this.currentOrder.orderNo, 'paid', 'crypto');
            
            if (result.success) {
                this.showResult(true, '支付成功', '您的订单已支付成功，商品将在1小时内发货到您的邮箱');
            } else {
                throw new Error(result.error || '支付确认失败');
            }
        } catch (error) {
            console.error('支付确认失败:', error);
            this.showResult(false, '支付确认失败', error.message || '请联系客服处理');
        } finally {
            confirmBtn.textContent = originalText;
            confirmBtn.disabled = false;
        }
    }

    cancelPayment() {
        if (confirm('确定要取消支付吗？')) {
            this.dispatchEvent('payment:cancelled', {
                orderNo: this.currentOrder.orderNo
            });
            this.close();
        }
    }

    showResult(success, title, message) {
        clearInterval(this.paymentTimer);
        
        // 隐藏支付区域，显示结果区域
        document.querySelector('.payment-qr-section').style.display = 'none';
        document.querySelector('.payment-result-section').style.display = 'block';
        
        // 更新结果内容
        const resultIcon = document.querySelector('.result-icon i');
        const resultTitle = document.querySelector('.result-title');
        const resultMessage = document.querySelector('.result-message');
        
        if (success) {
            resultIcon.className = 'fas fa-check-circle';
            resultIcon.style.color = '#4CAF50';
            resultTitle.textContent = title;
            resultMessage.textContent = message;
            
            this.dispatchEvent('payment:success', {
                orderNo: this.currentOrder.orderNo,
                amount: this.currentOrder.totalAmount
            });
        } else {
            resultIcon.className = 'fas fa-times-circle';
            resultIcon.style.color = '#f44336';
            resultTitle.textContent = title;
            resultMessage.textContent = message;
            
            this.dispatchEvent('payment:failed', {
                orderNo: this.currentOrder.orderNo,
                error: message
            });
        }
    }

    viewOrder() {
        this.dispatchEvent('payment:viewOrder', {
            orderNo: this.currentOrder.orderNo
        });
        this.close();
    }

    contactSupport() {
        this.dispatchEvent('payment:contactSupport', {
            orderNo: this.currentOrder.orderNo
        });
    }

    dispatchEvent(eventName, data) {
        const event = new CustomEvent(eventName, { detail: data });
        document.dispatchEvent(event);
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaymentModal;
} else {
    window.PaymentModal = PaymentModal;
} 