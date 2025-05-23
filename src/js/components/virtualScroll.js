/**
 * @fileoverview 虚拟滚动组件
 * @module components/virtualScroll
 * @description 提供虚拟滚动功能，优化大数据量表格的渲染性能
 */

/**
 * @typedef {Object} VirtualScrollOptions
 * @property {HTMLElement} container - 滚动容器元素
 * @property {number} itemHeight - 每个项目的高度（像素）
 * @property {number} bufferSize - 缓冲区大小（显示区域外额外渲染的项目数）
 * @property {Function} renderItem - 渲染单个项目的函数
 * @property {Function} onVisibleRangeChange - 可见范围变化时的回调
 */

/**
 * 虚拟滚动类
 */
export class VirtualScroll {
    /**
     * 创建虚拟滚动实例
     * @param {VirtualScrollOptions} options - 配置选项
     */
    constructor(options) {
        this.container = options.container;
        this.itemHeight = options.itemHeight || 40;
        this.bufferSize = options.bufferSize || 5;
        this.renderItem = options.renderItem;
        this.onVisibleRangeChange = options.onVisibleRangeChange;
        
        this.items = [];
        this.scrollTop = 0;
        this.containerHeight = 0;
        this.totalHeight = 0;
        
        // 创建滚动容器结构
        this.setupContainer();
        
        // 绑定事件
        this.handleScroll = this.handleScroll.bind(this);
        this.handleResize = this.handleResize.bind(this);
        
        this.container.addEventListener('scroll', this.handleScroll);
        window.addEventListener('resize', this.handleResize);
        
        // 初始化
        this.updateContainerHeight();
    }
    
    /**
     * 设置容器结构
     */
    setupContainer() {
        // 清空容器
        this.container.innerHTML = '';
        
        // 创建高度占位元素
        this.heightPlaceholder = document.createElement('div');
        this.heightPlaceholder.style.position = 'absolute';
        this.heightPlaceholder.style.top = '0';
        this.heightPlaceholder.style.left = '0';
        this.heightPlaceholder.style.width = '1px';
        this.heightPlaceholder.style.visibility = 'hidden';
        
        // 创建内容容器
        this.contentWrapper = document.createElement('div');
        this.contentWrapper.style.position = 'relative';
        
        this.container.appendChild(this.heightPlaceholder);
        this.container.appendChild(this.contentWrapper);
        
        // 确保容器有正确的样式
        this.container.style.position = 'relative';
        this.container.style.overflow = 'auto';
    }
    
    /**
     * 设置数据
     * @param {Array} items - 数据项数组
     */
    setItems(items) {
        this.items = items || [];
        this.totalHeight = this.items.length * this.itemHeight;
        this.heightPlaceholder.style.height = `${this.totalHeight}px`;
        this.render();
    }
    
    /**
     * 更新容器高度
     */
    updateContainerHeight() {
        this.containerHeight = this.container.clientHeight;
        this.render();
    }
    
    /**
     * 计算可见范围
     * @returns {{start: number, end: number}}
     */
    calculateVisibleRange() {
        const scrollTop = this.container.scrollTop;
        const start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.bufferSize);
        const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
        const end = Math.min(this.items.length, start + visibleCount + this.bufferSize * 2);
        
        return { start, end };
    }
    
    /**
     * 渲染可见项目
     */
    render() {
        if (!this.items.length) {
            this.contentWrapper.innerHTML = '';
            return;
        }
        
        const { start, end } = this.calculateVisibleRange();
        
        // 清空现有内容
        this.contentWrapper.innerHTML = '';
        
        // 创建文档片段以提高性能
        const fragment = document.createDocumentFragment();
        
        for (let i = start; i < end; i++) {
            const item = this.items[i];
            const element = this.renderItem(item, i);
            
            // 设置元素位置
            element.style.position = 'absolute';
            element.style.top = `${i * this.itemHeight}px`;
            element.style.left = '0';
            element.style.right = '0';
            element.style.height = `${this.itemHeight}px`;
            
            fragment.appendChild(element);
        }
        
        this.contentWrapper.appendChild(fragment);
        
        // 触发可见范围变化回调
        if (this.onVisibleRangeChange) {
            this.onVisibleRangeChange({ start, end });
        }
    }
    
    /**
     * 处理滚动事件
     */
    handleScroll() {
        cancelAnimationFrame(this.scrollFrame);
        this.scrollFrame = requestAnimationFrame(() => {
            this.render();
        });
    }
    
    /**
     * 处理窗口大小变化
     */
    handleResize() {
        this.updateContainerHeight();
    }
    
    /**
     * 滚动到指定索引
     * @param {number} index - 项目索引
     * @param {string} position - 滚动位置：'top' | 'center' | 'bottom'
     */
    scrollToIndex(index, position = 'top') {
        if (index < 0 || index >= this.items.length) return;
        
        let scrollTop = index * this.itemHeight;
        
        if (position === 'center') {
            scrollTop -= (this.containerHeight - this.itemHeight) / 2;
        } else if (position === 'bottom') {
            scrollTop -= this.containerHeight - this.itemHeight;
        }
        
        this.container.scrollTop = Math.max(0, scrollTop);
    }
    
    /**
     * 更新单个项目
     * @param {number} index - 项目索引
     * @param {*} newItem - 新的项目数据
     */
    updateItem(index, newItem) {
        if (index < 0 || index >= this.items.length) return;
        
        this.items[index] = newItem;
        
        // 检查项目是否在可见范围内
        const { start, end } = this.calculateVisibleRange();
        if (index >= start && index < end) {
            this.render();
        }
    }
    
    /**
     * 销毁虚拟滚动实例
     */
    destroy() {
        this.container.removeEventListener('scroll', this.handleScroll);
        window.removeEventListener('resize', this.handleResize);
        cancelAnimationFrame(this.scrollFrame);
        this.container.innerHTML = '';
    }
}

/**
 * 创建虚拟滚动表格
 * @param {Object} options - 配置选项
 * @returns {VirtualScroll} 虚拟滚动实例
 */
export function createVirtualScrollTable(options) {
    const {
        container,
        columns,
        data,
        rowHeight = 40,
        bufferSize = 10,
        onRowClick,
        onSelectionChange
    } = options;
    
    // 创建表格结构
    const table = document.createElement('table');
    table.className = 'virtual-scroll-table';
    table.style.width = '100%';
    table.style.tableLayout = 'fixed';
    
    // 创建表头
    const thead = document.createElement('thead');
    thead.style.position = 'sticky';
    thead.style.top = '0';
    thead.style.zIndex = '10';
    thead.style.backgroundColor = '#fff';
    
    const headerRow = document.createElement('tr');
    columns.forEach(column => {
        const th = document.createElement('th');
        th.textContent = column.label;
        th.style.padding = '10px';
        th.style.borderBottom = '2px solid #e9ecef';
        th.style.textAlign = column.align || 'left';
        if (column.width) {
            th.style.width = column.width;
        }
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // 创建表体容器
    const tbody = document.createElement('tbody');
    tbody.style.display = 'block';
    tbody.style.height = `calc(100% - ${thead.offsetHeight || 40}px)`;
    tbody.style.overflow = 'auto';
    table.appendChild(tbody);
    
    container.appendChild(table);
    
    // 创建虚拟滚动实例
    const virtualScroll = new VirtualScroll({
        container: tbody,
        itemHeight: rowHeight,
        bufferSize: bufferSize,
        renderItem: (item, index) => {
            const tr = document.createElement('tr');
            tr.dataset.index = index;
            
            columns.forEach(column => {
                const td = document.createElement('td');
                td.style.padding = '10px';
                td.style.borderBottom = '1px solid #e9ecef';
                
                if (column.render) {
                    const content = column.render(item[column.key], item, index);
                    if (typeof content === 'string') {
                        td.innerHTML = content;
                    } else {
                        td.appendChild(content);
                    }
                } else {
                    td.textContent = item[column.key] || '';
                }
                
                tr.appendChild(td);
            });
            
            // 绑定行点击事件
            if (onRowClick) {
                tr.style.cursor = 'pointer';
                tr.addEventListener('click', () => onRowClick(item, index));
            }
            
            return tr;
        }
    });
    
    // 设置数据
    virtualScroll.setItems(data);
    
    // 添加便捷方法
    virtualScroll.updateData = (newData) => {
        virtualScroll.setItems(newData);
    };
    
    return virtualScroll;
} 