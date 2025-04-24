/**
 * 自定义下拉框组件
 * 将原生的select元素转换为自定义样式的下拉框
 */

// 初始化所有自定义下拉框
function initCustomSelects() {
    // 查找所有需要转换的select元素
    const selects = document.querySelectorAll('select:not(.custom-select-initialized)');
    
    selects.forEach(select => {
        // 防止重复初始化
        if (select.classList.contains('custom-select-initialized')) return;
        
        // 创建自定义下拉框的容器
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select-wrapper';
        select.parentNode.insertBefore(wrapper, select);
        
        // 记录原始select的宽度
        const originalWidth = select.offsetWidth;
        
        // 创建自定义下拉框显示区域
        const customSelect = document.createElement('div');
        customSelect.className = 'custom-select';
        customSelect.textContent = select.options[select.selectedIndex]?.textContent || '请选择';
        
        // 特殊处理：保持与原始select相同的尺寸和样式
        if (select.classList.contains('select-filter')) {
            customSelect.classList.add('select-filter');
        }
        if (select.classList.contains('page-size-select')) {
            customSelect.classList.add('page-size-select');
        }
        if (select.classList.contains('settings-select')) {
            customSelect.classList.add('settings-select');
        }
        
        // 创建选项列表容器
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'custom-select-options';
        
        // 填充选项
        Array.from(select.options).forEach((option, index) => {
            const optionElement = document.createElement('div');
            optionElement.className = 'custom-select-option';
            optionElement.textContent = option.textContent;
            optionElement.dataset.value = option.value;
            optionElement.dataset.index = index;
            
            if (index === select.selectedIndex) {
                optionElement.classList.add('selected');
            }
            
            // 点击选项时的处理
            optionElement.addEventListener('click', () => {
                // 更新原始select的值
                select.selectedIndex = index;
                
                // 触发原始select的change事件
                const event = new Event('change', { bubbles: true });
                select.dispatchEvent(event);
                
                // 更新自定义下拉框的显示
                customSelect.textContent = option.textContent;
                
                // 更新选项的选中状态
                const options = optionsContainer.querySelectorAll('.custom-select-option');
                options.forEach(opt => opt.classList.remove('selected'));
                optionElement.classList.add('selected');
                
                // 关闭选项列表
                optionsContainer.classList.remove('open');
            });
            
            optionsContainer.appendChild(optionElement);
        });
        
        // 点击自定义下拉框时显示/隐藏选项列表
        customSelect.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = optionsContainer.classList.contains('open');
            
            // 关闭所有其他打开的下拉框
            document.querySelectorAll('.custom-select-options.open').forEach(elem => {
                if (elem !== optionsContainer) {
                    elem.classList.remove('open');
                }
            });
            
            optionsContainer.classList.toggle('open');
            
            // 如果打开，确保选中的选项可见
            if (!isOpen) {
                const selectedOption = optionsContainer.querySelector('.selected');
                if (selectedOption) {
                    selectedOption.scrollIntoView({ block: 'nearest' });
                }
            }
        });
        
        // 点击页面其他区域时关闭选项列表
        document.addEventListener('click', () => {
            optionsContainer.classList.remove('open');
        });
        
        // 键盘导航
        customSelect.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                optionsContainer.classList.toggle('open');
            } else if (e.key === 'Escape') {
                optionsContainer.classList.remove('open');
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                
                const options = Array.from(optionsContainer.querySelectorAll('.custom-select-option'));
                const selectedIndex = options.findIndex(opt => opt.classList.contains('selected'));
                let newIndex;
                
                if (e.key === 'ArrowDown') {
                    newIndex = selectedIndex < options.length - 1 ? selectedIndex + 1 : 0;
                } else {
                    newIndex = selectedIndex > 0 ? selectedIndex - 1 : options.length - 1;
                }
                
                if (options[newIndex]) {
                    options[newIndex].click();
                    options[newIndex].scrollIntoView({ block: 'nearest' });
                }
            }
        });
        
        // 添加自定义元素到DOM
        wrapper.appendChild(customSelect);
        wrapper.appendChild(optionsContainer);
        
        // 隐藏原始select
        select.style.display = 'none';
        select.classList.add('custom-select-initialized');
        
        // 与原始select关联
        customSelect.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                optionsContainer.classList.remove('open');
            }
        });
        
        // 监听原始select的变化，同步到自定义下拉框
        select.addEventListener('change', () => {
            customSelect.textContent = select.options[select.selectedIndex]?.textContent || '请选择';
            
            const options = optionsContainer.querySelectorAll('.custom-select-option');
            options.forEach((opt, idx) => {
                if (idx === select.selectedIndex) {
                    opt.classList.add('selected');
                } else {
                    opt.classList.remove('selected');
                }
            });
        });
    });
}

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initCustomSelects();
});

// 提供全局方法，用于动态添加的下拉框
window.initCustomSelects = initCustomSelects;

// 在Ajax加载内容后再次初始化
document.addEventListener('content-loaded', () => {
    initCustomSelects();
});

// 导出初始化函数
export { initCustomSelects }; 