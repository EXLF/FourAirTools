/**
 * Renders the table header HTML based on the selected platform and column configurations.
 * @param {object} platformColumnsConfig - Configuration объектом for platform-specific columns.
 * @param {Array<object>} commonColumnsStartConfig - Configuration for common columns at the start.
 * @param {Array<object>} commonColumnsEndConfig - Configuration for common columns at the end.
 * @param {string} platform - The selected platform key (e.g., 'twitter').
 * @returns {{headerHTML: string, colspan: number}} An object containing the header HTML string and the total number of columns.
 */
export function renderTableHeader(platformColumnsConfig, commonColumnsStartConfig, commonColumnsEndConfig, platform) {
    const platformSpecificColumns = platformColumnsConfig[platform] || [];
    const allColumns = [...commonColumnsStartConfig, ...platformSpecificColumns, ...commonColumnsEndConfig];

    let headerHTML = '<tr>';
    allColumns.forEach(col => {
        const style = col.width ? `style="width: ${col.width}"` : '';
        if (col.key === 'checkbox') {
            headerHTML += `<th ${style}><input type="checkbox" class="select-all-checkbox" title="全选"></th>`;
        } else {
            headerHTML += `<th ${style}>${col.header}</th>`;
        }
    });
    headerHTML += '</tr>';

    return { headerHTML, colspan: allColumns.length };
}

// Future rendering functions (createSocialAccountRowElement, createPageSizeSelectorElement, renderPaginationElement) will be added here.

// Helper function to escape HTML attributes (moved from table.js)
function escapeAttribute(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/["&<>]/g, char => ({
        '"': '&quot;',
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;'
    }[char]));
}

/**
 * 创建社交账户的表格行 (<tr>) 元素。
 * @param {object} account - 社交账户数据对象。
 * @param {Array<object>} columns - 当前平台的列定义数组。
 * @param {Array<string>} sensitiveFieldsForCopy - 用于复制功能的敏感字段键名数组。
 * @param {function} handleActionCallback - 用于行操作 (编辑, 删除) 的回调函数。
 * @returns {HTMLTableRowElement} 创建的表格行元素。
 */
export function createSocialAccountRowElement(account, columns, sensitiveFieldsForCopy, handleActionCallback) {
    const row = document.createElement('tr');
    row.dataset.accountId = account.id;

    // 内部辅助函数，用于获取显示值，处理截断和错误状态
    const getDisplayValue = (value, isTruncatable = false) => {
        if (value === null || value === undefined || value === '') return '-';
        const strValue = String(value);
        if (strValue === '[解密失败]' || strValue === '[应用未解锁]') {
            return `<span class="text-red-500 text-xs">${strValue}</span>`;
        }
        const TRUNCATE_LENGTH = 20, TRUNCATE_EDGE = 8;
        if (isTruncatable && strValue.length > TRUNCATE_LENGTH) {
            return `${strValue.substring(0, TRUNCATE_EDGE)}...${strValue.substring(strValue.length - TRUNCATE_EDGE)}`;
        }
        // 防范 XSS，尽管内容主要来自数据库，但最好对动态内容进行转义。
        // 对于明确要设置为 HTML 的内容 (如错误提示)，则不应再次转义。
        // 此处 getDisplayValue 旨在返回文本或安全的 HTML 片段。
        return strValue.replace(/[<>&]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char]));
    };

    columns.forEach(col => {
        const td = document.createElement('td');
        let rawValue = account[col.key];

        // Discord 平台特殊处理，同时检查两个密码字段
        if (col.key === 'discord_password' && (!rawValue || rawValue === '')) {
            rawValue = account['password']; // 尝试使用通用密码字段
            // console.log('使用通用密码字段作为 Discord 密码'); // 可按需保留或移除调试日志
        }

        // 调试输出 (例如，用于 email_recovery_email)
        // if (col.key === 'email_recovery_email') {
        //     console.log(`账户 ${account.id} 的辅助邮箱: ${rawValue}, 类型: ${typeof rawValue}`);
        // }

        const isOriginallySensitive = sensitiveFieldsForCopy.includes(col.key);
        const hasValueError = rawValue === '[解密失败]' || rawValue === '[应用未解锁]';

        switch (col.key) {
            case 'checkbox':
                td.innerHTML = `<input type="checkbox" class="row-checkbox form-checkbox h-4 w-4 text-blue-600" value="${account.id}">`;
                break;
            case 'platform':
                let platformIconClass = 'fas fa-question-circle';
                let platformColor = '#6c757d';
                switch (account.platform?.toLowerCase()) {
                    case 'twitter': platformIconClass = 'fab fa-twitter'; platformColor = '#1DA1F2'; break;
                    case 'discord': platformIconClass = 'fab fa-discord'; platformColor = '#5865F2'; break;
                    case 'telegram': platformIconClass = 'fab fa-telegram'; platformColor = '#2AABEE'; break;
                    case 'email': platformIconClass = 'fas fa-envelope'; platformColor = '#DB4437'; break;
                }
                td.innerHTML = `<i class="${platformIconClass}" style="color: ${platformColor}; font-size: 1.2em; vertical-align: middle;"></i> ${account.platform || '-'}`;
                break;
            case 'actions':
                td.innerHTML = `
                    <button class="btn-icon action-btn" data-action="edit" title="编辑"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-icon action-btn" data-action="delete" title="删除"><i class="fas fa-trash-alt"></i></button>
                `;
                // 使用传入的回调函数附加事件监听器
                td.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (handleActionCallback) handleActionCallback('edit', account.id);
                });
                td.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (handleActionCallback) handleActionCallback('delete', account.id);
                });
                break;
            case 'groupName': // 使用预先连接的 groupName (如果可用)
                 td.textContent = account.groupName || '默认分组';
                 break;
            default: // 处理数据字段
                const displayValue = getDisplayValue(rawValue, col.truncatable);
                td.innerHTML = displayValue; // 直接设置 innerHTML 以支持潜在的错误样式

                // 如果字段可复制且成功检索到值，则添加 copyable 类和数据属性
                if (isOriginallySensitive && rawValue && !hasValueError) {
                    td.classList.add('copyable-cell');
                    td.dataset.copyValue = escapeAttribute(rawValue); // 使用此文件内的 escapeAttribute
                    td.title = '点击复制'; // 添加 title 提示
                } else if (hasValueError) {
                    td.title = rawValue; // 在 title 中显示错误
                }
                break;
        }
        row.appendChild(td);
    });

    // 可选：如果存在一般性解密错误，则高亮整行或添加提示
    if (account.decryptionError) {
        // row.classList.add('decryption-error-row'); // 添加 CSS 类进行样式化
        row.title = `${row.title ? row.title + ' ' : ''}注意: ${account.decryptionError}`; // 追加或设置行提示
    }

    return row;
}

/**
 * 渲染每页显示数量选择器。
 * @param {number} currentItemsPerPage - 当前选中的每页显示数量。
 * @param {Array<number>} pageSizeOptions - 可选的每页显示数量数组。
 * @returns {DocumentFragment} 包含标签和选择框的文档片段。
 */
export function renderPageSizeSelector(currentItemsPerPage, pageSizeOptions = [5, 10, 15, 25, 50, 100]) {
    const fragment = document.createDocumentFragment();

    const label = document.createElement('span');
    label.textContent = '每页显示: ';
    label.style.marginRight = '8px';
    fragment.appendChild(label);

    const select = document.createElement('select');
    select.style.cssText = 'padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc;'; // 与原样式一致

    pageSizeOptions.forEach(size => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = `${size}条`;
        if (size === currentItemsPerPage) {
            option.selected = true;
        }
        select.appendChild(option);
    });
    fragment.appendChild(select);

    return fragment;
}

/**
 * 渲染分页控件。
 * @param {number} totalItems - 总项目数。
 * @param {number} itemsPerPage - 每页显示的项目数。
 * @param {number} currentPage - 当前页码。
 * @returns {DocumentFragment} 包含分页控件的文档片段。
 */
export function renderPaginationControls(totalItems, itemsPerPage, currentPage) {
    const fragment = document.createDocumentFragment();
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // 页面信息 (例如 "1/10页 共95条")
    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info text-sm text-gray-600 mr-4';
    pageInfo.textContent = `${Math.max(1, currentPage)}/${Math.max(1, totalPages)}页 共${totalItems}条`;
    fragment.appendChild(pageInfo);

    if (totalPages <= 1) return fragment; // 如果只有一页或没有内容，则不需要按钮

    // 按钮创建辅助函数 (纯DOM创建，不绑定事件)
    const createButtonElement = (text, pageNum, isDisabled = false, isActive = false) => {
        const button = document.createElement('button');
        button.innerHTML = text; // innerHTML 用于支持 &laquo; 等HTML实体
        button.disabled = isDisabled;
        button.className = `px-3 py-1 border rounded-md text-sm mx-1 ${isActive ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`;
        if (!isDisabled && pageNum) {
            button.dataset.page = pageNum; // 将页码存储在 data-* 属性中
        }
        return button;
    };

    // 上一页按钮
    fragment.appendChild(createButtonElement('&laquo;', currentPage - 1, currentPage === 1));

    // 页码按钮 (带省略号逻辑)
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    if (startPage > 1) {
        fragment.appendChild(createButtonElement('1', 1));
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'px-2 py-1 text-sm';
            fragment.appendChild(ellipsis);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        fragment.appendChild(createButtonElement(i.toString(), i, false, i === currentPage));
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'px-2 py-1 text-sm';
            fragment.appendChild(ellipsis);
        }
        fragment.appendChild(createButtonElement(totalPages.toString(), totalPages));
    }

    // 下一页按钮
    fragment.appendChild(createButtonElement('&raquo;', currentPage + 1, currentPage === totalPages));

    return fragment;
}

// Future rendering functions (renderPaginationElement) will be added here.
// 修正注释，因为 renderPaginationElement 不是计划中的名称
// No more rendering functions planned for immediate future in this file for social table.