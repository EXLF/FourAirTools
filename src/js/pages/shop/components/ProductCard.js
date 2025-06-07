/**
 * 商品卡片组件
 */

export class ProductCard {
    constructor(product, onPurchase) {
        this.product = product;
        this.onPurchase = onPurchase;
    }

    /**
     * 渲染商品卡片
     * @returns {HTMLElement} 商品卡片元素
     */
    render() {
        const cardElement = document.createElement('div');
        cardElement.className = 'product-card';
        cardElement.innerHTML = this.generateCardHTML();
        
        this.bindEvents(cardElement);
        return cardElement;
    }

    /**
     * 生成卡片HTML
     * @returns {string} HTML字符串
     */
    generateCardHTML() {
        const product = this.product;
        const badges = this.generateBadges();
        const features = this.generateFeatures();
        const price = this.formatPrice(product.price);
        const stockInfo = this.getStockInfo();

        return `
            <div class="product-image">
                ${badges}
                <img src="${product.imageUrl || 'src/assets/icons/default.svg'}" alt="${product.name}" 
                     onerror="this.src='src/assets/icons/default.svg'">
            </div>
            
            <div class="product-content">
                <div class="product-category">${product.category}</div>
                <h3 class="product-title">${product.name}</h3>
                <p class="product-description">${product.description || '暂无描述'}</p>
                
                ${features}
                
                <div class="product-price">
                    <div class="price-main">
                        <span class="price-amount">${price}</span>
                        <span class="price-currency">元</span>
                    </div>
                    <div class="stock-info ${product.stock < 10 ? 'low-stock' : ''}">
                        ${stockInfo}
                    </div>
                </div>
                
                <div class="product-actions">
                    <button class="btn-purchase" ${product.stock <= 0 ? 'disabled' : ''} 
                            data-product-id="${product.id}">
                        <i class="fas fa-shopping-cart"></i>
                        ${product.stock <= 0 ? '缺货' : '立即购买'}
                    </button>
                    <button class="btn-details" data-product-id="${product.id}">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 生成商品徽章
     * @returns {string} 徽章HTML
     */
    generateBadges() {
        const badges = [];
        
        if (this.product.isNew) {
            badges.push('<span class="product-badge new">新品</span>');
        }
        
        if (this.product.isHot) {
            badges.push('<span class="product-badge hot">热销</span>');
        }
        
        if (this.product.onSale) {
            badges.push('<span class="product-badge sale">促销</span>');
        }

        return badges.length > 0 ? `<div class="product-badges">${badges.join('')}</div>` : '';
    }

    /**
     * 生成特性标签
     * @returns {string} 特性HTML
     */
    generateFeatures() {
        if (!this.product.features || this.product.features.length === 0) {
            return '';
        }

        const featureTags = this.product.features.slice(0, 3).map(feature => 
            `<span class="feature-tag">${feature}</span>`
        ).join('');

        return `<div class="product-features">${featureTags}</div>`;
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

    /**
     * 获取库存信息
     * @returns {string} 库存信息文本
     */
    getStockInfo() {
        const stock = this.product.stock;
        
        if (stock <= 0) {
            return '缺货';
        } else if (stock < 10) {
            return `仅余 ${stock} 件`;
        } else {
            return `库存 ${stock} 件`;
        }
    }

    /**
     * 绑定事件
     * @param {HTMLElement} cardElement 卡片元素
     */
    bindEvents(cardElement) {
        // 购买按钮事件
        const purchaseBtn = cardElement.querySelector('.btn-purchase');
        if (purchaseBtn && !purchaseBtn.disabled) {
            purchaseBtn.addEventListener('click', () => {
                if (this.onPurchase) {
                    this.onPurchase(this.product);
                }
            });
        }

        // 详情按钮事件
        const detailsBtn = cardElement.querySelector('.btn-details');
        if (detailsBtn) {
            detailsBtn.addEventListener('click', () => {
                this.showProductDetails();
            });
        }

        // 卡片悬停效果（可选）
        cardElement.addEventListener('mouseenter', () => {
            cardElement.style.transform = 'translateY(-4px)';
        });

        cardElement.addEventListener('mouseleave', () => {
            cardElement.style.transform = 'translateY(0)';
        });
    }

    /**
     * 显示商品详情
     */
    showProductDetails() {
        // 创建详情模态框
        const modal = document.createElement('div');
        modal.className = 'product-details-modal';
        modal.innerHTML = `
            <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${this.product.name}</h3>
                    <button class="modal-close" onclick="this.closest('.product-details-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="product-image-large">
                        <img src="${this.product.imageUrl || 'src/assets/icons/default.svg'}" alt="${this.product.name}" 
                             onerror="this.src='src/assets/icons/default.svg'">
                    </div>
                    <div class="product-info">
                        <p class="product-category">${this.product.category}</p>
                        <h4>${this.product.name}</h4>
                        <p class="product-description">${this.product.description || '暂无详细描述'}</p>
                        
                        ${this.generateSpecsHTML()}
                        
                        <div class="product-price-large">
                            <span class="price-amount">${this.formatPrice(this.product.price)}</span>
                            <span class="price-currency">元</span>
                        </div>
                        
                        <div class="modal-actions">
                            <button class="btn-purchase-modal" ${this.product.stock <= 0 ? 'disabled' : ''}>
                                <i class="fas fa-shopping-cart"></i>
                                ${this.product.stock <= 0 ? '缺货' : '立即购买'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 添加模态框样式
        if (!document.querySelector('#product-modal-styles')) {
            const styles = document.createElement('style');
            styles.id = 'product-modal-styles';
            styles.textContent = `
                .product-details-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .modal-backdrop {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                }
                .modal-content {
                    position: relative;
                    background: white;
                    border-radius: 16px;
                    max-width: 600px;
                    max-height: 80vh;
                    overflow-y: auto;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
                }
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px;
                    border-bottom: 1px solid #eee;
                }
                .modal-close {
                    background: none;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    color: #999;
                }
                .modal-body {
                    padding: 20px;
                }
                .product-image-large img {
                    width: 100%;
                    max-height: 200px;
                    object-fit: cover;
                    border-radius: 8px;
                }
                .btn-purchase-modal {
                    width: 100%;
                    padding: 12px;
                    background: #667eea;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                }
            `;
            document.head.appendChild(styles);
        }

        // 绑定购买事件
        const purchaseBtn = modal.querySelector('.btn-purchase-modal');
        if (purchaseBtn && !purchaseBtn.disabled) {
            purchaseBtn.addEventListener('click', () => {
                modal.remove();
                if (this.onPurchase) {
                    this.onPurchase(this.product);
                }
            });
        }

        document.body.appendChild(modal);
    }

    /**
     * 生成规格HTML
     * @returns {string} 规格HTML
     */
    generateSpecsHTML() {
        if (!this.product.specs || Object.keys(this.product.specs).length === 0) {
            return '';
        }

        const specsHTML = Object.entries(this.product.specs).map(([key, value]) => 
            `<div class="spec-item"><span class="spec-key">${key}:</span> <span class="spec-value">${value}</span></div>`
        ).join('');

        return `<div class="product-specs">${specsHTML}</div>`;
    }
} 