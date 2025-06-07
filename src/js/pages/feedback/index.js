/**
 * 用户反馈页面
 * 提供反馈和建议的功能
 */

class FeedbackManager {
    constructor() {
        this.isSubmitting = false;
        this.currentStep = 'form'; // form, success
    }

    /**
     * 初始化反馈页面
     */
    async init(contentArea) {
        try {
            this.contentArea = contentArea;
            
            // 渲染页面
            this.renderFeedbackPage();
            
            // 绑定事件
            this.bindEvents();
            
            console.log('反馈页面初始化完成');
        } catch (error) {
            console.error('反馈页面初始化失败:', error);
            this.showError('页面初始化失败，请刷新重试');
        }
    }

    /**
     * 渲染反馈页面
     */
    renderFeedbackPage() {
        this.contentArea.innerHTML = `
            <div class="feedback-container">
                <div class="feedback-header">
                    <h1><i class="fas fa-comment-dots"></i> 意见反馈</h1>
                    <p>您的反馈对我们非常重要，帮助我们持续改进产品体验</p>
                </div>

                <div id="feedback-form-container">
                    ${this.renderFeedbackForm()}
                </div>
            </div>
        `;
    }

    /**
     * 渲染反馈表单
     */
    renderFeedbackForm() {
        return `
            <form class="feedback-form" id="feedback-form">
                <!-- 反馈类型 -->
                <div class="form-group">
                    <label>反馈类型 <span class="required">*</span></label>
                    <div class="feedback-type-grid">
                        <div class="type-option">
                            <input type="radio" id="type-bug" name="type" value="bug" required>
                            <label for="type-bug">
                                <i class="fas fa-bug"></i>
                                Bug报告
                            </label>
                        </div>
                        <div class="type-option">
                            <input type="radio" id="type-feature" name="type" value="feature" required>
                            <label for="type-feature">
                                <i class="fas fa-lightbulb"></i>
                                功能建议
                            </label>
                        </div>
                        <div class="type-option">
                            <input type="radio" id="type-improvement" name="type" value="improvement" required>
                            <label for="type-improvement">
                                <i class="fas fa-chart-line"></i>
                                体验优化
                            </label>
                        </div>
                        <div class="type-option">
                            <input type="radio" id="type-other" name="type" value="other" required>
                            <label for="type-other">
                                <i class="fas fa-question-circle"></i>
                                其他反馈
                            </label>
                        </div>
                    </div>
                </div>

                <!-- 优先级 -->
                <div class="form-group">
                    <label>问题紧急程度</label>
                    <div class="priority-options">
                        <div class="priority-option low">
                            <input type="radio" id="priority-low" name="priority" value="low" checked>
                            <label for="priority-low">一般</label>
                        </div>
                        <div class="priority-option medium">
                            <input type="radio" id="priority-medium" name="priority" value="medium">
                            <label for="priority-medium">重要</label>
                        </div>
                        <div class="priority-option high">
                            <input type="radio" id="priority-high" name="priority" value="high">
                            <label for="priority-high">紧急</label>
                        </div>
                    </div>
                </div>

                <!-- 标题和描述 -->
                <div class="form-group">
                    <label for="title">标题 <span class="required">*</span></label>
                    <input type="text" id="title" name="title" class="form-input" 
                           placeholder="请简洁描述您的问题或建议" required maxlength="100">
                </div>

                <div class="form-group">
                    <label for="description">详细描述 <span class="required">*</span></label>
                    <textarea id="description" name="description" class="form-textarea" 
                              placeholder="请详细描述您遇到的问题、改进建议或功能需求...&#10;&#10;如果是Bug报告，请尽可能包含：&#10;1. 操作步骤&#10;2. 预期结果&#10;3. 实际结果&#10;4. 使用环境（浏览器、系统等）" 
                              required></textarea>
                </div>

                <!-- 操作按钮 -->
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="reset-btn">
                        <i class="fas fa-redo"></i>
                        重置
                    </button>
                    <button type="submit" class="btn btn-primary" id="submit-btn">
                        <i class="fas fa-paper-plane"></i>
                        提交反馈
                    </button>
                </div>
            </form>
        `;
    }

    /**
     * 渲染成功页面
     */
    renderSuccessMessage() {
        return `
            <div class="success-message">
                <div class="success-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <h3>反馈提交成功！</h3>
                <p>感谢您的反馈，我们已收到您的意见。我们会认真对待每一个反馈，并尽快处理。</p>
                <div class="form-actions">
                    <button class="btn btn-primary" onclick="feedbackManager.resetForm()">
                        <i class="fas fa-plus"></i>
                        继续反馈
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        const form = this.contentArea.querySelector('#feedback-form');
        const submitBtn = this.contentArea.querySelector('#submit-btn');
        const resetBtn = this.contentArea.querySelector('#reset-btn');

        // 表单提交
        if (form) {
            form.addEventListener('submit', this.handleSubmit.bind(this));
        }

        // 重置按钮
        if (resetBtn) {
            resetBtn.addEventListener('click', this.resetForm.bind(this));
        }

        // 实时验证
        this.setupValidation();
    }

    /**
     * 设置表单验证
     */
    setupValidation() {
        // 保留函数以防后续需要添加其他验证逻辑
    }



    /**
     * 处理表单提交
     */
    async handleSubmit(event) {
        event.preventDefault();

        if (this.isSubmitting) {
            return;
        }

        try {
            this.isSubmitting = true;
            this.showLoading();

            // 获取表单数据
            const formData = this.getFormData();

            // 验证表单
            const validation = this.validateForm(formData);
            if (!validation.isValid) {
                this.showError(validation.message);
                return;
            }

            // 提交反馈
            const result = await this.submitFeedback(formData);

            if (result.success) {
                this.showSuccess();
            } else {
                this.showError(result.message || '提交失败，请稍后重试');
            }

        } catch (error) {
            console.error('提交反馈失败:', error);
            this.showError('网络错误，请检查网络连接后重试');
        } finally {
            this.isSubmitting = false;
            this.hideLoading();
        }
    }

    /**
     * 获取表单数据
     */
    getFormData() {
        const form = this.contentArea.querySelector('#feedback-form');
        const formData = new FormData(form);
        
        // 获取当前登录用户名
        const username = this.getCurrentUsername();
        
        return {
            type: formData.get('type'),
            priority: formData.get('priority'),
            title: formData.get('title'),
            description: formData.get('description'),
            contact: username, // 使用登录用户名作为联系方式
            browser: navigator.userAgent, // 自动获取浏览器信息
            version: '1.3.2', // 固定版本号
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            url: window.location.href
        };
    }

    /**
     * 获取当前登录用户名
     */
    getCurrentUsername() {
        console.log('[DEBUG] 开始获取用户名...');
        
        // 首先尝试从 authManager 获取当前用户
        if (window.authManager && window.authManager.getCurrentUser) {
            const user = window.authManager.getCurrentUser();
            console.log('[DEBUG] authManager.getCurrentUser():', user);
            if (user && user.username) {
                console.log('[DEBUG] 从 authManager 获取到用户名:', user.username);
                return user.username;
            }
        } else {
            console.log('[DEBUG] authManager 不可用:', {
                hasAuthManager: !!window.authManager,
                hasGetCurrentUser: !!(window.authManager && window.authManager.getCurrentUser)
            });
        }
        
        // 尝试从用户菜单中获取用户名
        const userMenuName = document.querySelector('#user-menu-name');
        console.log('[DEBUG] userMenuName element:', userMenuName);
        if (userMenuName && userMenuName.textContent.trim() !== '用户名') {
            const username = userMenuName.textContent.trim();
            console.log('[DEBUG] 从用户菜单获取到用户名:', username);
            return username;
        }
        
        // 从右上角的用户信息中获取用户名
        const userElement = document.querySelector('.user-info .username') || 
                           document.querySelector('[class*="username"]') ||
                           document.querySelector('.user-name') ||
                           document.querySelector('#username');
        
        console.log('[DEBUG] userElement:', userElement);
        if (userElement && userElement.textContent.trim() !== '用户名') {
            const username = userElement.textContent.trim();
            console.log('[DEBUG] 从页面元素获取到用户名:', username);
            return username;
        }
        
        // 尝试从全局变量获取
        console.log('[DEBUG] window.currentUser:', window.currentUser);
        if (window.currentUser && window.currentUser.username) {
            console.log('[DEBUG] 从全局变量获取到用户名:', window.currentUser.username);
            return window.currentUser.username;
        }
        
        // 最后的备选方案 - 从本地存储获取
        try {
            const storedUser = localStorage.getItem('currentUser');
            console.log('[DEBUG] 本地存储用户信息:', storedUser);
            if (storedUser) {
                const user = JSON.parse(storedUser);
                if (user.username) {
                    console.log('[DEBUG] 从本地存储获取到用户名:', user.username);
                    return user.username;
                }
            }
        } catch (e) {
            console.warn('获取本地存储用户信息失败:', e);
        }
        
        // 如果都没找到，返回一个默认值
        console.log('[DEBUG] 所有方法都未能获取到用户名，使用默认值: anonymous');
        return 'anonymous';
    }

    /**
     * 验证表单
     */
    validateForm(data) {
        if (!data.type) {
            // 尝试聚焦到第一个反馈类型radio按钮
            const firstTypeRadio = this.contentArea.querySelector('input[name="type"]');
            if (firstTypeRadio) {
                firstTypeRadio.focus();
            }
            return { isValid: false, message: '请选择反馈类型' };
        }

        if (!data.priority) {
            // 尝试聚焦到第一个优先级radio按钮
            const firstPriorityRadio = this.contentArea.querySelector('input[name="priority"]');
            if (firstPriorityRadio) {
                firstPriorityRadio.focus();
            }
            return { isValid: false, message: '请选择优先级' };
        }

        if (!data.title || data.title.trim().length < 2) {
            const titleInput = this.contentArea.querySelector('#title');
            if (titleInput) {
                titleInput.focus();
            }
            return { isValid: false, message: '标题至少需要2个字符' };
        }

        if (!data.description || data.description.trim().length === 0) {
            const descriptionInput = this.contentArea.querySelector('#description');
            if (descriptionInput) {
                descriptionInput.focus();
            }
            return { isValid: false, message: '请填写详细描述' };
        }

        if (data.title.length > 100) {
            const titleInput = this.contentArea.querySelector('#title');
            if (titleInput) {
                titleInput.focus();
            }
            return { isValid: false, message: '标题不能超过100个字符' };
        }

        return { isValid: true };
    }

    /**
     * 提交反馈到服务器
     */
    async submitFeedback(data) {
        try {
            const response = await fetch('http://localhost:3001/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            return result;

        } catch (error) {
            console.error('提交反馈API调用失败:', error);
            throw error;
        }
    }

    /**
     * 显示成功状态
     */
    showSuccess() {
        const container = this.contentArea.querySelector('#feedback-form-container');
        if (container) {
            container.innerHTML = this.renderSuccessMessage();
            this.currentStep = 'success';
        }
    }

    /**
     * 重置表单
     */
    resetForm() {
        const container = this.contentArea.querySelector('#feedback-form-container');
        if (container) {
            container.innerHTML = this.renderFeedbackForm();
            this.bindEvents();
            this.currentStep = 'form';
        }
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        const loadingHtml = `
            <div class="loading-overlay">
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>正在提交反馈...</p>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', loadingHtml);
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        const loading = document.querySelector('.loading-overlay');
        if (loading) {
            loading.remove();
        }
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        if (window.showToast) {
            window.showToast(message, 'error');
        } else {
            alert(message);
        }
    }

    /**
     * 显示成功信息
     */
    showSuccessToast(message) {
        if (window.showToast) {
            window.showToast(message, 'success');
        }
    }
}

// 创建全局实例
const feedbackManager = new FeedbackManager();

/**
 * 初始化反馈页面
 */
export function initFeedbackPage(contentArea) {
    feedbackManager.init(contentArea);
}

// 导出管理器实例供其他地方使用
window.feedbackManager = feedbackManager; 