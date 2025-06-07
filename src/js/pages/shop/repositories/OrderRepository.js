/**
 * 订单数据访问层
 * 处理订单相关的数据库操作
 */

export class OrderRepository {
    constructor() {
        // 模拟订单数据存储
        this.mockOrders = [];
        this.mockOrderItems = [];
        this.nextOrderId = 1;
        this.nextOrderItemId = 1;
    }

    /**
     * 创建订单
     * @param {Object} orderData 订单数据
     * @returns {Promise<Object>} 创建结果
     */
    async createOrder(orderData) {
        try {
            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const order = {
                id: this.nextOrderId++,
                user_id: orderData.user_id,
                order_no: orderData.order_no,
                total_amount: orderData.total_amount,
                status: 'pending',
                payment_method: null,
                payment_status: 'unpaid',
                notes: orderData.notes || '',
                contact_info: orderData.contact_info || '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            this.mockOrders.push(order);
            
            console.log('订单创建成功:', order);
            return { success: true, orderId: order.id };
        } catch (error) {
            console.error('创建订单失败:', error);
            throw error;
        }
    }

    /**
     * 创建订单明细
     * @param {Object} orderItemData 订单明细数据
     * @returns {Promise<Object>} 创建结果
     */
    async createOrderItem(orderItemData) {
        try {
            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const orderItem = {
                id: this.nextOrderItemId++,
                order_id: orderItemData.order_id,
                product_id: orderItemData.product_id,
                product_name: orderItemData.product_name,
                product_price: orderItemData.product_price,
                quantity: orderItemData.quantity,
                subtotal: orderItemData.subtotal,
                delivery_data: null,
                delivery_status: 'pending',
                created_at: new Date().toISOString()
            };
            
            this.mockOrderItems.push(orderItem);
            
            console.log('订单明细创建成功:', orderItem);
            return { success: true, orderItemId: orderItem.id };
        } catch (error) {
            console.error('创建订单明细失败:', error);
            throw error;
        }
    }

    /**
     * 根据订单号获取订单
     * @param {string} orderNo 订单号
     * @returns {Promise<Object|null>} 订单信息
     */
    async getOrderByNo(orderNo) {
        try {
            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const order = this.mockOrders.find(o => o.order_no === orderNo);
            return order || null;
        } catch (error) {
            console.error('获取订单失败:', error);
            throw error;
        }
    }

    /**
     * 根据订单ID获取订单明细
     * @param {number} orderId 订单ID
     * @returns {Promise<Array>} 订单明细列表
     */
    async getOrderItems(orderId) {
        try {
            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const orderItems = this.mockOrderItems.filter(item => item.order_id === orderId);
            return orderItems;
        } catch (error) {
            console.error('获取订单明细失败:', error);
            throw error;
        }
    }

    /**
     * 获取用户订单列表
     * @param {Object} params 查询参数
     * @returns {Promise<Object>} 订单列表和总数
     */
    async getUserOrders(params = {}) {
        try {
            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const {
                user_id,
                status,
                page = 1,
                pageSize = 10
            } = params;

            let filteredOrders = [...this.mockOrders];

            // 用户筛选
            if (user_id) {
                filteredOrders = filteredOrders.filter(order => order.user_id === user_id);
            }

            // 状态筛选
            if (status) {
                filteredOrders = filteredOrders.filter(order => order.status === status);
            }

            // 按创建时间倒序排序
            filteredOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            // 分页
            const totalCount = filteredOrders.length;
            const startIndex = (page - 1) * pageSize;
            const paginatedOrders = filteredOrders.slice(startIndex, startIndex + pageSize);

            return {
                orders: paginatedOrders,
                totalCount
            };
        } catch (error) {
            console.error('获取用户订单失败:', error);
            throw error;
        }
    }

    /**
     * 更新订单状态
     * @param {number} orderId 订单ID
     * @param {string} status 新状态
     * @returns {Promise<boolean>} 更新结果
     */
    async updateOrderStatus(orderId, status) {
        try {
            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const orderIndex = this.mockOrders.findIndex(o => o.id === orderId);
            if (orderIndex === -1) {
                throw new Error('订单不存在');
            }
            
            this.mockOrders[orderIndex].status = status;
            this.mockOrders[orderIndex].updated_at = new Date().toISOString();
            
            console.log(`订单 ${orderId} 状态更新为: ${status}`);
            return true;
        } catch (error) {
            console.error('更新订单状态失败:', error);
            throw error;
        }
    }

    /**
     * 更新支付状态
     * @param {number} orderId 订单ID
     * @param {string} paymentStatus 支付状态
     * @param {string} paymentMethod 支付方式
     * @returns {Promise<boolean>} 更新结果
     */
    async updatePaymentStatus(orderId, paymentStatus, paymentMethod = null) {
        try {
            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const orderIndex = this.mockOrders.findIndex(o => o.id === orderId);
            if (orderIndex === -1) {
                throw new Error('订单不存在');
            }
            
            this.mockOrders[orderIndex].payment_status = paymentStatus;
            if (paymentMethod) {
                this.mockOrders[orderIndex].payment_method = paymentMethod;
            }
            this.mockOrders[orderIndex].updated_at = new Date().toISOString();
            
            // 如果支付成功，自动更新订单状态
            if (paymentStatus === 'paid') {
                this.mockOrders[orderIndex].status = 'paid';
            }
            
            console.log(`订单 ${orderId} 支付状态更新为: ${paymentStatus}`);
            return true;
        } catch (error) {
            console.error('更新支付状态失败:', error);
            throw error;
        }
    }

    /**
     * 更新订单明细交付状态
     * @param {number} orderItemId 订单明细ID
     * @param {string} deliveryStatus 交付状态
     * @param {Object} deliveryData 交付数据
     * @returns {Promise<boolean>} 更新结果
     */
    async updateDeliveryStatus(orderItemId, deliveryStatus, deliveryData = null) {
        try {
            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const itemIndex = this.mockOrderItems.findIndex(item => item.id === orderItemId);
            if (itemIndex === -1) {
                throw new Error('订单明细不存在');
            }
            
            this.mockOrderItems[itemIndex].delivery_status = deliveryStatus;
            if (deliveryData) {
                this.mockOrderItems[itemIndex].delivery_data = JSON.stringify(deliveryData);
            }
            
            console.log(`订单明细 ${orderItemId} 交付状态更新为: ${deliveryStatus}`);
            return true;
        } catch (error) {
            console.error('更新交付状态失败:', error);
            throw error;
        }
    }

    /**
     * 删除订单（软删除）
     * @param {number} orderId 订单ID
     * @returns {Promise<boolean>} 删除结果
     */
    async deleteOrder(orderId) {
        try {
            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const orderIndex = this.mockOrders.findIndex(o => o.id === orderId);
            if (orderIndex === -1) {
                throw new Error('订单不存在');
            }
            
            // 软删除：更新状态为cancelled
            this.mockOrders[orderIndex].status = 'cancelled';
            this.mockOrders[orderIndex].updated_at = new Date().toISOString();
            
            console.log(`订单 ${orderId} 已取消`);
            return true;
        } catch (error) {
            console.error('删除订单失败:', error);
            throw error;
        }
    }

    /**
     * 获取订单统计信息
     * @param {string} userId 用户ID（可选）
     * @returns {Promise<Object>} 统计信息
     */
    async getOrderStats(userId = null) {
        try {
            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 100));
            
            let orders = [...this.mockOrders];
            
            if (userId) {
                orders = orders.filter(order => order.user_id === userId);
            }
            
            const stats = {
                total: orders.length,
                pending: orders.filter(o => o.status === 'pending').length,
                paid: orders.filter(o => o.status === 'paid').length,
                delivered: orders.filter(o => o.status === 'delivered').length,
                cancelled: orders.filter(o => o.status === 'cancelled').length,
                refunded: orders.filter(o => o.status === 'refunded').length,
                totalAmount: orders.reduce((sum, order) => sum + parseFloat(order.total_amount), 0)
            };
            
            return stats;
        } catch (error) {
            console.error('获取订单统计失败:', error);
            throw error;
        }
    }

    /**
     * 获取最近订单
     * @param {string} userId 用户ID
     * @param {number} limit 限制数量
     * @returns {Promise<Array>} 最近订单列表
     */
    async getRecentOrders(userId, limit = 5) {
        try {
            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const userOrders = this.mockOrders
                .filter(order => order.user_id === userId)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, limit);
            
            return userOrders;
        } catch (error) {
            console.error('获取最近订单失败:', error);
            throw error;
        }
    }

    /**
     * 根据订单ID获取完整订单信息（包含明细）
     * @param {number} orderId 订单ID
     * @returns {Promise<Object|null>} 完整订单信息
     */
    async getOrderWithItems(orderId) {
        try {
            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const order = this.mockOrders.find(o => o.id === orderId);
            if (!order) {
                return null;
            }
            
            const orderItems = this.mockOrderItems.filter(item => item.order_id === orderId);
            
            return {
                ...order,
                items: orderItems
            };
        } catch (error) {
            console.error('获取完整订单信息失败:', error);
            throw error;
        }
    }

    /**
     * 清空模拟数据（测试用）
     */
    clearMockData() {
        this.mockOrders = [];
        this.mockOrderItems = [];
        this.nextOrderId = 1;
        this.nextOrderItemId = 1;
        console.log('订单模拟数据已清空');
    }

    /**
     * 获取模拟数据统计（调试用）
     */
    getMockDataStats() {
        return {
            ordersCount: this.mockOrders.length,
            orderItemsCount: this.mockOrderItems.length,
            nextOrderId: this.nextOrderId,
            nextOrderItemId: this.nextOrderItemId
        };
    }
} 