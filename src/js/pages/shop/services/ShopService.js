/**
 * 商店服务层
 * 负责商店相关的业务逻辑和数据交互
 */

// 使用预加载脚本提供的 electronAPI

class ShopService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5分钟缓存
    }

    /**
     * 获取商品分类
     */
    async getCategories() {
        const cacheKey = 'categories';
        
        // 检查缓存
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const result = await window.electron.ipcRenderer.invoke('shop:getCategories');
            
            if (!result.success) {
                throw new Error(result.error || '获取分类失败');
            }

            const categories = [
                { id: 'all', name: '全部商品', icon: 'fas fa-th-large' },
                ...result.data.map(category => ({
                    id: category.id.toString(),
                    name: category.name,
                    icon: category.icon || 'fas fa-tag',
                    description: category.description
                }))
            ];

            // 更新缓存
            this.cache.set(cacheKey, {
                data: categories,
                timestamp: Date.now()
            });

            return categories;
        } catch (error) {
            console.error('获取分类失败:', error);
            // 返回默认分类
            return [
                { id: 'all', name: '全部商品', icon: 'fas fa-th-large' },
                { id: '1', name: 'IP代理', icon: 'fas fa-globe' },
                { id: '2', name: 'Twitter账号', icon: 'fab fa-twitter' },
                { id: '3', name: 'Discord账号', icon: 'fab fa-discord' },
                { id: '4', name: 'Telegram账号', icon: 'fab fa-telegram' },
                { id: '5', name: '工具软件', icon: 'fas fa-tools' },
                { id: '6', name: '付费教程', icon: 'fas fa-graduation-cap' }
            ];
        }
    }

    /**
     * 获取商品列表
     */
    async getProducts(params = {}) {
        try {
            const result = await window.electron.ipcRenderer.invoke('shop:getProducts', params);
            
            if (!result.success) {
                throw new Error(result.error || '获取商品列表失败');
            }

            // 格式化商品数据
            const formattedProducts = result.data.products.map(product => {
                const productData = product.product_data ? JSON.parse(product.product_data) : {};
                
                return {
                    id: product.id,
                    categoryId: product.category_id,
                    categoryName: product.category_name,
                    name: product.name,
                    description: product.description,
                    price: parseFloat(product.price),
                    stock: product.stock_quantity,
                    isDigital: product.is_digital === 1,
                    productType: product.product_type,
                    imageUrl: product.image_url,
                    isNew: productData.is_new === true,
                    isHot: productData.is_hot === true,
                    isPromo: productData.is_promo === true,
                    features: productData.features || [],
                    specifications: productData.specifications || [],
                    deliveryInfo: productData.delivery_info || '自动发货',
                    createdAt: product.created_at,
                    updatedAt: product.updated_at
                };
            });

            return {
                products: formattedProducts,
                pagination: result.data.pagination
            };
        } catch (error) {
            console.error('获取商品列表失败:', error);
            return {
                products: [],
                pagination: {
                    currentPage: 1,
                    pageSize: 12,
                    totalPages: 0,
                    total: 0
                }
            };
        }
    }

    /**
     * 获取单个商品详情
     */
    async getProduct(productId) {
        try {
            const result = await window.electron.ipcRenderer.invoke('shop:getProduct', productId);
            
            if (!result.success) {
                throw new Error(result.error || '获取商品详情失败');
            }

            const product = result.data;
            const productData = product.product_data ? JSON.parse(product.product_data) : {};
            
            return {
                id: product.id,
                categoryId: product.category_id,
                categoryName: product.category_name,
                name: product.name,
                description: product.description,
                price: parseFloat(product.price),
                stock: product.stock_quantity,
                isDigital: product.is_digital === 1,
                productType: product.product_type,
                imageUrl: product.image_url,
                isNew: productData.is_new === true,
                isHot: productData.is_hot === true,
                isPromo: productData.is_promo === true,
                features: productData.features || [],
                specifications: productData.specifications || [],
                deliveryInfo: productData.delivery_info || '自动发货',
                createdAt: product.created_at,
                updatedAt: product.updated_at
            };
        } catch (error) {
            console.error('获取商品详情失败:', error);
            return null;
        }
    }

    /**
     * 创建订单
     */
    async createOrder(orderData) {
        try {
            // 获取当前用户ID (这里需要从用户系统获取)
            const userId = await this.getCurrentUserId();
            
            const result = await window.electron.ipcRenderer.invoke('shop:createOrder', {
                ...orderData,
                userId
            });
            
            if (!result.success) {
                throw new Error(result.error || '创建订单失败');
            }

            return {
                success: true,
                orderId: result.orderId,
                orderNo: result.orderNo,
                totalAmount: result.totalAmount
            };
        } catch (error) {
            console.error('创建订单失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 获取用户订单列表
     */
    async getUserOrders(params = {}) {
        try {
            const userId = await this.getCurrentUserId();
            
            const result = await window.electron.ipcRenderer.invoke('shop:getUserOrders', {
                ...params,
                userId
            });
            
            if (!result.success) {
                throw new Error(result.error || '获取订单列表失败');
            }

            return result.data;
        } catch (error) {
            console.error('获取订单列表失败:', error);
            return {
                orders: [],
                pagination: {
                    currentPage: 1,
                    pageSize: 10,
                    totalPages: 0,
                    total: 0
                }
            };
        }
    }

    /**
     * 获取订单详情
     */
    async getOrderDetails(orderNo) {
        try {
            const userId = await this.getCurrentUserId();
            
            const result = await window.electron.ipcRenderer.invoke('shop:getOrderDetails', orderNo, userId);
            
            if (!result.success) {
                throw new Error(result.error || '获取订单详情失败');
            }

            return result.data;
        } catch (error) {
            console.error('获取订单详情失败:', error);
            return null;
        }
    }

    /**
     * 更新支付状态
     */
    async updatePaymentStatus(orderNo, paymentStatus, paymentMethod = null) {
        try {
            const result = await window.electron.ipcRenderer.invoke('shop:updatePaymentStatus', orderNo, paymentStatus, paymentMethod);
            
            if (!result.success) {
                throw new Error(result.error || '更新支付状态失败');
            }

            return { success: true };
        } catch (error) {
            console.error('更新支付状态失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 获取当前用户ID
     * 这里需要根据实际的用户系统来实现
     */
    async getCurrentUserId() {
        // 临时实现，返回默认用户ID
        // 在实际应用中，这应该从用户认证系统获取
        return 1;
    }

    /**
     * 格式化价格
     */
    formatPrice(price) {
        return `¥${parseFloat(price).toFixed(2)}`;
    }

    /**
     * 格式化日期
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * 获取订单状态文本
     */
    getOrderStatusText(status) {
        const statusMap = {
            'pending': '待处理',
            'paid': '已支付',
            'processing': '处理中',
            'shipped': '已发货',
            'delivered': '已完成',
            'cancelled': '已取消',
            'refunded': '已退款'
        };
        return statusMap[status] || status;
    }

    /**
     * 获取支付状态文本
     */
    getPaymentStatusText(status) {
        const statusMap = {
            'unpaid': '未支付',
            'paid': '已支付',
            'failed': '支付失败',
            'cancelled': '已取消',
            'refunded': '已退款'
        };
        return statusMap[status] || status;
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.cache.clear();
    }
}

export { ShopService }; 