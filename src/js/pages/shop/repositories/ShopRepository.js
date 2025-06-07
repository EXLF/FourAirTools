/**
 * 商店数据访问层
 * 处理商品和分类的数据库操作
 */

export class ShopRepository {
    constructor() {
        // 模拟数据，实际应该从数据库获取
        this.mockCategories = [
            {
                id: 1,
                name: 'IP代理',
                description: '高质量IP代理服务',
                icon: 'fas fa-globe',
                sort_order: 1,
                is_active: true
            },
            {
                id: 2,
                name: 'Twitter账号',
                description: '各种类型Twitter账号',
                icon: 'fab fa-twitter',
                sort_order: 2,
                is_active: true
            },
            {
                id: 3,
                name: 'Discord账号',
                description: 'Discord社交账号',
                icon: 'fab fa-discord',
                sort_order: 3,
                is_active: true
            },
            {
                id: 4,
                name: 'Telegram账号',
                description: 'Telegram通讯账号',
                icon: 'fab fa-telegram',
                sort_order: 4,
                is_active: true
            },
            {
                id: 5,
                name: '工具软件',
                description: '撸毛必备工具软件',
                icon: 'fas fa-tools',
                sort_order: 5,
                is_active: true
            },
            {
                id: 6,
                name: '付费教程',
                description: '高质量撸毛教程',
                icon: 'fas fa-graduation-cap',
                sort_order: 6,
                is_active: true
            }
        ];

        this.mockProducts = [
            // IP代理商品
            {
                id: 1,
                category_id: 1,
                category_name: 'IP代理',
                name: '美国高匿IP代理 - 1天',
                description: '美国优质高匿名IP代理，99%成功率，支持HTTP/HTTPS协议',
                price: 15.00,
                stock_quantity: 50,
                is_digital: true,
                product_type: 'ip_proxy',
                product_data: JSON.stringify({
                    is_hot: true,
                    features: ['高匿名', '99%成功率', '24小时客服'],
                    specs: {
                        '地区': '美国',
                        '协议': 'HTTP/HTTPS',
                        '并发数': '无限制',
                        '有效期': '24小时'
                    },
                    protocol: 'HTTP/HTTPS',
                    locations: ['美国'],
                    bandwidth: 'unlimited',
                    concurrent: 999
                }),
                image_url: null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: 2,
                category_id: 1,
                category_name: 'IP代理',
                name: '日本动态IP代理 - 7天',
                description: '日本动态IP代理池，每5分钟自动切换，适合批量操作',
                price: 88.00,
                stock_quantity: 30,
                is_digital: true,
                product_type: 'ip_proxy',
                product_data: JSON.stringify({
                    features: ['动态切换', '稳定快速', '7天有效'],
                    specs: {
                        '地区': '日本',
                        '协议': 'HTTP/SOCKS5',
                        '切换频率': '5分钟',
                        '有效期': '7天'
                    }
                }),
                image_url: null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            // Twitter账号
            {
                id: 3,
                category_id: 2,
                category_name: 'Twitter账号',
                name: '高质量Twitter白号 - 新注册',
                description: '全新注册Twitter账号，手机验证，无任何违规记录',
                price: 25.00,
                stock_quantity: 100,
                is_digital: true,
                product_type: 'twitter_account',
                product_data: JSON.stringify({
                    is_new: true,
                    features: ['手机验证', '新注册', '无风险'],
                    specs: {
                        '注册时间': '最近7天',
                        '验证状态': '手机已验证',
                        '粉丝数': '0',
                        '违规记录': '无'
                    },
                    followers: 0,
                    verified: false,
                    age: 0,
                    activity: 'normal'
                }),
                image_url: null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: 4,
                category_id: 2,
                category_name: 'Twitter账号',
                name: 'Twitter老号 - 有粉丝',
                description: '注册1年以上的Twitter账号，有真实粉丝互动',
                price: 180.00,
                stock_quantity: 15,
                is_digital: true,
                product_type: 'twitter_account',
                product_data: JSON.stringify({
                    is_hot: true,
                    features: ['真实粉丝', '1年老号', '有互动'],
                    specs: {
                        '注册时间': '1年以上',
                        '粉丝数': '500-2000',
                        '互动率': '正常',
                        '头像': '有'
                    },
                    followers: 1250,
                    verified: false,
                    age: 365,
                    activity: 'active'
                }),
                image_url: null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            // Discord账号
            {
                id: 5,
                category_id: 3,
                category_name: 'Discord账号',
                name: 'Discord新账号 - 邮箱验证',
                description: '全新Discord账号，邮箱验证完成，可立即使用',
                price: 12.00,
                stock_quantity: 80,
                is_digital: true,
                product_type: 'discord_account',
                product_data: JSON.stringify({
                    features: ['邮箱验证', '新注册', '立即可用'],
                    specs: {
                        '验证状态': '邮箱已验证',
                        '加入服务器': '0个',
                        'Nitro': '无',
                        '注册时间': '最近3天'
                    },
                    nitro: false,
                    server_count: 0,
                    age: 2
                }),
                image_url: null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            // Telegram账号
            {
                id: 6,
                category_id: 4,
                category_name: 'Telegram账号',
                name: 'Telegram账号 - 手机验证',
                description: '手机号验证的Telegram账号，支持群组和频道',
                price: 35.00,
                stock_quantity: 45,
                is_digital: true,
                product_type: 'telegram_account',
                product_data: JSON.stringify({
                    features: ['手机验证', '支持群组', '稳定可靠'],
                    specs: {
                        '验证方式': '手机号',
                        '用户名': '已设置',
                        '头像': '有',
                        '注册地区': '海外'
                    },
                    premium: false,
                    username: true,
                    age: 30
                }),
                image_url: null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            // 工具软件
            {
                id: 7,
                category_id: 5,
                category_name: '工具软件',
                name: 'VMLogin指纹浏览器 - 1个月',
                description: '专业指纹浏览器，防检测，支持多开，1个月使用权',
                price: 120.00,
                stock_quantity: 20,
                is_digital: true,
                product_type: 'tool',
                product_data: JSON.stringify({
                    is_hot: true,
                    features: ['防检测', '多开支持', '专业版本'],
                    specs: {
                        '版本': '专业版',
                        '有效期': '30天',
                        '设备数': '1台',
                        '环境数': '无限制'
                    }
                }),
                image_url: null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            // 付费教程
            {
                id: 8,
                category_id: 6,
                category_name: '付费教程',
                name: '2024最新空投教程合集',
                description: '包含50+个最新空投项目详细教程，持续更新',
                price: 299.00,
                stock_quantity: 999,
                is_digital: true,
                product_type: 'tutorial',
                product_data: JSON.stringify({
                    is_hot: true,
                    is_new: true,
                    features: ['50+项目', '持续更新', '详细教程'],
                    specs: {
                        '项目数量': '50+',
                        '更新频率': '每周',
                        '格式': 'PDF+视频',
                        '客服支持': '永久'
                    }
                }),
                image_url: null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        ];
    }

    /**
     * 获取所有分类
     * @returns {Promise<Array>} 分类列表
     */
    async getCategories() {
        try {
            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 100));
            
            return this.mockCategories.filter(cat => cat.is_active)
                .sort((a, b) => a.sort_order - b.sort_order);
        } catch (error) {
            console.error('获取分类失败:', error);
            throw error;
        }
    }

    /**
     * 获取商品列表
     * @param {Object} params 查询参数
     * @returns {Promise<Object>} 商品列表和总数
     */
    async getProducts(params = {}) {
        try {
            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const {
                category,
                search = '',
                sort = 'newest',
                page = 1,
                pageSize = 12
            } = params;

            let filteredProducts = [...this.mockProducts];

            // 分类筛选
            if (category && category !== 'all') {
                filteredProducts = filteredProducts.filter(product => 
                    product.category_id === parseInt(category)
                );
            }

            // 搜索筛选
            if (search) {
                const searchLower = search.toLowerCase();
                filteredProducts = filteredProducts.filter(product =>
                    product.name.toLowerCase().includes(searchLower) ||
                    product.description.toLowerCase().includes(searchLower) ||
                    product.category_name.toLowerCase().includes(searchLower)
                );
            }

            // 只显示激活的商品
            filteredProducts = filteredProducts.filter(product => product.is_active);

            // 排序
            filteredProducts.sort((a, b) => {
                switch (sort) {
                    case 'price-low':
                        return a.price - b.price;
                    case 'price-high':
                        return b.price - a.price;
                    case 'popular':
                        // 根据热门程度和库存排序
                        const aHot = JSON.parse(a.product_data || '{}').is_hot ? 1 : 0;
                        const bHot = JSON.parse(b.product_data || '{}').is_hot ? 1 : 0;
                        return bHot - aHot;
                    case 'newest':
                    default:
                        return new Date(b.created_at) - new Date(a.created_at);
                }
            });

            // 分页
            const totalCount = filteredProducts.length;
            const startIndex = (page - 1) * pageSize;
            const paginatedProducts = filteredProducts.slice(startIndex, startIndex + pageSize);

            return {
                products: paginatedProducts,
                totalCount
            };
        } catch (error) {
            console.error('获取商品失败:', error);
            throw error;
        }
    }

    /**
     * 获取单个商品
     * @param {number} productId 商品ID
     * @returns {Promise<Object>} 商品信息
     */
    async getProduct(productId) {
        try {
            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const product = this.mockProducts.find(p => p.id === parseInt(productId));
            if (!product) {
                throw new Error('商品不存在');
            }
            
            return product;
        } catch (error) {
            console.error('获取商品详情失败:', error);
            throw error;
        }
    }

    /**
     * 更新商品库存
     * @param {number} productId 商品ID
     * @param {number} change 库存变化量（可为负数）
     * @returns {Promise<boolean>} 更新结果
     */
    async updateProductStock(productId, change) {
        try {
            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const productIndex = this.mockProducts.findIndex(p => p.id === parseInt(productId));
            if (productIndex === -1) {
                throw new Error('商品不存在');
            }
            
            const product = this.mockProducts[productIndex];
            const newStock = product.stock_quantity + change;
            
            if (newStock < 0) {
                throw new Error('库存不足');
            }
            
            this.mockProducts[productIndex].stock_quantity = newStock;
            this.mockProducts[productIndex].updated_at = new Date().toISOString();
            
            console.log(`商品 ${productId} 库存更新: ${product.stock_quantity} -> ${newStock}`);
            return true;
        } catch (error) {
            console.error('更新库存失败:', error);
            throw error;
        }
    }

    /**
     * 创建新商品（管理功能）
     * @param {Object} productData 商品数据
     * @returns {Promise<Object>} 创建结果
     */
    async createProduct(productData) {
        try {
            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const newProduct = {
                id: Math.max(...this.mockProducts.map(p => p.id)) + 1,
                ...productData,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            this.mockProducts.push(newProduct);
            return { success: true, productId: newProduct.id };
        } catch (error) {
            console.error('创建商品失败:', error);
            throw error;
        }
    }

    /**
     * 更新商品信息（管理功能）
     * @param {number} productId 商品ID
     * @param {Object} updateData 更新数据
     * @returns {Promise<boolean>} 更新结果
     */
    async updateProduct(productId, updateData) {
        try {
            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const productIndex = this.mockProducts.findIndex(p => p.id === parseInt(productId));
            if (productIndex === -1) {
                throw new Error('商品不存在');
            }
            
            this.mockProducts[productIndex] = {
                ...this.mockProducts[productIndex],
                ...updateData,
                updated_at: new Date().toISOString()
            };
            
            return true;
        } catch (error) {
            console.error('更新商品失败:', error);
            throw error;
        }
    }

    /**
     * 删除商品（管理功能）
     * @param {number} productId 商品ID
     * @returns {Promise<boolean>} 删除结果
     */
    async deleteProduct(productId) {
        try {
            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const productIndex = this.mockProducts.findIndex(p => p.id === parseInt(productId));
            if (productIndex === -1) {
                throw new Error('商品不存在');
            }
            
            this.mockProducts.splice(productIndex, 1);
            return true;
        } catch (error) {
            console.error('删除商品失败:', error);
            throw error;
        }
    }
} 