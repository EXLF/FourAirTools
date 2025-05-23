/**
 * IPC通信帮助工具
 */

/**
 * 检测并返回可用的IPC接口
 * @returns {Object|null} IPC接口对象，如果找不到则返回null
 */
export function detectIPC() {
    // 尝试检测IPC接口的不同可能位置和命名
    const ipcOptions = [
        window.ipcRenderer,
        window.electron?.ipcRenderer,
        window.api?.invoke ? { invoke: window.api.invoke } : null,
        window.bridge?.invoke ? { invoke: window.bridge.invoke } : null,
        window.ipc,
        // 如果上面都找不到，最后添加一个全局搜索
        Object.keys(window).some(key => window[key]?.invoke && typeof window[key].invoke === 'function') 
            ? window[Object.keys(window).find(key => window[key]?.invoke && typeof window[key].invoke === 'function')]
            : null
    ];
    
    for (const option of ipcOptions) {
        if (option && typeof option.invoke === 'function') {
            console.log(`找到IPC接口: ${
                option === window.ipcRenderer ? 'window.ipcRenderer' : 
                option === window.electron?.ipcRenderer ? 'window.electron.ipcRenderer' : 
                option === window.api ? 'window.api' : 
                option === window.bridge ? 'window.bridge' : 
                option === window.ipc ? 'window.ipc' : '未知来源'
            }`);
            return option;
        }
    }
    
    console.warn("在window对象上找不到有效的IPC接口");
    return null;
}

/**
 * 获取钱包列表
 * @returns {Promise<Array>} 钱包数组
 */
export async function getWallets() {
    const ipc = detectIPC();
    if (!ipc) {
        // 返回模拟数据
        return [
            { id: 'wallet1', address: '0x1234...5678', name: '主钱包1', group: 'L0组' },
            { id: 'wallet2', address: '0xabcd...efgh', name: '测试钱包A', group: 'Base组' },
            { id: 'wallet3', address: '0xdef1...2345', name: '空投钱包X', group: 'zkSync组' },
            { id: 'wallet4', address: '0xffff...0000', name: '分组钱包Y', group: 'Arbitrum组' },
        ];
    }
    
    try {
        const response = await ipc.invoke('db:getWallets', {});
        if (response && Array.isArray(response.wallets)) {
            return response.wallets;
        } else if (Array.isArray(response)) {
            return response;
        }
        return [];
    } catch (error) {
        console.error('获取钱包列表失败:', error);
        return [];
    }
}

/**
 * 获取代理列表
 * @returns {Promise<Array>} 代理数组
 */
export async function getProxies() {
    const ipc = detectIPC();
    if (!ipc) {
        // 返回模拟数据
        return [
            { 
                id: 'proxy1', 
                name: '#1', 
                host: '192.168.1.1', 
                port: 8080, 
                protocol: 'http', 
                username: 'user1', 
                password: 'pass1',
                decryptedPassword: 'pass1',
                status: 'active' 
            },
            { 
                id: 'proxy2', 
                name: '#2', 
                host: '192.168.1.2', 
                port: 8080, 
                protocol: 'socks5', 
                username: 'user2', 
                password: 'pass2',
                decryptedPassword: 'pass2',
                status: 'active' 
            },
            { 
                id: 'proxy3', 
                name: '#3', 
                host: '192.168.1.3', 
                port: 8080, 
                protocol: 'http', 
                username: 'user3', 
                password: 'pass3',
                decryptedPassword: 'pass3',
                status: 'inactive' 
            },
        ];
    }
    
    try {
        const response = await ipc.invoke('db:getProxies', {
            page: 1,
            limit: 1000,
            sortBy: 'id',
            sortOrder: 'asc',
            type: 'all',
            groupId: 'all',
            status: 'all',
            search: ''
        });
        
        if (response && Array.isArray(response.proxies)) {
            return response.proxies;
        } else if (Array.isArray(response)) {
            return response;
        }
        return [];
    } catch (error) {
        console.error('获取代理列表失败:', error);
        return [];
    }
} 