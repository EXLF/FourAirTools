class UserMenu {
    constructor() {
        this.menuElement = null;
        this.isOpen = false;
        this.init();
    }

    init() {
        this.createMenu();
        this.bindEvents();
    }

    createMenu() {
        const menuHTML = `
            <div class="user-menu-overlay" id="user-menu-overlay" style="display: none;">
                <div class="user-menu-panel">
                    <div class="user-menu-header">
                        <div class="user-avatar">
                            <i class="fa fa-user-circle"></i>
                        </div>
                        <div class="user-info">
                            <h3 class="user-name" id="user-menu-name">用户名</h3>
                            <p class="user-email" id="user-menu-email">user@example.com</p>
                        </div>
                        <button class="user-menu-close" id="user-menu-close">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="user-menu-content">
                        <div class="user-stats">
                            <div class="stat-item">
                                <div class="stat-icon vip-icon">
                                    <i class="fa fa-crown"></i>
                                </div>
                                <div class="stat-info">
                                    <span class="stat-label">会员等级</span>
                                    <span class="stat-value" id="user-vip-level">免费用户</span>
                                </div>
                            </div>
                            
                            <div class="stat-item">
                                <div class="stat-icon points-icon">
                                    <i class="fa fa-coins"></i>
                                </div>
                                <div class="stat-info">
                                    <span class="stat-label">积分余额</span>
                                    <span class="stat-value" id="user-points">0</span>
                                </div>
                            </div>
                            
                            <div class="stat-item">
                                <div class="stat-icon referral-icon">
                                    <i class="fa fa-share-alt"></i>
                                </div>
                                <div class="stat-info">
                                    <span class="stat-label">推荐码</span>
                                    <span class="stat-value" id="user-referral-code">-</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="user-menu-actions">
                            <button class="menu-action-btn" id="edit-profile-btn">
                                <i class="fa fa-edit"></i>
                                <span>编辑资料</span>
                            </button>
                            
                            <button class="menu-action-btn" id="change-password-btn">
                                <i class="fa fa-key"></i>
                                <span>修改密码</span>
                            </button>
                            
                            <button class="menu-action-btn" id="upgrade-vip-btn">
                                <i class="fa fa-star"></i>
                                <span>升级VIP</span>
                            </button>
                            
                            <div class="menu-divider"></div>
                            
                            <button class="menu-action-btn logout-btn" id="logout-btn">
                                <i class="fa fa-sign-out-alt"></i>
                                <span>退出登录</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', menuHTML);
        this.menuElement = document.getElementById('user-menu-overlay');
    }

    bindEvents() {
        // 关闭按钮
        document.getElementById('user-menu-close').addEventListener('click', () => {
            this.hide();
        });

        // 点击背景关闭
        this.menuElement.addEventListener('click', (e) => {
            if (e.target === this.menuElement) {
                this.hide();
            }
        });

        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.hide();
            }
        });

        // 退出登录
        document.getElementById('logout-btn').addEventListener('click', async () => {
            this.hide();
            
            // 等待菜单动画完成后再显示确认框
            setTimeout(async () => {
                const confirmed = await this.showLogoutConfirm();
                if (confirmed && window.authManager) {
                    window.authManager.logout();
                }
            }, 200);
        });

        // 编辑资料
        document.getElementById('edit-profile-btn').addEventListener('click', () => {
            this.hide();
            this.showEditProfile();
        });

        // 修改密码
        document.getElementById('change-password-btn').addEventListener('click', () => {
            this.hide();
            this.showChangePassword();
        });

        // 升级VIP
        document.getElementById('upgrade-vip-btn').addEventListener('click', () => {
            this.hide();
            this.showUpgradeVip();
        });
    }

    show() {
        if (this.isOpen) return;

        // 更新用户信息
        this.updateUserInfo();
        
        this.isOpen = true;
        this.menuElement.style.display = 'flex';
        
        // 添加动画
        setTimeout(() => {
            this.menuElement.classList.add('show');
        }, 10);
    }

    hide() {
        if (!this.isOpen) return;

        this.isOpen = false;
        this.menuElement.classList.remove('show');
        
        setTimeout(() => {
            this.menuElement.style.display = 'none';
        }, 200);
    }

    updateUserInfo() {
        const user = window.authManager?.getCurrentUser();
        if (!user) return;

        // 更新用户基本信息
        document.getElementById('user-menu-name').textContent = user.nickname || user.username;
        document.getElementById('user-menu-email').textContent = user.email;

        // 更新VIP等级
        const vipLevels = ['免费用户', 'VIP1', 'VIP2', 'VIP3', 'VIP4', 'VIP5'];
        document.getElementById('user-vip-level').textContent = vipLevels[user.vipLevel] || '免费用户';

        // 更新积分
        document.getElementById('user-points').textContent = user.points?.toLocaleString() || '0';

        // 更新推荐码
        document.getElementById('user-referral-code').textContent = user.referralCode || '-';

        // 更新VIP状态样式
        const vipElement = document.getElementById('user-vip-level');
        if (user.vipLevel > 0) {
            vipElement.classList.add('vip-active');
        } else {
            vipElement.classList.remove('vip-active');
        }
    }

    async showLogoutConfirm() {
        // 使用自定义确认模态框
        try {
            if (window.showConfirm) {
                return await window.showConfirm(
                    '确定要退出登录吗？退出后将返回登录页面。',
                    '确认退出',
                    {
                        confirmText: '退出登录',
                        cancelText: '取消',
                        danger: true
                    }
                );
            } else {
                // 降级到原生确认框作为备用
                console.warn('自定义确认框不可用，使用原生确认框');
                return window.confirm('确定要退出登录吗？退出后将返回登录页面。');
            }
        } catch (error) {
            console.error('显示退出确认框时出错:', error);
            // 出错时降级到原生确认框
            return window.confirm('确定要退出登录吗？退出后将返回登录页面。');
        }
    }

    showEditProfile() {
        // TODO: 实现编辑资料功能
        alert('编辑资料功能即将推出');
    }

    showChangePassword() {
        // TODO: 实现修改密码功能
        alert('修改密码功能即将推出');
    }

    showUpgradeVip() {
        // TODO: 实现VIP升级功能
        alert('VIP升级功能即将推出');
    }
}

// 等待DOM加载完成后再创建实例
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUserMenu);
} else {
    initUserMenu();
}

function initUserMenu() {
    try {
        // 创建全局实例
        window.userMenu = new UserMenu();

        // 全局显示函数
        window.showUserMenu = () => {
            if (window.userMenu) {
                window.userMenu.show();
            } else {
                console.error('UserMenu实例不存在');
            }
        };

        console.log('UserMenu已初始化，showUserMenu函数已就绪');
    } catch (error) {
        console.error('UserMenu初始化失败:', error);
    }
}

// 兼容ES6模块导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserMenu;
} else if (typeof window !== 'undefined') {
    window.UserMenu = UserMenu;
} 