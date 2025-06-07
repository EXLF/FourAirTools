/**
 * 撸毛商店模块 - 主页面
 * 提供IP代理、社交账号、工具软件等商品销售服务
 */

import { ShopService } from './services/ShopService.js';
import { ProductCard } from './components/ProductCard.js';
import { CategoryFilter } from './components/CategoryFilter.js';
import { OrderModal } from './components/OrderModal.js';

class ShopManager {
    constructor() {
        this.shopService = new ShopService();
        this.currentCategory = 'all';
        this.currentPage = 1;
        this.pageSize = 12;
        this.isLoading = false;
        
        // 绑定方法
        this.loadCategories = this.loadCategories.bind(this);
        this.loadProducts = this.loadProducts.bind(this);
        this.handleCategoryChange = this.handleCategoryChange.bind(this);
        this.handleProductPurchase = this.handleProductPurchase.bind(this);
    }

    /**
     * 初始化商店页面
     * @param {HTMLElement} contentArea 
     */
    async init(contentArea) {
        try {
            this.contentArea = contentArea;
            
            // 渲染页面基础结构
            this.renderShopLayout();
            
            // 加载数据
            await Promise.all([
                this.loadCategories(),
                this.loadProducts()
            ]);
            
            // 绑定事件
            this.bindEvents();
            
            console.log('撸毛商店初始化完成');
        } catch (error) {
            console.error('商店初始化失败:', error);
            this.showError('商店加载失败，请稍后重试');
        }
    }

    /**
     * 渲染商店页面布局
     */
    renderShopLayout() {
        this.contentArea.innerHTML = `
            <div class="shop-container">
                <!-- 商店头部 -->
                <div class="shop-header">
                    <div class="shop-hero">
                        <h1><i class="fas fa-shopping-cart"></i> 撸毛商店</h1>
                        <p>一站式撸毛资源采购平台 - IP代理、社交账号、工具软件应有尽有</p>
                    </div>
                    
                    <!-- 分类筛选 -->
                    <div id="category-filter-container" class="category-filter-container">
                        <!-- 分类按钮将动态插入到这里 -->
                    </div>
                    
                    <!-- 搜索和排序 -->
                    <div class="shop-controls">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="search-input" placeholder="搜索商品..." />
                        </div>
                        <div class="sort-controls">
                            <select id="sort-select">
                                <option value="newest">最新上架</option>
                                <option value="price-low">价格从低到高</option>
                                <option value="price-high">价格从高到低</option>
                                <option value="popular">热门商品</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 商品网格 -->
                <div class="shop-content">
                    <div id="products-loading" class="loading-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>加载商品中...</span>
                    </div>
                    
                    <div id="products-grid" class="products-grid" style="display: none;">
                        <!-- 商品卡片将动态插入到这里 -->
                    </div>
                    
                    <div id="products-empty" class="empty-state" style="display: none;">
                        <i class="fas fa-box-open"></i>
                        <h3>暂无商品</h3>
                        <p>该分类下暂时没有商品，请稍后查看或切换其他分类</p>
                    </div>
                </div>

                <!-- 分页 -->
                <div id="pagination" class="pagination-container" style="display: none;">
                    <!-- 分页按钮将动态插入到这里 -->
                </div>
                

            </div>
        `;
    }

    /**
     * 加载商品分类
     */
    async loadCategories() {
        try {
            const categories = await this.shopService.getCategories();
            
            // 渲染分类筛选器
            const filterContainer = this.contentArea.querySelector('#category-filter-container');
            const categoryFilter = new CategoryFilter(categories, this.handleCategoryChange);
            categoryFilter.render(filterContainer);
            

            
        } catch (error) {
            console.error('加载分类失败:', error);
        }
    }

    /**
     * 加载商品列表
     */
    async loadProducts() {
        if (this.isLoading) return;
        
        try {
            this.isLoading = true;
            this.showLoadingState();
            
            const params = {
                category: this.currentCategory,
                page: this.currentPage,
                pageSize: this.pageSize,
                search: this.getSearchTerm(),
                sort: this.getSortOrder()
            };
            
            const result = await this.shopService.getProducts(params);
            
                         if (result.products && result.products.length > 0) {
                 this.renderProducts(result.products);
                 this.renderPagination(result.pagination);
             } else {
                 this.showEmptyState();
             }
            
        } catch (error) {
            console.error('加载商品失败:', error);
            this.showError('商品加载失败，请稍后重试');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * 渲染商品列表
     */
    renderProducts(products) {
        const productsGrid = this.contentArea.querySelector('#products-grid');
        
        // 清空现有内容
        productsGrid.innerHTML = '';
        
        // 渲染商品卡片
        products.forEach(product => {
            const productCard = new ProductCard(product, this.handleProductPurchase);
            const cardElement = productCard.render();
            productsGrid.appendChild(cardElement);
        });
        
        // 显示商品网格
        this.hideLoadingState();
        this.hideEmptyState();
        productsGrid.style.display = 'grid';
    }

    /**
     * 渲染分页
     */
    renderPagination(pagination) {
        const paginationContainer = this.contentArea.querySelector('#pagination');
        
        if (pagination.totalPages <= 1) {
            paginationContainer.style.display = 'none';
            return;
        }
        
        paginationContainer.innerHTML = `
            <div class="pagination">
                <button class="page-btn" ${pagination.currentPage <= 1 ? 'disabled' : ''} 
                        onclick="shopManager.goToPage(${pagination.currentPage - 1})">
                    <i class="fas fa-chevron-left"></i> 上一页
                </button>
                
                <div class="page-numbers">
                    ${this.generatePageNumbers(pagination)}
                </div>
                
                <button class="page-btn" ${pagination.currentPage >= pagination.totalPages ? 'disabled' : ''} 
                        onclick="shopManager.goToPage(${pagination.currentPage + 1})">
                    下一页 <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            
            <div class="pagination-info">
                ${(() => {
                    const info = this.calculatePaginationInfo(pagination);
                    return `显示 ${info.start} - ${info.end} 项，共 ${pagination.total} 项`;
                })()}
            </div>
        `;
        
        paginationContainer.style.display = 'block';
    }

    /**
     * 计算分页信息
     */
    calculatePaginationInfo(pagination) {
        const { currentPage, pageSize, total } = pagination;
        const start = Math.min((currentPage - 1) * pageSize + 1, total);
        const end = Math.min(currentPage * pageSize, total);
        return { start, end };
    }

    /**
     * 生成页码按钮
     */
    generatePageNumbers(pagination) {
        const { currentPage, totalPages } = pagination;
        const pageNumbers = [];
        
        // 计算显示的页码范围
        const maxPages = 7;
        let startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
        let endPage = Math.min(totalPages, startPage + maxPages - 1);
        
        if (endPage - startPage < maxPages - 1) {
            startPage = Math.max(1, endPage - maxPages + 1);
        }
        
        // 第一页
        if (startPage > 1) {
            pageNumbers.push(`<button class="page-number" onclick="shopManager.goToPage(1)">1</button>`);
            if (startPage > 2) {
                pageNumbers.push(`<span class="page-ellipsis">...</span>`);
            }
        }
        
        // 中间页码
        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === currentPage ? 'active' : '';
            pageNumbers.push(`<button class="page-number ${isActive}" onclick="shopManager.goToPage(${i})">${i}</button>`);
        }
        
        // 最后一页
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                pageNumbers.push(`<span class="page-ellipsis">...</span>`);
            }
            pageNumbers.push(`<button class="page-number" onclick="shopManager.goToPage(${totalPages})">${totalPages}</button>`);
        }
        
        return pageNumbers.join('');
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 搜索事件
        const searchInput = this.contentArea.querySelector('#search-input');
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.currentPage = 1;
                this.loadProducts();
            }, 500);
        });
        
        // 排序事件
        const sortSelect = this.contentArea.querySelector('#sort-select');
        sortSelect.addEventListener('change', () => {
            this.currentPage = 1;
            this.loadProducts();
        });
    }

    /**
     * 处理分类切换
     */
    handleCategoryChange(categoryId) {
        this.currentCategory = categoryId;
        this.currentPage = 1;
        this.loadProducts();
    }

    /**
     * 处理商品购买
     */
    handleProductPurchase(product) {
        const orderModal = new OrderModal(product, async (orderData) => {
            try {
                const result = await this.shopService.createOrder(orderData);
                if (result.success) {
                    this.showSuccess('订单创建成功！请前往支付');
                    // 可以跳转到订单页面或打开支付模态框
                } else {
                    this.showError(result.message || '订单创建失败');
                }
            } catch (error) {
                console.error('创建订单失败:', error);
                this.showError('订单创建失败，请稍后重试');
            }
        });
        
        orderModal.show();
    }

    /**
     * 跳转到指定页面
     */
    goToPage(page) {
        this.currentPage = page;
        this.loadProducts();
    }

    /**
     * 获取搜索关键词
     */
    getSearchTerm() {
        const searchInput = this.contentArea.querySelector('#search-input');
        return searchInput ? searchInput.value.trim() : '';
    }

    /**
     * 获取排序方式
     */
    getSortOrder() {
        const sortSelect = this.contentArea.querySelector('#sort-select');
        return sortSelect ? sortSelect.value : 'newest';
    }

    /**
     * 显示加载状态
     */
    showLoadingState() {
        const loading = this.contentArea.querySelector('#products-loading');
        const grid = this.contentArea.querySelector('#products-grid');
        const empty = this.contentArea.querySelector('#products-empty');
        
        if (loading) loading.style.display = 'flex';
        if (grid) grid.style.display = 'none';
        if (empty) empty.style.display = 'none';
    }

    /**
     * 隐藏加载状态
     */
    hideLoadingState() {
        const loading = this.contentArea.querySelector('#products-loading');
        if (loading) loading.style.display = 'none';
    }

    /**
     * 显示空状态
     */
    showEmptyState() {
        const loading = this.contentArea.querySelector('#products-loading');
        const grid = this.contentArea.querySelector('#products-grid');
        const empty = this.contentArea.querySelector('#products-empty');
        
        if (loading) loading.style.display = 'none';
        if (grid) grid.style.display = 'none';
        if (empty) empty.style.display = 'flex';
    }

    /**
     * 隐藏空状态
     */
    hideEmptyState() {
        const empty = this.contentArea.querySelector('#products-empty');
        if (empty) empty.style.display = 'none';
    }



    /**
     * 显示成功消息
     */
    showSuccess(message) {
        // 可以使用现有的通知系统
        if (window.showToast) {
            window.showToast(message, 'success');
        } else {
            console.log('成功:', message);
        }
    }

    /**
     * 显示错误消息
     */
    showError(message) {
        // 可以使用现有的通知系统
        if (window.showToast) {
            window.showToast(message, 'error');
        } else {
            console.error('错误:', message);
        }
    }
}

// 全局实例，供页面调用
let shopManager;

/**
 * 初始化撸毛商店页面
 * @param {HTMLElement} contentArea 
 */
export function initShopPage(contentArea) {
    console.log("初始化撸毛商店...");
    
    shopManager = new ShopManager();
    shopManager.init(contentArea);
    
    // 将实例挂载到全局，供分页等功能调用
    window.shopManager = shopManager;
}

// 导出管理类供其他模块使用
export { ShopManager }; 