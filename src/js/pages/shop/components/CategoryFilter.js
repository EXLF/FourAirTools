/**
 * 商品分类筛选组件
 */

export class CategoryFilter {
    constructor(categories, onCategoryChange) {
        this.categories = categories || [];
        this.onCategoryChange = onCategoryChange;
        this.currentCategory = 'all';
    }

    /**
     * 渲染分类筛选器
     * @param {HTMLElement} container 容器元素
     */
    render(container) {
        if (!container) {
            console.error('CategoryFilter: container is required');
            return;
        }

        // 创建分类筛选器HTML
        const filterHTML = `
            <div class="category-filter">
                ${this.categories.map(category => `
                    <button class="category-btn ${category.id === this.currentCategory ? 'active' : ''}" 
                            data-category="${category.id}">
                        <i class="${category.icon}"></i>
                        <span>${category.name}</span>
                    </button>
                `).join('')}
            </div>
        `;

        container.innerHTML = filterHTML;

        // 绑定点击事件
        this.bindEvents(container);
    }

    /**
     * 绑定事件
     * @param {HTMLElement} container 容器元素
     */
    bindEvents(container) {
        const buttons = container.querySelectorAll('.category-btn');
        
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const categoryId = button.dataset.category;
                this.setActiveCategory(categoryId);
                
                if (this.onCategoryChange) {
                    this.onCategoryChange(categoryId);
                }
            });
        });
    }

    /**
     * 设置活跃分类
     * @param {string} categoryId 分类ID
     */
    setActiveCategory(categoryId) {
        this.currentCategory = categoryId;
        
        // 更新按钮状态
        const buttons = document.querySelectorAll('.category-btn');
        buttons.forEach(button => {
            const isActive = button.dataset.category === categoryId;
            button.classList.toggle('active', isActive);
        });
    }

    /**
     * 获取当前选中的分类
     * @returns {string} 当前分类ID
     */
    getCurrentCategory() {
        return this.currentCategory;
    }
} 