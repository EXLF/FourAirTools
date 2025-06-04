class AuthManager {
    constructor() {
        this.apiUrl = 'http://localhost:3001/api';
        this.token = localStorage.getItem('auth_token');
        this.user = null;
        this.bindEvents();
    }

    // 绑定事件监听器
    bindEvents() {
        // 登录表单提交
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // 注册表单提交
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // 切换登录/注册模式
        const toggleButtons = document.querySelectorAll('.auth-toggle');
        toggleButtons.forEach(button => {
            button.addEventListener('click', (e) => this.toggleAuthMode(e));
        });

        // 密码可见性切换
        const passwordToggles = document.querySelectorAll('.password-toggle');
        passwordToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => this.togglePasswordVisibility(e));
        });
    }

    // 处理登录
    async handleLogin(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        
        const loginData = {
            username: formData.get('username'),
            password: formData.get('password'),
            deviceId: this.getDeviceId()
        };

        try {
            this.showLoading(true, '正在登录...');
            const response = await this.apiRequest('/auth/login', 'POST', loginData);
            
            if (response.success) {
                // 保存token和用户信息
                localStorage.setItem('auth_token', response.data.token);
                this.token = response.data.token;
                this.user = response.data.user;
                
                // 显示成功消息
                this.showMessage('登录成功！', 'success');
                
                // 延迟跳转到主应用
                setTimeout(() => {
                    this.redirectToMain();
                }, 1000);
            } else {
                this.showMessage(response.error || '登录失败', 'error');
            }
        } catch (error) {
            console.error('登录错误:', error);
            this.showMessage('登录失败，请检查网络连接', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // 处理注册
    async handleRegister(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        
        // 验证密码确认
        if (password !== confirmPassword) {
            this.showMessage('两次输入的密码不一致', 'error');
            return;
        }

        const registerData = {
            username: formData.get('username'),
            email: formData.get('email'),
            password: password,
            referralCode: formData.get('referralCode') || ''
        };

        try {
            this.showLoading(true, '正在注册...');
            const response = await this.apiRequest('/auth/register', 'POST', registerData);
            
            if (response.success) {
                // 保存token和用户信息
                localStorage.setItem('auth_token', response.data.token);
                this.token = response.data.token;
                this.user = response.data.user;
                
                // 显示成功消息
                this.showMessage('注册成功！欢迎加入FourAir社区', 'success');
                
                // 延迟跳转到主应用
                setTimeout(() => {
                    this.redirectToMain();
                }, 1500);
            } else {
                this.showMessage(response.error || '注册失败', 'error');
            }
        } catch (error) {
            console.error('注册错误:', error);
            this.showMessage('注册失败，请检查网络连接', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // 切换登录/注册模式
    toggleAuthMode(e) {
        e.preventDefault();
        const loginContainer = document.getElementById('login-container');
        const registerContainer = document.getElementById('register-container');
        
        if (loginContainer.style.display === 'none') {
            // 显示登录，隐藏注册
            loginContainer.style.display = 'block';
            registerContainer.style.display = 'none';
            document.querySelector('.auth-header h1').textContent = '登录账户';
        } else {
            // 显示注册，隐藏登录
            loginContainer.style.display = 'none';
            registerContainer.style.display = 'block';
            document.querySelector('.auth-header h1').textContent = '创建账户';
        }
        
        // 清除表单和消息
        this.clearForms();
        this.clearMessage();
    }

    // 切换密码可见性
    togglePasswordVisibility(e) {
        const button = e.target.closest('.password-toggle');
        const input = button.previousElementSibling;
        const icon = button.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }

    // API请求封装
    async apiRequest(endpoint, method = 'GET', data = null) {
        const url = `${this.apiUrl}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (this.token) {
            options.headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            const result = await response.json();
            
            return {
                success: response.ok,
                data: result,
                error: result.error,
                status: response.status
            };
        } catch (error) {
            throw new Error(`网络请求失败: ${error.message}`);
        }
    }

    // 检查是否已登录
    async checkAuthStatus() {
        if (!this.token) {
            return false;
        }

        try {
            const response = await this.apiRequest('/auth/me');
            if (response.success) {
                this.user = response.data.user;
                return true;
            } else {
                // token无效，清除本地存储
                this.logout();
                return false;
            }
        } catch (error) {
            console.error('检查登录状态失败:', error);
            this.logout();
            return false;
        }
    }

    // 登出
    logout() {
        localStorage.removeItem('auth_token');
        this.token = null;
        this.user = null;
        // 跳转到登录页
        this.showAuthPage();
    }

    // 显示加载状态
    showLoading(show, message = '处理中...') {
        const loadingOverlay = document.getElementById('loading-overlay');
        const loadingText = document.getElementById('loading-text');
        
        if (show) {
            loadingText.textContent = message;
            loadingOverlay.style.display = 'flex';
        } else {
            loadingOverlay.style.display = 'none';
        }
    }

    // 显示消息
    showMessage(message, type = 'info') {
        const messageContainer = document.getElementById('auth-message');
        messageContainer.textContent = message;
        messageContainer.className = `auth-message ${type}`;
        messageContainer.style.display = 'block';
    }

    // 清除消息
    clearMessage() {
        const messageContainer = document.getElementById('auth-message');
        messageContainer.style.display = 'none';
    }

    // 清除表单
    clearForms() {
        const forms = document.querySelectorAll('#login-form, #register-form');
        forms.forEach(form => form.reset());
    }

    // 获取设备ID
    getDeviceId() {
        let deviceId = localStorage.getItem('device_id');
        if (!deviceId) {
            deviceId = 'device_' + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('device_id', deviceId);
        }
        return deviceId;
    }

    // 跳转到主应用
    redirectToMain() {
        // 隐藏认证页面，显示主应用
        document.getElementById('auth-page').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        
        // 触发主应用初始化
        if (window.loadMainApp) {
            window.loadMainApp();
        }
    }

    // 显示认证页面
    showAuthPage() {
        document.getElementById('auth-page').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }

    // 获取当前用户信息
    getCurrentUser() {
        return this.user;
    }

    // 初始化认证系统
    async init() {
        // 检查登录状态
        const isLoggedIn = await this.checkAuthStatus();
        
        if (isLoggedIn) {
            // 已登录，显示主应用
            this.redirectToMain();
        } else {
            // 未登录，显示认证页面
            this.showAuthPage();
        }
    }
}

// 创建全局认证管理器实例
window.authManager = new AuthManager();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.authManager.init();
}); 