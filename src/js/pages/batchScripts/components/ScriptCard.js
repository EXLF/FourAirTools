/**
 * 脚本卡片组件
 */

/**
 * 创建批处理脚本卡片
 * @param {Object} scriptData - 脚本数据
 * @param {Function} onCardClick - 卡片点击回调
 * @returns {HTMLElement} 卡片元素
 */
export function createBatchScriptCard(scriptData, onCardClick) {
    const card = document.createElement('div');
    card.className = 'script-card';
    card.dataset.id = scriptData.id;
    card.dataset.category = scriptData.category || '';
    card.dataset.status = scriptData.status || 'active';
    
    let iconHTML;
    if (scriptData.imageUrl) {
        iconHTML = `<div class="card-icon"><img src="${scriptData.imageUrl}" alt="${scriptData.name}" class="script-image"></div>`;
    } else if (scriptData.icon) {
        iconHTML = `<div class="card-icon fa-icon"><i class="${scriptData.icon || 'fas fa-code'}"></i></div>`;
    } else {
        iconHTML = `<div class="card-icon code-icon"><i class="fas fa-code"></i></div>`;
    }
    
    card.innerHTML = `
        ${iconHTML}
        <div class="card-content">
            <h3 class="card-title">${scriptData.name}</h3>
            <p class="card-description">${scriptData.description || ''}</p>
        </div>
    `;
    
    if (onCardClick) {
        card.addEventListener('click', () => onCardClick(scriptData));
    }
    
    return card;
}

/**
 * 创建批处理脚本卡片网格容器
 * @returns {HTMLElement} 网格容器元素
 */
export function createScriptCardsContainer() {
    const container = document.createElement('div');
    container.id = 'batchScriptCardsContainer';
    container.className = 'scripts-grid';
    return container;
}

/**
 * 渲染脚本卡片到容器
 * @param {HTMLElement} container - 容器元素
 * @param {Array} scriptDataList - 脚本数据列表
 * @param {Function} onCardClick - 卡片点击回调
 */
export function renderScriptCards(container, scriptDataList, onCardClick) {
    container.innerHTML = '';
    scriptDataList.forEach(scriptData => {
        const card = createBatchScriptCard(scriptData, onCardClick);
        container.appendChild(card);
    });
} 