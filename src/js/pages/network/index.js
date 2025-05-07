// 网络代理管理主入口文件

import { initDOMElements, showLoadingIndicator, hideLoadingIndicator } from './modules/dom.js';
import { state, setLoading, updatePaginationState, getCurrentQueryOptions } from './modules/state.js';
import { renderTable, updateRow } from './modules/table.js';
import { renderPagination } from './modules/pagination.js';
import { setupEventListeners, listenForTestResults } from './modules/events.js';
import { showToast } from '../../components/toast.js';

/**
 * 加载代理数据。
 */
export async function loadProxies() {
    if (state.isLoading) return;
    setLoading(true);
    showLoadingIndicator();

    try {
        const { proxies, total } = await window.dbAPI.getProxies(getCurrentQueryOptions());
        renderTable(proxies);
        renderPagination(total);
        updatePaginationState(state.currentPage, total);
    } catch (error) {
        console.error('加载代理列表失败:', error);
        showToast('加载代理列表失败', 'error');
    } finally {
        setLoading(false);
        hideLoadingIndicator();
    }
}

/**
 * 初始化网络（IP 代理）页面。
 * @param {HTMLElement} pageElement - 要操作的主要内容区域。
 */
export function initNetworkPage(pageElement) {
    console.log("Initializing Network Page...");
    
    // 初始化DOM元素
    if (!initDOMElements(pageElement)) {
        return;
    }

    // 设置事件监听器
    setupEventListeners(loadProxies);

    // 加载代理列表
        loadProxies();

    // 监听代理测试结果
    listenForTestResults(updateRow);
} 