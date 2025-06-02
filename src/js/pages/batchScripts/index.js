/**
 * 脚本插件管理页面 - 主模块（重构版）
 * 负责初始化页面、加载批量任务列表和基本交互
 */

import { showModal } from '../../components/modal.js';
import { translateLocation } from '../../utils/locationTranslator.js';
import { BatchTaskManager } from './batchTaskManager.js';
import { TaskLogger } from './logger.js';

// 导入新的核心管理器（渐进式集成）
// 注意：由于模块系统兼容性问题，暂时使用动态导入
let ScriptManager, TaskStateManager, ExecutionEngine, LogManager;

// 导入重构后的模块
import { 
    batchScriptTypes, 
    modules, 
    moduleOrder, 
    batchTaskConfigs,
    VIEW_MODES 
} from './config/constants.js';
import { formatAddress, formatProxy } from './utils/formatters.js';
import { createBatchScriptCard, renderScriptCards } from './components/ScriptCard.js';
import { createFilterPanelHTML, setupFilteringFunction, populateFilters } from './components/FilterPanel.js';
import { WalletGroupManager } from './modules/WalletGroupManager.js';
import { ProxyManager } from './modules/ProxyManager.js';
import { detectIPC, getWallets, getProxies } from './utils/ipcHelper.js';

// 页面状态管理
const pageState = {
    contentAreaRef: null,
    currentView: VIEW_MODES.CARDS,
    currentBatchScriptType: null,
    walletGroupManager: new WalletGroupManager(),
    proxyManager: new ProxyManager()
};

// 新的核心管理器实例（渐进式集成）
let coreManagers = null;

/**
 * 立即设置中文乱码修复功能
 * 不依赖模块加载，立即生效
 */
function setupChineseTextFix() {
    // console.log('[中文修复] 启用中文乱码修复功能...');
    
    // 中文乱码映射表
    const chineseFixMap = {
        '鑴氭湰': '脚本',
        '鎵ц': '执行', 
        '閰嶇疆': '配置',
        '鍒濆鍖?': '初始化',
        '姝ｅ湪': '正在',
        '瀹屾垚': '完成',
        '閽卞寘': '钱包',
        '鑾峰彇': '获取',
        '娣诲姞': '添加',
        '浠ｇ悊': '代理',
        '鎴愬姛': '成功',
        '澶辫触': '失败',
        '鍚姩': '启动',
        '鍋滄': '停止',
        '杩愯': '运行',
        '妫€娴?': '检测',
        '鍔犺浇': '加载',
        '淇濆瓨': '保存',
        '鍒犻櫎': '删除',
        '淇敼': '修改',
        '鏇存柊': '更新',
        '鍒楄〃': '列表',
        '鏁版嵁': '数据',
        '鏂囦欢': '文件',
        '鐩綍': '目录',
        '璺緞': '路径',
        '杩炴帴': '连接',
        '鏂板缓': '新建',
        '涓嬭浇': '下载',
        '涓婁紶': '上传',
        '鍒嗘瀽': '分析',
        '澶勭悊': '处理',
        '鍙戦€?': '发送',
        '鎺ユ敹': '接收',
        '鍝嶅簲': '响应',
        '璇锋眰': '请求',
        '閿欒': '错误',
        '璀﹀憡': '警告',
        '淇℃伅': '信息',
        '璋冭瘯': '调试',
        '鐘舵€?': '状态',
        '缁撴灉': '结果',
        '杩斿洖': '返回',
        '鏁版嵁搴?': '数据库',
        '琛ㄦ牸': '表格',
        '鍒楃殑': '列的',
        '琛岀殑': '行的',
        '鎺掑簭': '排序',
        '绛涢€?': '筛选',
        '鏌ヨ': '查询',
        '鎻掑叆': '插入',
        '绠＄悊鍣?': '管理器',
        '鎺у埗鍙?': '控制台',
        '鏃ュ織': '日志',
        '鍙傛暟': '参数',
        '閫夐」': '选项',
        '璁剧疆': '设置',
        '閰嶇疆椤?': '配置项',
        '鍔熻兘': '功能',
        '妯″潡': '模块',
        '缁勪欢': '组件',
        '鏈嶅姟': '服务',
        '鎺ュ彛': '接口',
        '鏍煎紡': '格式',
        '鍐呭': '内容',
        '瀛楃': '字符',
        '瀛楃涓?': '字符串',
        '鏁板瓧': '数字',
        '甯冨皵': '布尔',
        '鏁扮粍': '数组',
        '瀵硅薄': '对象',
        '鍑芥暟': '函数',
        '鏂规硶': '方法',
        '灞炴€?': '属性',
        '鍊?': '值',
        '閿?': '键',
        '鍚嶇О': '名称',
        '鏍囬': '标题',
        '鎻忚堪': '描述',
        '璇存槑': '说明',
        '甯姪': '帮助',
        '鐗堟湰': '版本',
        '鏇存柊鏃ュ織': '更新日志',
        '鍙戝竷': '发布',
        '涓嬭浇閾炬帴': '下载链接',
        '瀹夎': '安装',
        '鍗歌浇': '卸载',
        '鍚姩椤?': '启动项',
        '闅愯棌': '隐藏',
        '鏄剧ず': '显示',
        '鎵撳紑': '打开',
        '鍏抽棴': '关闭',
        '鏈€澶у寲': '最大化',
        '鏈€灏忓寲': '最小化',
        '鍏ㄥ睆': '全屏',
        '绐楀彛': '窗口',
        '鑿滃崟': '菜单',
        '宸ュ叿鏍?': '工具栏',
        '鐘舵€佹': '状态栏',
        '渚ц竟鏍?': '侧边栏',
        '瀵艰埅': '导航',
        '闈㈡澘': '面板',
        '瀵硅瘽妗?': '对话框',
        '鎻愮ず妗?': '提示框',
        '璀﹀憡妗?': '警告框',
        '纭妗?': '确认框',
        '杈撳叆妗?': '输入框',
        '鎸夐挳': '按钮',
        '閾炬帴': '链接',
        '鏍囩': '标签',
        '琛ㄥ崟': '表单',
        '鍒嗛〉': '分页',
        '鍔犺浇涓?': '加载中',
        '璇峰稍鍚?': '请稍候',
        '姝ｅ湪鍔犺浇': '正在加载',
        '鍔犺浇瀹屾垚': '加载完成',
        '鍔犺浇澶辫触': '加载失败',
        '缃戠粶寮傚父': '网络异常',
        '杩炴帴瓒呮椂': '连接超时',
        '鏈嶅姟鍣ㄩ敊璇?': '服务器错误',
        '鎵句笉鍒?': '找不到',
        '娌℃湁鏉冮檺': '没有权限',
        '宸叉嫆缁?': '已拒绝',
        '宸插彇娑?': '已取消',
        '鎿嶄綔鎴愬姛': '操作成功',
        '鎿嶄綔澶辫触': '操作失败',
        '淇濆瓨鎴愬姛': '保存成功',
        '淇濆瓨澶辫触': '保存失败',
        '鍒犻櫎鎴愬姛': '删除成功',
        '鍒犻櫎澶辫触': '删除失败',
        '澶嶅埗鎴愬姛': '复制成功',
        '澶嶅埗澶辫触': '复制失败',
        '鍒囨崲鎴愬姛': '切换成功',
        '鍒囨崲澶辫触': '切换失败',
        '杩炴帴鎴愬姛': '连接成功',
        '杩炴帴澶辫触': '连接失败',
        '鏂紑杩炴帴': '断开连接',
        '閲嶆柊杩炴帴': '重新连接',
        '鍚屾鎴愬姛': '同步成功',
        '鍚屾澶辫触': '同步失败',
        '澶囦唤鎴愬姛': '备份成功',
        '澶囦唤澶辫触': '备份失败',
        '杩樺師鎴愬姛': '还原成功',
        '杩樺師澶辫触': '还原失败',
        '瀵煎嚭鎴愬姛': '导出成功',
        '瀵煎嚭澶辫触': '导出失败',
        '瀵煎叆鎴愬姛': '导入成功',
        '瀵煎叆澶辫触': '导入失败',
        '璁よ瘉鎴愬姛': '认证成功',
        '璁よ瘉澶辫触': '认证失败',
        '鐧诲綍鎴愬姛': '登录成功',
        '鐧诲綍澶辫触': '登录失败',
        '娉ㄩ攢鎴愬姛': '注销成功',
        '鐧昏娌℃湁鏉冮檺': '登录没有权限',
        '宸茬櫥褰?': '已登录',
        '鏈櫥褰?': '未登录',
        '浼氳瘽杩囨湡': '会话过期',
        '璇烽噸鏂扮櫥褰?': '请重新登录',
        '瀵嗙爜閿欒': '密码错误',
        '鐢ㄦ埛鍚嶉敊璇?': '用户名错误',
        '璐︽埛涓嶅瓨鍦?': '账户不存在',
        '璐︽埛宸插瓨鍦?': '账户已存在',
        '璐︽埛宸茶鍐荤粨': '账户已被冻结',
        '璐︽埛宸茶绂佺敤': '账户已被禁用',
        '鎿嶄綔澶憄': '操作太频繁',
        '璇风◢鍚庡啀璇?': '请稍后再试',
        '鏁版嵁涓嶅瓨鍦?': '数据不存在',
        '鏁版嵁宸插瓨鍦?': '数据已存在',
        '鏁版嵁宸茶繃鏈?': '数据已过期',
        '鏁版嵁鏍煎紡閿欒': '数据格式错误',
        '鍙傛暟閿欒': '参数错误',
        '鍙傛暟缂哄け': '参数缺失',
        '鍙傛暟鏃犳晥': '参数无效',
        '鏍煎紡涓嶆敮鎸?': '格式不支持',
        '鏂囦欢涓嶅瓨鍦?': '文件不存在',
        '鏂囦欢宸插瓨鍦?': '文件已存在',
        '鏂囦欢澶?': '文件过大',
        '鏂囦欢澶?': '文件过小',
        '鏂囦欢鎹熷潖': '文件损坏',
        '鏂囦欢鏍煎紡涓嶆敮鎸?': '文件格式不支持',
        '纾佺洏绌洪棿涓嶈冻': '磁盘空间不足',
        '鍐呭瓨涓嶈冻': '内存不足',
        'CPU鍗犵敤杩囬珮': 'CPU占用过高',
        '缃戠粶涓嶇ǔ瀹?': '网络不稳定',
        '淇″彿涓嶈壇': '信号不良',
        '鐢垫睜鐢甸噺浣?': '电池电量低',
        '鍏呯數鍣ㄦ湭杩炴帴': '充电器未连接',
        '鎬ф兘浼樺寲涓?': '性能优化中',
        '娓呯悊缂撳瓨涓?': '清理缓存中',
        '鎵弿鐥呮瘨涓?': '扫描病毒中',
        '绯荤粺鍗囩骇涓?': '系统升级中',
        '瀹夊叏妫€娴嬩腑': '安全检测中',
        '鍗囩骇瀹屾垚': '升级完成',
        '妫€娴嬪畬鎴?': '检测完成',
        '浼樺寲瀹屾垚': '优化完成',
        '娓呯悊瀹屾垚': '清理完成',
        '鎵弿瀹屾垚': '扫描完成',
        '澶囦唤瀹屾垚': '备份完成',
        '杩樺師瀹屾垚': '还原完成',
        '瀹夎瀹屾垚': '安装完成',
        '鍗歌浇瀹屾垚': '卸载完成',
        '閰嶇疆瀹屾垚': '配置完成',
        '鍒濆鍖栧畬鎴?': '初始化完成',
        '钀ч敊': '错误',
        '鍒嗘瀽': '分析',
        '鍙傝€?': '参考',
        '宸ュ叿': '工具',
        '鐢ㄦ埛': '用户',
        '绠＄悊': '管理',
        '娓呮櫚': '清楚',
        '瀹屾垚': '完成',
        '鍙互': '可以',
        '涓嶅彲浠?': '不可以',
        '璁稿彲': '许可',
        '绂佹': '禁止',
        '鍏佽': '允许',
        '閮ㄧ讲': '部署',
        '鍙戝竷': '发布',
        '绠$悊鍣?': '管理器',
        '绯荤粺': '系统',
        '杞欢': '软件',
        '纭欢': '硬件',
        '鍐呮牳': '内核',
        '椹卞姩': '驱动',
        '搴旂敤': '应用',
        '绋嬪簭': '程序',
        '杩涚▼': '进程',
        '绾跨▼': '线程',
        '浠诲姟': '任务',
        '闃熷垪': '队列',
        '鍫嗘爤': '堆栈',
        '缂撳瓨': '缓存',
        '鍐呭瓨': '内存',
        '瀛樺偍': '存储',
        '纭洏': '硬盘',
        '纾佺洏': '磁盘',
        '鍒嗗尯': '分区',
        '鏂囦欢绯荤粺': '文件系统',
        '鏃ュ織鏂囦欢': '日志文件',
        '閰嶇疆鏂囦欢': '配置文件',
        '鍙彲鎵ц鏂囦欢': '可执行文件',
        '搴撴枃浠?': '库文件',
        '鍥惧儚鏂囦欢': '图像文件',
        '闊抽鏂囦欢': '音频文件',
        '瑙嗛鏂囦欢': '视频文件',
        '鏂囨湰鏂囦欢': '文本文件',
        '鍘嬬缉鏂囦欢': '压缩文件',
        '澶囦唤鏂囦欢': '备份文件',
        '涓存椂鏂囦欢': '临时文件',
        '缂撳瓨鏂囦欢': '缓存文件',
        '鏃ュ織': '日志'
    };
    
    // 创建全局的安全中文修复函数
    window.__fixChineseText = function(text) {
        if (typeof text !== 'string') return text;
        
        // 只对包含特定中文乱码模式的文本进行修复
        const hasSpecificGarbledChinese = /鑴氭湰|鎵ц|閰嶇疆|鍒濆鍖|姝ｅ湪|瀹屾垚|閽卞寘|鑾峰彇|鎴愬姛|澶辫触/.test(text);
        
        if (!hasSpecificGarbledChinese) {
            return text; // 如果没有特定的中文乱码，直接返回原文本
        }
        
        let fixed = text;
        // 只处理确实包含乱码的部分
        for (const [garbled, correct] of Object.entries(chineseFixMap)) {
            if (fixed.includes(garbled)) {
                fixed = fixed.replace(new RegExp(garbled, 'g'), correct);
            }
        }
        return fixed;
    };
    
    // 只在脚本插件模块内部使用的受控修复功能
    window.__logWithChineseFix = function(level, ...args) {
        const fixedArgs = args.map(arg => {
            if (typeof arg === 'string') {
                return window.__fixChineseText(arg);
            }
            return arg;
        });
        
        switch (level) {
            case 'error':
                console.error('[脚本插件]', ...fixedArgs);
                break;
            case 'warn':
                console.warn('[脚本插件]', ...fixedArgs);
                break;
            case 'info':
                console.info('[脚本插件]', ...fixedArgs);
                break;
            default:
                console.log('[脚本插件]', ...fixedArgs);
        }
    };
    
    // 测试修复功能
    const testText = "鎺ユ敹鍒拌幏鍙栬剼鏈垪琛ㄨ姹?";
    const fixedText = window.__fixChineseText(testText);
    
    // console.log('[中文修复] ✅ 中文乱码修复功能已启用');
}

/**
 * 显示脚本模块重构状态
 */
function showRefactorStatus() {
    // 减少初始化阶段的日志输出，避免控制台混乱
    console.log('✨ 脚本插件模块重构完成!');
}

/**
 * 初始化核心管理器（使用动态导入）
 */
async function initCoreManagers() {
    if (coreManagers) {
        console.log('[核心管理器] 已初始化，跳过重复初始化');
        return true;
    }

    try {
        // console.log('[核心管理器] 开始动态加载新的架构模块...');
        
        // 动态导入模块
        const [
            { ScriptManager: SM },
            { TaskStateManager: TSM },
            { ExecutionEngine: EE },
            { LogManager: LM }
        ] = await Promise.all([
            import('./core/ScriptManager.js'),
            import('./core/TaskStateManager.js'),
            import('./core/ExecutionEngine.js'),
            import('./core/LogManager.js')
        ]);
        
        // 设置全局引用
        ScriptManager = SM;
        TaskStateManager = TSM;
        ExecutionEngine = EE;
        LogManager = LM;
        
        // console.log('[核心管理器] 模块动态加载成功');
        // console.log('[核心管理器] 检查模块可用性:');
        // console.log('- ScriptManager:', typeof ScriptManager);
        // console.log('- TaskStateManager:', typeof TaskStateManager);  
        // console.log('- ExecutionEngine:', typeof ExecutionEngine);
        // console.log('- LogManager:', typeof LogManager);
        
        // 创建核心管理器实例
        // console.log('[核心管理器] 创建 TaskStateManager...');
        const taskStateManager = new TaskStateManager();
        
        // console.log('[核心管理器] 创建 LogManager...');
        const logManager = new LogManager();
        
        // console.log('[核心管理器] 创建 ExecutionEngine...');
        const executionEngine = new ExecutionEngine(taskStateManager);
        
        // console.log('[核心管理器] 创建 ScriptManager...');
        const scriptManager = new ScriptManager();
        
        // 存储管理器实例
        coreManagers = {
            scriptManager,
            taskStateManager,
            executionEngine,
            logManager
        };
        
        // 设置跨模块通信
        setupCoreManagersIntegration();
        
        // console.log('[核心管理器] 新架构模块初始化完成');
        // console.log('[核心管理器] 管理器实例:', Object.keys(coreManagers));
        
        // 将核心管理器暴露到全局（便于调试和其他模块访问）
        if (typeof window !== 'undefined') {
            window.__FA_CoreManagers = coreManagers;
            // console.log('[核心管理器] 已暴露到全局变量 window.__FA_CoreManagers');
            // console.log('[核心管理器] 验证全局变量:', !!window.__FA_CoreManagers);
            
            // 立即启用新的日志管理器来处理中文乱码
            window.__FA_ActiveLogManager = logManager;
            // console.log('[核心管理器] 已激活新的日志管理器，开始处理中文乱码修复');
            
            // 显示重构状态
            showRefactorStatus();
        }
        
        return true;
    } catch (error) {
        console.error('[核心管理器] 初始化失败:', error);
        console.error('[核心管理器] 错误堆栈:', error.stack);
        coreManagers = null;
        return false;
    }
}

/**
 * 设置核心管理器间的集成
 */
function setupCoreManagersIntegration() {
    if (!coreManagers) return;
    
    const { taskStateManager, logManager, executionEngine } = coreManagers;
    
    // 设置状态变更监听，自动记录日志
    taskStateManager.subscribe((taskId, stateData) => {
        const { state, previousState } = stateData;
        
        if (previousState && previousState !== state) {
            logManager.addLog(taskId, 'info', `任务状态变更: ${previousState} -> ${state}`, {
                source: 'state_manager',
                stateTransition: true
            });
        }
    });
    
    console.log('[核心管理器] 跨模块集成设置完成');
}

/**
 * 获取核心管理器实例
 * @returns {Object|null} 核心管理器实例
 */
function getCoreManagers() {
    return coreManagers;
}

// 后台任务管理 - 使用全局对象确保不会被重新初始化
if (!window.__FABackgroundTasks) {
    window.__FABackgroundTasks = new Map();
}
const backgroundTasks = window.__FABackgroundTasks; // 引用全局的 Map
const BACKGROUND_TASKS_STORAGE_KEY = 'fa_background_tasks';

// 添加调试标志和强制显示功能
const DEBUG_BACKGROUND_TASKS = false; // 关闭调试模式

/**
 * 保存后台任务到localStorage
 */
function saveBackgroundTasksToStorage() {
    try {
        const tasksArray = Array.from(backgroundTasks.entries()).map(([taskId, task]) => ({
            taskId,
            taskInstanceId: task.taskInstanceId,
            executionId: task.executionId,
            scriptType: task.scriptType,
            startTime: task.startTime,
            status: task.status,
            // 保存日志历史（限制大小以避免超出localStorage限制）
            logHistory: task.logHistory ? task.logHistory.slice(-100) : [] // 只保存最近100条
        }));
        localStorage.setItem(BACKGROUND_TASKS_STORAGE_KEY, JSON.stringify(tasksArray));
        console.log('[后台任务] 已保存到localStorage:', tasksArray.length, '个任务');
    } catch (error) {
        console.error('[后台任务] 保存到localStorage失败:', error);
    }
}

/**
 * 从localStorage恢复后台任务
 * 注意：应用重启后，所有脚本执行都已停止，因此应该清理所有"僵尸"任务
 */
function loadBackgroundTasksFromStorage() {
    try {
        const stored = localStorage.getItem(BACKGROUND_TASKS_STORAGE_KEY);
        if (stored) {
            const tasksArray = JSON.parse(stored);
            
            // 检查是否是应用重启（通过sessionStorage检测）
            // sessionStorage在应用关闭时会被清理，所以可以用来检测应用重启
            const sessionKey = 'fa_app_session_active';
            const isAppRestart = !sessionStorage.getItem(sessionKey);
            
            console.log('[后台任务] 会话检测:', {
                sessionExists: !!sessionStorage.getItem(sessionKey),
                isAppRestart,
                tasksFound: tasksArray.length
            });
            
            if (isAppRestart) {
                console.log('[后台任务] 检测到应用重启，清理所有僵尸任务');
                console.log('[后台任务] 发现', tasksArray.length, '个僵尸任务，将被清理');
                
                // 清理localStorage中的僵尸任务
                localStorage.removeItem(BACKGROUND_TASKS_STORAGE_KEY);
                
                // 显示清理信息
                if (tasksArray.length > 0) {
                    console.log('[后台任务] 已清理以下僵尸任务:');
                    tasksArray.forEach(task => {
                        console.log(`  - ${task.scriptType?.name || '未知脚本'} (${task.taskId})`);
                    });
                }
                
                // 设置会话标志（只在确认是新会话时设置）
                sessionStorage.setItem(sessionKey, 'true');
                console.log('[后台任务] 已设置新会话标志');
                
                return; // 不恢复任何任务
            }
            
            // 如果不是应用重启，正常恢复任务（这种情况很少见）
            tasksArray.forEach(taskData => {
                // 创建简化的任务对象（不包含函数引用）
                const task = {
                    taskInstanceId: taskData.taskInstanceId,
                    executionId: taskData.executionId,
                    scriptType: taskData.scriptType,
                    logUnsubscribers: [], // 将在需要时重新创建
                    logCleanup: null,
                    timer: null,
                    startTime: taskData.startTime,
                    status: taskData.status,
                    // 恢复日志历史
                    logHistory: taskData.logHistory || []
                };
                backgroundTasks.set(taskData.taskId, task);
            });
            console.log('[后台任务] 从localStorage恢复:', tasksArray.length, '个任务');
        } else {
            // 没有存储的任务，但仍需要设置会话标志
            const sessionKey = 'fa_app_session_active';
            if (!sessionStorage.getItem(sessionKey)) {
                sessionStorage.setItem(sessionKey, 'true');
                console.log('[后台任务] 新会话开始，无后台任务需要清理');
            }
        }
    } catch (error) {
        console.error('[后台任务] 从localStorage恢复失败:', error);
        // 如果解析失败，清理localStorage
        localStorage.removeItem(BACKGROUND_TASKS_STORAGE_KEY);
        
        // 设置会话标志
        const sessionKey = 'fa_app_session_active';
        if (!sessionStorage.getItem(sessionKey)) {
            sessionStorage.setItem(sessionKey, 'true');
        }
    }
}

/**
 * 初始化全局后台任务管理器
 */
function initGlobalBackgroundTaskManager() {
    // 将后台任务管理器绑定到全局
    if (!window.FABackgroundTaskManager) {
        window.FABackgroundTaskManager = {
            tasks: backgroundTasks,
            saveToStorage: saveBackgroundTasksToStorage,
            loadFromStorage: loadBackgroundTasksFromStorage,
            updateIndicator: updateBackgroundTaskIndicator,
            moveToBackground: moveTaskToBackground,
            restore: restoreTaskFromBackground,
            stop: stopBackgroundTask,
            getAll: getBackgroundTasks,
            debug: debugBackgroundTasks,
            createTest: createTestBackgroundTask,
            clearTests: clearAllTestTasks,
            forceUpdate: forceUpdateIndicator,
            clearZombies: clearZombieTasks
        };
        
        // 恢复后台任务
        loadBackgroundTasksFromStorage();
        
        console.log('[全局后台任务] 管理器已初始化，恢复任务数量:', backgroundTasks.size);
        

    }
}



// 页面加载时立即初始化全局管理器
if (typeof window !== 'undefined') {
    // 立即执行，不等待页面加载
    console.log('[全局后台任务] 开始初始化...');
    initGlobalBackgroundTaskManager();
}

/**
 * 初始化脚本插件管理页面
 * @param {HTMLElement} contentArea - 内容区域元素
 */
export async function initBatchScriptsPage(contentArea) {
    console.log("初始化脚本插件管理页面...");
    console.log("[后台任务] 初始化时的后台任务数量:", backgroundTasks.size);
    pageState.contentAreaRef = contentArea;
    
    // 立即启用中文乱码修复功能
    setupChineseTextFix();
    
    // 初始化新的核心管理器（渐进式集成）
    console.log('[脚本插件] 开始初始化核心管理器...');
    const initSuccess = await initCoreManagers();
    console.log('[脚本插件] 核心管理器初始化结果:', initSuccess);
    
    // 设置页面标志
    window.__isBatchScriptsPageActive = true;
    
    // 立即加载样式，确保后台任务面板样式可用
    addCompactTaskStyles();
    
    // 确保全局后台任务管理器已初始化
    initGlobalBackgroundTaskManager();
    
    // 初始化调试工具
    initDebugTools();
    
    // 恢复后台任务状态（从全局管理器）
    if (window.FABackgroundTaskManager) {
        window.FABackgroundTaskManager.loadFromStorage();
        console.log('[后台任务] 从全局管理器恢复任务状态');
        console.log('[后台任务] 恢复后的任务数量:', backgroundTasks.size);
    }
    
    renderBatchScriptCardsView(contentArea);
    
    // 初始化时也检查后台任务指示器
    setTimeout(() => {
        updateBackgroundTaskIndicator();
        console.log('[后台任务] 页面初始化完成，更新指示器');
        console.log('[后台任务] 最终的后台任务数量:', backgroundTasks.size);
    }, 100);
    
    // 额外的延迟确保DOM完全加载
    setTimeout(() => {
        forceUpdateIndicator();
        debugBackgroundTasks();
    }, 1000);

    // 注册全局IPC监听器
    if (globalLogUnsubscriber) globalLogUnsubscriber(); // 清理旧的（如果有）
    if (globalCompletedUnsubscriber) globalCompletedUnsubscriber(); // 清理旧的（如果有）

    if (window.scriptAPI) {
        console.log('[脚本插件] 使用 scriptAPI 注册全局日志和完成监听器');
        globalLogUnsubscriber = window.scriptAPI.onLog(globalLogEventHandler);
        globalCompletedUnsubscriber = window.scriptAPI.onScriptCompleted(globalScriptCompletedHandler);
    } else if (window.electron && window.electron.ipcRenderer) {
        console.log('[脚本插件] 使用 ipcRenderer 注册全局日志和完成监听器');
        window.electron.ipcRenderer.on('script-log', globalLogEventHandler);
        window.electron.ipcRenderer.on('script-completed', globalScriptCompletedHandler);
        globalLogUnsubscriber = () => window.electron.ipcRenderer.removeListener('script-log', globalLogEventHandler);
        globalCompletedUnsubscriber = () => window.electron.ipcRenderer.removeListener('script-completed', globalScriptCompletedHandler);
    } else {
        console.error('[脚本插件] 无法注册全局日志监听器：scriptAPI 和 ipcRenderer都不可用。');
    }
}

/**
 * 渲染脚本插件卡片视图
 * @param {HTMLElement} contentArea - 内容区域元素
 */
function renderBatchScriptCardsView(contentArea) {
    // console.log('[调试] renderBatchScriptCardsView 开始，当前后台任务数量:', backgroundTasks.size);
    // console.log('[调试] 后台任务详情:', Array.from(backgroundTasks.entries()));
    
    pageState.currentView = VIEW_MODES.CARDS;
    
    const cardViewHtml = `
    <div class="page-header">
        <h1>脚本插件</h1>
        <div class="header-actions">
            <button id="background-tasks-btn" class="btn btn-secondary" style="display: none;">
                <i class="fas fa-tasks"></i> 后台任务 (<span id="background-task-count">0</span>)
            </button>
            <button id="refresh-batch-scripts-btn" class="btn btn-secondary">
                <i class="fas fa-sync-alt"></i> 刷新列表
            </button>
        </div>
    </div>
    ${createFilterPanelHTML()}
    
    <!-- 后台任务面板 -->
    <div class="background-tasks-panel" id="backgroundTasksPanel" style="display: none;">
        <div class="panel-header">
            <h3><i class="fas fa-tasks"></i> 后台运行的任务</h3>
            <button class="close-btn" id="closeBackgroundPanel">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="panel-content" id="backgroundTasksList">
            <!-- 后台任务列表将在此处动态加载 -->
        </div>
    </div>
    
    <div class="script-cards-grid" id="batchScriptCardsContainer"></div>`;
    
    contentArea.innerHTML = cardViewHtml;
    
    // 绑定刷新按钮事件
    const refreshBtn = contentArea.querySelector('#refresh-batch-scripts-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            // 更改按钮状态以指示正在同步
            refreshBtn.disabled = true;
            const originalText = refreshBtn.innerHTML;
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 同步中...';
            
            try {
                // 先执行脚本同步（如果可用）
                if (window.scriptAPI && typeof window.scriptAPI.syncScripts === 'function') {
                    const syncResult = await window.scriptAPI.syncScripts();
                    console.log('[脚本插件] 脚本同步结果:', syncResult);
                    
                    // 如果同步了删除的脚本，显示提示
                    if (syncResult.success && syncResult.result && syncResult.result.processedScripts) {
                        const deletedScripts = syncResult.result.processedScripts.filter(s => s.status === 'deleted');
                        if (deletedScripts.length > 0) {
                            console.log('[脚本插件] 已删除的脚本:', deletedScripts);
                            // 可以在这里添加用户通知
                        }
                    }
                }
            } catch (syncError) {
                console.error('[脚本插件] 同步脚本时出错:', syncError);
            } finally {
                // 然后加载脚本列表
                loadAndRenderBatchScriptCards(contentArea);
                
                // 恢复按钮状态
                setTimeout(() => {
                    refreshBtn.innerHTML = originalText;
                    refreshBtn.disabled = false;
                }, 500);
            }
        });
    }
    
    // 绑定后台任务按钮事件
    const backgroundTasksBtn = contentArea.querySelector('#background-tasks-btn');
    if (backgroundTasksBtn) {
        backgroundTasksBtn.addEventListener('click', () => {
            toggleBackgroundTasksPanel();
        });
    }
    
    // 绑定关闭后台任务面板按钮
    const closeBackgroundPanel = contentArea.querySelector('#closeBackgroundPanel');
    if (closeBackgroundPanel) {
        closeBackgroundPanel.addEventListener('click', () => {
            toggleBackgroundTasksPanel(false);
        });
    }
    
    loadAndRenderBatchScriptCards(contentArea);
    setupFilteringFunction(contentArea);
    
    // 确保DOM渲染完成后再更新后台任务指示器
    setTimeout(() => {
        // console.log('[后台任务] DOM渲染完成，更新指示器');
        // console.log('[后台任务] 当前后台任务数量:', backgroundTasks.size);
        // console.log('[后台任务] 后台任务详情:', Array.from(backgroundTasks.entries()));
        updateBackgroundTaskIndicator();
        
        // 如果有后台任务但按钮没显示，强制更新
        if (backgroundTasks.size > 0) {
            const btn = document.getElementById('background-tasks-btn');
            const count = document.getElementById('background-task-count');
            if (btn && count) {
                btn.style.display = 'inline-flex';
                btn.classList.add('has-background-tasks');
                count.textContent = backgroundTasks.size;
                console.log('[后台任务] 强制显示后台任务按钮');
            }
        }
    }, 500);
}

/**
 * 加载并渲染脚本插件卡片
 * @param {HTMLElement} pageContentArea - 卡片页面的内容区域
 */
async function loadAndRenderBatchScriptCards(pageContentArea) {
    const cardsContainer = pageContentArea.querySelector('#batchScriptCardsContainer');
    const statusFilterElement = pageContentArea.querySelector('#batchScriptStatusFilter');
    
    if (!cardsContainer) {
        console.error('卡片容器 #batchScriptCardsContainer 未找到');
        return;
    }
    
    cardsContainer.innerHTML = '';
    
    // 加载脚本列表 - 优先使用新的 ScriptManager
    let scriptsList = [];
    const managers = getCoreManagers();
    
    if (managers && managers.scriptManager) {
        try {
            console.log('[脚本插件] 使用新的 ScriptManager 加载脚本');
            const scripts = await managers.scriptManager.getAvailableScripts();
            scriptsList = scripts.map(s => ({
                ...s,  // 保留所有原始字段，包括requires
                status: s.status || 'active',
                category: s.category || ''
            }));
            
            console.log('[脚本插件] 通过 ScriptManager 加载的脚本数据:', scriptsList);
        } catch (managerError) {
            console.warn('[脚本插件] ScriptManager 加载失败，回退到原有方式:', managerError);
        }
    }
    
    // 回退方案：使用原有的加载方式
    if (scriptsList.length === 0) {
        console.log('[脚本插件] 使用原有 API 方式加载脚本');
        if (window.scriptAPI && typeof window.scriptAPI.getAllScripts === 'function') {
            try {
                const result = await window.scriptAPI.getAllScripts();
                if (result.success && Array.isArray(result.data)) {
                    scriptsList = result.data.map(s => ({
                        ...s,  // 保留所有原始字段，包括requires
                        status: s.status || 'active',
                        category: s.category || ''
                    }));
                    
                    // 添加调试日志
                    console.log('[脚本插件] 通过原有API加载的脚本数据:', scriptsList);
                    const httpScript = scriptsList.find(script => script.id === 'http_request_test');
                    if (httpScript) {
                        console.log('[脚本插件] HTTP请求测试脚本数据:', httpScript);
                        console.log('[脚本插件] HTTP脚本requires字段:', httpScript.requires);
                    }
                } else {
                    console.error('获取脚本列表失败:', result.error);
                }
            } catch (error) {
                console.error('调用 getAllScripts 时出错:', error);
            }
        } else {
            console.warn('scriptAPI 未定义，使用静态脚本类型列表');
            scriptsList = batchScriptTypes;
        }
    }

    // 渲染脚本卡片
    renderScriptCards(cardsContainer, scriptsList, (scriptData) => {
        pageState.currentBatchScriptType = scriptData;
        const taskInstanceId = `task_${scriptData.id}_${Date.now()}`;
        navigateToModularTaskManager(taskInstanceId);
    });
    
    // 更新筛选器选项
    populateFilters(statusFilterElement, scriptsList);
}

/**
 * 导航到模块化任务管理器视图
 */
function navigateToModularTaskManager(taskInstanceId) {
    console.log("导航到模块化任务管理器...");
    console.log("当前脚本数据:", pageState.currentBatchScriptType);
    console.log("脚本requires字段:", pageState.currentBatchScriptType?.requires);
    console.log("脚本requires.wallets:", pageState.currentBatchScriptType?.requires?.wallets);
    pageState.currentView = VIEW_MODES.MANAGER;
    
    // 保存任务实例ID到全局变量
    window.__currentTaskInstanceId = taskInstanceId;
    
    // 清理可能存在的旧资源，但保留任务实例ID
    cleanupResources(true);
    
    if (!pageState.contentAreaRef || !pageState.currentBatchScriptType) {
        console.error("contentAreaRef或currentBatchScriptType未定义");
        return;
    }

    const templateHtml = `
    <div class="batch-task-container">
        <div class="task-header">
            <div class="header-nav">
                <button id="back-to-cards-btn" class="back-btn" title="返回">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <h3>${pageState.currentBatchScriptType.name}</h3>
            </div>
            <div class="header-status">
                <div class="status-info">
                    <span class="status-text" id="statusText">配置中</span>
                    <span class="timer" id="timer" style="display: none;">00:00</span>
                </div>
                <div class="header-controls" id="headerControls" style="display: none;">
                    <button id="back-to-config-btn" class="control-btn btn-secondary" title="返回配置">
                        <i class="fas fa-cog"></i>
                        <span>配置</span>
                    </button>
                    <button id="stop-btn" class="control-btn btn-danger" style="display: none;" title="停止执行">
                        <i class="fas fa-stop"></i>
                        <span>停止</span>
                    </button>
                </div>
            </div>
        </div>
        
        <div class="task-body">
            <!-- 配置区域 -->
            <div class="config-section" id="configSection">
                <div class="config-content" id="moduleContentDisplay">
                    <!-- 配置内容将在此处动态加载 -->
                </div>
                <div class="action-bar">
                    <button id="start-execution-btn" class="btn btn-primary">
                        <i class="fas fa-play"></i> 开始执行
                    </button>
                </div>
            </div>
            
            <!-- 执行日志区域 -->
            <div class="log-section" id="logSection" style="display: none;">
                <div class="log-toolbar">
                    <div class="log-info">
                        <span class="log-title">执行日志</span>
                        <span class="log-stats">
                            <span id="totalCount">0</span> 个任务 | 
                            成功 <span id="successCount">0</span> | 
                            失败 <span id="failCount">0</span>
                        </span>
                    </div>
                    <div class="log-actions">
                        <button class="tool-btn" id="autoScrollBtn" title="自动滚动">
                            <i class="fas fa-angle-double-down"></i>
                        </button>
                        <button class="tool-btn" id="downloadBtn" title="下载日志">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="tool-btn" id="clearBtn" title="清空日志">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="log-container" id="taskLogContainer">
                    <!-- 日志内容 -->
                </div>
            </div>
        </div>
    </div>
    `;

    pageState.contentAreaRef.innerHTML = templateHtml;
    
    // 初始化任务配置
    if (!batchTaskConfigs[taskInstanceId]) {
        batchTaskConfigs[taskInstanceId] = {
            scriptTypeId: pageState.currentBatchScriptType.id,
            scriptName: pageState.currentBatchScriptType.name,
            accounts: [],
            proxyConfig: {
                enabled: false,
                strategy: 'one-to-one',
                proxies: []
            }
        };
    }
    
    bindModularManagerEvents(taskInstanceId);
    loadModuleContent('simple-config', taskInstanceId);
    
    // 添加必要的样式
    addCompactTaskStyles();
}

/**
 * 为模块化管理器绑定事件
 * @param {string} taskInstanceId - 当前配置的任务实例的唯一ID
 */
function bindModularManagerEvents(taskInstanceId) {
    const managerPage = pageState.contentAreaRef.querySelector('.batch-task-container');
    if (!managerPage) {
        console.error("Batch task container not found");
        return;
    }

    // 返回按钮
    const backToCardsButton = managerPage.querySelector('#back-to-cards-btn');
    if (backToCardsButton) {
        backToCardsButton.addEventListener('click', (event) => {
            event.preventDefault();
            saveCurrentModuleData(taskInstanceId);
            
            // 检查是否有正在运行的任务
            const currentExecutionId = window.__currentExecutionId;
            const hasExecutionTimer = !!window.__executionTimer;
            const hasStartTime = !!window.__startTime;
            
            // 智能检测任务运行状态：
            // 1. 有执行ID且有计时器 - 明确运行中
            // 2. 有执行ID且有开始时间但没计时器 - 可能刚开始执行，计时器还没启动
            // 3. 只有执行ID但没有开始时间 - 可能是已完成的任务，不应移至后台
            const isTaskRunning = currentExecutionId && (hasExecutionTimer || hasStartTime);
            
            console.log('[脚本插件] 返回按钮点击，任务状态检查:', {
                currentExecutionId,
                hasExecutionTimer,
                hasStartTime,
                isTaskRunning,
                taskInstanceId
            });
            
            if (isTaskRunning) {
                // 如果有正在运行的任务，保存到后台而不是清理
                moveTaskToBackground(taskInstanceId);
                console.log('[脚本插件] 任务已移至后台运行');
                
                // 添加小延迟，确保后台任务保存完成
                setTimeout(() => {
                    renderBatchScriptCardsView(pageState.contentAreaRef);
                }, 100);
            } else {
                // 没有运行中的任务，正常清理
                cleanupResources();
                renderBatchScriptCardsView(pageState.contentAreaRef);
            }
        });
    }

    // 开始执行按钮
    const startTaskButton = managerPage.querySelector('#start-execution-btn');
    if (startTaskButton) {
        // 监听钱包选择变化，更新按钮状态
        const updateStartButtonState = () => {
            const selectedWallets = document.querySelectorAll('input[name="selected-wallets"]:checked');
            const walletCount = selectedWallets.length;
            
            // 检查当前脚本是否需要钱包
            const scriptRequires = pageState.currentBatchScriptType?.requires;
            const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true; // 默认需要钱包
            
            // console.log('[脚本插件] 按钮状态检查:', {
            //     requiresWallets,
            //     walletCount,
            //     scriptName: pageState.currentBatchScriptType?.name,
            //     scriptRequires: pageState.currentBatchScriptType?.requires,
            //     scriptRequiresWallets: scriptRequires?.wallets,
            //     buttonElement: startTaskButton
            // });
            
            if (requiresWallets) {
                // 需要钱包的脚本，必须选择至少一个钱包
                if (walletCount > 0) {
                    startTaskButton.disabled = false;
                    // console.log('[脚本插件] 已选择钱包，启用执行按钮');
                } else {
                    startTaskButton.disabled = true;
                    // console.log('[脚本插件] 未选择钱包，禁用执行按钮');
                }
            } else {
                // 不需要钱包的脚本，直接启用按钮
                startTaskButton.disabled = false;
                // console.log('[脚本插件] 不需要钱包，启用执行按钮');
            }
        };
        
        // 初始检查
        setTimeout(() => {
            updateStartButtonState();
            // console.log('[脚本插件] 执行按钮状态初始检查完成');
        }, 200);
        
        // 监听钱包选择变化
        document.addEventListener('change', (e) => {
            if (e.target.name === 'selected-wallets') {
                updateStartButtonState();
            }
        });
        
        startTaskButton.addEventListener('click', async (event) => {
            event.preventDefault();
            await handleStartExecution(taskInstanceId, startTaskButton);
        });
    }

    // 返回配置按钮
    const backToConfigBtn = managerPage.querySelector('#back-to-config-btn');
    if (backToConfigBtn) {
        backToConfigBtn.addEventListener('click', (event) => {
            event.preventDefault();
            
            // 检查是否有正在运行的任务
            const currentExecutionId = window.__currentExecutionId;
            const isTaskRunning = currentExecutionId && window.__executionTimer;
            
            if (isTaskRunning) {
                // 如果有正在运行的任务，保存到后台而不是停止
                moveTaskToBackground(taskInstanceId);
                console.log('[脚本插件] 任务已移至后台运行（从执行页面返回配置）');
            }
            
            switchToConfigStage();
        });
    }

    // 停止执行按钮
    const stopTaskButton = managerPage.querySelector('#stop-btn');
    if (stopTaskButton) {
        stopTaskButton.addEventListener('click', async (event) => {
            event.preventDefault();
            
            // 确认停止
            if (!confirm('确定要停止当前正在执行的任务吗？')) {
                return;
            }
            
            try {
                // 禁用按钮防止重复点击
                stopTaskButton.disabled = true;
                stopTaskButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>停止中</span>';
                
                // 停止执行计时器
                if (window.__executionTimer) {
                    clearInterval(window.__executionTimer);
                    window.__executionTimer = null;
                }
                
                // 获取当前执行的任务ID
                const currentExecutionId = window.__currentExecutionId;
                if (currentExecutionId && window.scriptAPI && window.scriptAPI.stopScript) {
                    TaskLogger.logWarning('正在停止脚本执行...');
                    
                    const result = await window.scriptAPI.stopScript(currentExecutionId);
                    if (result.success) {
                        TaskLogger.logWarning('✋ 脚本执行已被用户停止');
                        
                        // 更新状态
                        const statusText = document.getElementById('statusText');
                        if (statusText) {
                            statusText.textContent = '已停止';
                            statusText.style.color = '#e74c3c';
                        }
                        
                        // 清理监听器
                        if (window.__currentLogUnsubscribers) {
                            window.__currentLogUnsubscribers.forEach(unsubscribe => {
                                if (typeof unsubscribe === 'function') {
                                    unsubscribe();
                                }
                            });
                            window.__currentLogUnsubscribers = null;
                        }
                        
                        // 隐藏停止按钮
                        stopTaskButton.style.display = 'none';
                        
                        // 重置开始按钮
                        const startButton = managerPage.querySelector('#start-execution-btn');
                        if (startButton) {
                            startButton.disabled = false;
                            startButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
                        }
                    } else {
                        TaskLogger.logError(`停止脚本失败: ${result.error || '未知错误'}`);
                        // 恢复按钮状态
                        stopTaskButton.disabled = false;
                        stopTaskButton.innerHTML = '<i class="fas fa-stop"></i><span>停止</span>';
                    }
                } else if (currentExecutionId && currentExecutionId.startsWith('mock_exec_')) {
                    // 处理模拟执行的停止
                    TaskLogger.logWarning('正在停止模拟执行...');
                    
                    // 清理模拟任务函数
                    if (window[`__mockTask_${taskInstanceId}`]) {
                        delete window[`__mockTask_${taskInstanceId}`];
                    }
                    
                    // 清空执行ID（这会触发模拟执行检查并停止）
                    window.__currentExecutionId = null;
                    
                    TaskLogger.logWarning('✋ 模拟执行已被用户停止');
                    
                    // 更新状态
                    const statusText = document.getElementById('statusText');
                    if (statusText) {
                        statusText.textContent = '已停止';
                        statusText.style.color = '#e74c3c';
                    }
                    
                    // 清理监听器
                    if (window.__currentLogUnsubscribers) {
                        window.__currentLogUnsubscribers.forEach(unsubscribe => {
                            if (typeof unsubscribe === 'function') {
                                unsubscribe();
                            }
                        });
                        window.__currentLogUnsubscribers = null;
                    }
                    
                    // 隐藏停止按钮
                    stopTaskButton.style.display = 'none';
                    
                    // 重置开始按钮
                    const startButton = managerPage.querySelector('#start-execution-btn');
                    if (startButton) {
                        startButton.disabled = false;
                        startButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
                    }
                } else {
                    TaskLogger.logError('无法停止脚本：执行ID不存在或停止接口不可用');
                    // 恢复按钮状态
                    stopTaskButton.disabled = false;
                    stopTaskButton.innerHTML = '<i class="fas fa-stop"></i><span>停止</span>';
                }
            } catch (error) {
                console.error('停止脚本执行失败:', error);
                TaskLogger.logError(`停止脚本失败: ${error.message}`);
                
                // 恢复按钮状态
                stopTaskButton.disabled = false;
                stopTaskButton.innerHTML = '<i class="fas fa-stop"></i><span>停止</span>';
            }
        });
    }
}

/**
 * 处理开始执行任务
 * @param {string} taskInstanceId - 任务实例ID
 * @param {HTMLElement} startTaskButton - 开始按钮元素
 */
async function handleStartExecution(taskInstanceId, startTaskButton) {
    // 防止重复点击
    if (startTaskButton.disabled) {
        console.log('任务正在执行中，请勿重复点击');
        return;
    }
    
    // 保存任务实例ID到全局变量
    window.__currentTaskInstanceId = taskInstanceId;
    console.log('[脚本插件] 开始执行任务，任务实例ID:', taskInstanceId);
    
    // 记录开始时间（立即记录，不等待计时器）
    window.__startTime = Date.now();
    
    // 检查是否已有相同脚本的后台任务在运行
    const scriptId = pageState.currentBatchScriptType?.id;
    const existingBackgroundTask = Array.from(backgroundTasks.values()).find(task => 
        task.scriptType?.id === scriptId
    );
    
    if (existingBackgroundTask) {
        const userChoice = confirm(
            `检测到该脚本已有任务在后台运行中！\n\n` +
            `脚本名称: ${existingBackgroundTask.scriptType.name}\n` +
            `运行时长: ${formatDuration(Date.now() - existingBackgroundTask.startTime)}\n\n` +
            `点击"确定"查看现有任务\n` +
            `点击"取消"停止现有任务并创建新任务`
        );
        
        if (userChoice) {
            // 用户选择查看现有任务
            if (restoreTaskFromBackground(existingBackgroundTask.taskInstanceId)) {
                // 切换到执行阶段
                setTimeout(() => {
                    const taskConfig = batchTaskConfigs[existingBackgroundTask.taskInstanceId];
                    if (taskConfig) {
                        switchToExecutionStage(taskConfig);
                    }
                }, 100);
            }
            return;
        } else {
            // 用户选择停止现有任务
            await stopBackgroundTask(existingBackgroundTask.taskInstanceId);
            console.log('[脚本插件] 已停止现有后台任务，准备创建新任务');
        }
    }
    
    // 立即禁用按钮
    startTaskButton.disabled = true;
    startTaskButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 准备中...';
    
    saveCurrentModuleData(taskInstanceId);
    
    const taskConfig = batchTaskConfigs[taskInstanceId];
    
    // 检查当前脚本是否需要钱包
    const scriptRequires = pageState.currentBatchScriptType?.requires;
    const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true; // 默认需要钱包
    
    // 验证配置
    if (requiresWallets && taskConfig.accounts.length === 0) {
        alert('请至少选择一个钱包账户');
        startTaskButton.disabled = false;
        startTaskButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
        return;
    }
    
    if (taskConfig.proxyConfig.enabled) {
        if (taskConfig.proxyConfig.proxies.length === 0) {
            alert('已启用代理，但代理列表为空。请添加代理或禁用代理功能。');
            startTaskButton.disabled = false;
            startTaskButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
            return;
        }
        
        if (taskConfig.proxyConfig.strategy === 'one-to-one' && 
            taskConfig.proxyConfig.proxies.length < taskConfig.accounts.length) {
            alert(`一对一代理策略需要至少与钱包数量相同的代理IP。\n当前钱包数量: ${taskConfig.accounts.length}\n当前代理数量: ${taskConfig.proxyConfig.proxies.length}`);
            startTaskButton.disabled = false;
            startTaskButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
            return;
        }
    }
    
    // 切换到执行阶段界面
    switchToExecutionStage(taskConfig);
    
    // 清理旧的监听器和日志，但保留任务实例ID
    cleanupResources(true);
    
    // 初始化日志
    const logContainer = document.getElementById('taskLogContainer');
    if (logContainer) {
        TaskLogger.clearLogContainer(logContainer);
        const cleanupLogRender = TaskLogger.renderLogsToContainer(logContainer, true);
        window.__currentLogCleanup = cleanupLogRender;
        
        TaskLogger.logInfo('🚀 脚本插件执行系统已初始化');
        TaskLogger.logInfo(`📋 任务名称: ${pageState.currentBatchScriptType.name}`);
        
        if (requiresWallets) {
            TaskLogger.logInfo(`👥 选择的钱包数量: ${taskConfig.accounts.length}`);
        } else {
            TaskLogger.logInfo(`🔧 脚本类型: 通用工具脚本（无需钱包）`);
        }
        
        if (taskConfig.proxyConfig.enabled) {
            TaskLogger.logInfo(`🌐 代理配置: ${taskConfig.proxyConfig.strategy} 策略，共 ${taskConfig.proxyConfig.proxies.length} 个代理`);
        }
    }
    
    // 创建任务实例
    const batchTaskManager = new BatchTaskManager();
    const taskData = {
        id: taskInstanceId,
        name: `${pageState.currentBatchScriptType.name} 批量任务`,
        scriptId: pageState.currentBatchScriptType.id,
        scriptName: pageState.currentBatchScriptType.name,
        accountIds: taskConfig.accounts,
        proxyConfig: taskConfig.proxyConfig,
        status: 'running',
        startTime: Date.now()
    };
    
    try {
        await batchTaskManager.addTask(taskData);
        TaskLogger.logInfo(`任务 ${taskInstanceId} 已创建并保存到任务管理器`);
    } catch (err) {
        console.warn('添加到批量任务管理器失败:', err);
        TaskLogger.logWarning('无法保存任务状态，但脚本执行不受影响');
    }
    
    // 执行脚本
    if (window.scriptAPI && typeof window.scriptAPI.executeScript === 'function') {
        startTaskButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 执行中...';
        
        const scriptConfig = {
            batchMode: true,
            timestamp: Date.now(),
            taskId: taskInstanceId
        };
        
        // 准备代理配置
        let actualProxyConfigToPass = null;
        if (taskConfig.proxyConfig.enabled && taskConfig.proxyConfig.proxies.length > 0) {
            actualProxyConfigToPass = {
                strategy: taskConfig.proxyConfig.strategy,
                proxies: taskConfig.proxyConfig.proxies
            };
        }
        
        // 注册日志监听（确保只注册一次）
        setupScriptLogListeners(taskInstanceId, startTaskButton);
        
        try {
            console.log('[脚本插件] 开始执行脚本...');
            const result = await window.scriptAPI.executeScript(
                pageState.currentBatchScriptType.id,
                taskConfig.accounts,
                scriptConfig,
                actualProxyConfigToPass
            );
            
            if (result && result.success && result.data && result.data.executionId) {
                // 调用新的 setupScriptLogListeners 来设置 executionId 并准备UI
                setupScriptLogListeners(taskInstanceId, startTaskButton, result.data.executionId);

                const stopBtn = document.getElementById('stop-btn');
                if (stopBtn) {
                    stopBtn.style.display = 'inline-flex';
                }
            } else {
                // 处理 executeScript 失败或未返回 executionId 的情况
                TaskLogger.logError(`启动脚本失败: ${result?.error || '未获得执行ID'}`);
                switchToConfigStage(); 
                startTaskButton.disabled = false;
                startTaskButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
            }
        } catch (err) {
            console.error('[脚本插件] 执行失败:', err);
            TaskLogger.logError(`执行失败: ${err.message || err}`);
            switchToConfigStage();
            startTaskButton.disabled = false;
            startTaskButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
        }
    } else {
        console.warn('脚本执行接口未定义，使用模拟执行');
        TaskLogger.logWarning('脚本执行接口未定义，将模拟执行过程');
        
        // 在模拟模式下也生成执行ID
        window.__currentExecutionId = 'mock_exec_' + taskInstanceId.split('_').pop();
        console.log('[脚本插件] 模拟执行ID已生成:', window.__currentExecutionId);
        
        // 显示停止按钮
        const stopBtn = document.getElementById('stop-btn');
        if (stopBtn) {
            stopBtn.style.display = 'inline-flex';
        }
        
        // 模拟执行过程
        setTimeout(() => {
            TaskLogger.logInfo('开始模拟执行...');
            
            // 检查当前脚本是否需要钱包
            const scriptRequires = pageState.currentBatchScriptType?.requires;
            const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true; // 默认需要钱包
            
            let completed = 0;
            const total = requiresWallets ? taskConfig.accounts.length : 1; // 不需要钱包的脚本只执行一次
            
            // 创建独立的模拟执行函数，不依赖DOM
            const simulateTask = () => {
                // 检查任务是否还在运行（通过检查后台任务或当前执行ID）
                const isInBackground = backgroundTasks.has(taskInstanceId);
                const isInForeground = window.__currentExecutionId === 'mock_exec_' + taskInstanceId.split('_').pop();
                
                if (!isInBackground && !isInForeground) {
                    // 任务被停止
                    console.log('[脚本插件] 模拟执行被停止');
                    return;
                }
                
                if (completed < total) {
                    completed++;
                    const logMsg = requiresWallets 
                        ? `账户 ${completed}/${total} 执行成功`
                        : `脚本执行成功`;
                    
                    // 如果在前台，使用TaskLogger
                    if (isInForeground && typeof TaskLogger !== 'undefined' && TaskLogger.logSuccess) {
                        TaskLogger.logSuccess(logMsg);
                    } else {
                        // 在后台，只记录日志
                        console.log('[后台执行]', logMsg);
                    }
                    
                    // 只有在前台执行时才更新UI
                    if (isInForeground) {
                        const successCountElement = document.getElementById('successCount');
                        if (successCountElement) {
                            successCountElement.textContent = completed;
                        }
                    }
                    
                    // 继续下一次执行
                    setTimeout(simulateTask, 1000);
                } else {
                    // 执行完成
                    console.log('[脚本插件] 模拟执行完成');
                    
                    // 如果在前台，显示完成信息
                    if (isInForeground && typeof TaskLogger !== 'undefined') {
                        TaskLogger.logSuccess('✅ 脚本插件执行完成！');
                        TaskLogger.logInfo(`📊 执行总结:`);
                        if (requiresWallets) {
                            TaskLogger.logInfo(`   - 总账户数: ${total}`);
                        } else {
                            TaskLogger.logInfo(`   - 脚本类型: 通用工具脚本`);
                        }
                        TaskLogger.logInfo(`   - 成功: ${completed}`);
                        TaskLogger.logInfo(`   - 失败: 0`);
                        TaskLogger.logInfo(`   - 耗时: 模拟执行`);
                    }
                    
                    // 清理后台任务
                    if (isInBackground) {
                        backgroundTasks.delete(taskInstanceId);
                        saveBackgroundTasksToStorage();
                        updateBackgroundTaskIndicator();
                    }
                    
                    // 清理前台资源
                    if (isInForeground) {
                        // 停止计时器
                        if (window.__executionTimer) {
                            clearInterval(window.__executionTimer);
                            window.__executionTimer = null;
                        }
                        
                        // 更新状态
                        const statusText = document.getElementById('statusText');
                        if (statusText) {
                            statusText.textContent = '已完成';
                            statusText.style.color = '#27ae60';
                        }
                        
                        // 隐藏停止按钮
                        const stopBtnElement = document.getElementById('stop-btn');
                        if (stopBtnElement) {
                            stopBtnElement.style.display = 'none';
                        }
                        
                        // 重置开始按钮状态
                        if (startTaskButton) {
                            startTaskButton.disabled = false;
                            startTaskButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
                        }
                        
                        // 清理监听器
                        if (window.__currentLogUnsubscribers) {
                            window.__currentLogUnsubscribers.forEach(unsubscribe => {
                                if (typeof unsubscribe === 'function') {
                                    unsubscribe();
                                }
                            });
                            window.__currentLogUnsubscribers = null;
                        }
                    }
                }
            };
            
            // 保存模拟任务引用，以便后台运行
            window[`__mockTask_${taskInstanceId}`] = simulateTask;
            
            // 开始执行
            simulateTask();
        }, 1000);
    }
}

/**
 * 切换到执行阶段
 * @param {Object} taskConfig - 任务配置
 */
function switchToExecutionStage(taskConfig) {
    // 隐藏配置区域，显示日志区域
    const configSection = document.getElementById('configSection');
    const logSection = document.getElementById('logSection');
    
    if (configSection) {
        configSection.style.display = 'none';
    }
    
    if (logSection) {
        logSection.style.display = 'flex'; // 日志区域也使用flex布局
    }
    
    // 显示头部控制按钮
    const headerControls = document.getElementById('headerControls');
    if (headerControls) {
        headerControls.style.display = 'flex';
    }
    
    // 显示停止按钮
    const stopBtn = document.getElementById('stop-btn');
    if (stopBtn) {
        stopBtn.style.display = 'inline-flex';
    }
    
    // 更新状态
    const statusText = document.getElementById('statusText');
    if (statusText) {
        statusText.textContent = '执行中';
        statusText.style.color = '#f39c12';
    }
    
    // 显示计时器
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.style.display = 'inline';
    }
    
    // 更新统计信息
    const scriptRequires = pageState.currentBatchScriptType?.requires;
    const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true; // 默认需要钱包
    const totalCount = requiresWallets ? taskConfig.accounts.length : 1; // 不需要钱包的脚本显示1个任务
    
    document.getElementById('totalCount').textContent = totalCount;
    document.getElementById('successCount').textContent = '0';
    document.getElementById('failCount').textContent = '0';
    
    // 开始计时
    startExecutionTimer();
}

/**
 * 切换回配置阶段
 */
function switchToConfigStage() {
    // 显示配置区域，隐藏日志区域
    const configSection = document.getElementById('configSection');
    const logSection = document.getElementById('logSection');
    
    if (configSection) {
        // 确保配置区域使用正确的flex布局
        configSection.style.display = 'flex';
        configSection.style.flexDirection = 'column';
        configSection.style.height = '100%';
    }
    
    if (logSection) {
        logSection.style.display = 'none';
    }
    
    // 隐藏头部控制按钮
    const headerControls = document.getElementById('headerControls');
    if (headerControls) {
        headerControls.style.display = 'none';
    }
    
    // 更新状态
    const statusText = document.getElementById('statusText');
    if (statusText) {
        statusText.textContent = '配置中';
        statusText.style.color = '#666';
    }
    
    // 隐藏计时器
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.style.display = 'none';
    }
    
    // 只有在没有后台任务时才停止计时器（避免停止后台脚本）
    const hasBackgroundTasks = backgroundTasks.size > 0;
    if (!hasBackgroundTasks && window.__executionTimer) {
        clearInterval(window.__executionTimer);
        window.__executionTimer = null;
        console.log('[脚本插件] 没有后台任务，停止计时器');
    } else if (hasBackgroundTasks) {
        console.log('[脚本插件] 存在后台任务，保持计时器运行');
    }
    
    // 确保配置内容区域恢复正确的样式
    const configContent = document.getElementById('moduleContentDisplay');
    if (configContent) {
        // 确保内容区域有正确的flex属性
        configContent.style.flex = '1';
        configContent.style.overflowY = 'auto';
        configContent.style.padding = '20px';
    }
    
    // 确保操作栏恢复正确的样式
    const actionBar = document.querySelector('.action-bar');
    if (actionBar) {
        actionBar.style.display = 'block';
        actionBar.style.padding = '16px 20px';
        actionBar.style.background = '#fff';
        actionBar.style.borderTop = '1px solid #e9ecef';
        actionBar.style.textAlign = 'center';
    }
    
    // 强制重新渲染，确保布局正确
    setTimeout(() => {
        if (configSection) {
            // 触发重新布局
            configSection.offsetHeight;
        }
    }, 10);
}

/**
 * 设置脚本日志监听器
 * @param {string} taskInstanceId - 任务实例ID
 * @param {HTMLElement} startTaskButton - 开始按钮元素
 */
function setupScriptLogListeners(taskInstanceId, startTaskButton, executionIdToSet) {
    window.__currentTaskInstanceId = taskInstanceId;
    window.__currentExecutionId = executionIdToSet;

    if (window.__currentLogCleanup) {
        try {
            window.__currentLogCleanup();
        } catch(e) { console.warn("清理旧日志渲染器失败", e); }
        window.__currentLogCleanup = null;
    }

    const logContainer = document.getElementById('taskLogContainer');
    if (logContainer && pageState.currentView === VIEW_MODES.MANAGER) {
        TaskLogger.clearLogContainer(logContainer);
        const cleanupLogRender = TaskLogger.renderLogsToContainer(logContainer, true);
        window.__currentLogCleanup = cleanupLogRender;
        TaskLogger.logInfo(`开始监听任务 ${taskInstanceId} (执行ID: ${executionIdToSet}) 的日志...`);
    }
    
    console.log(`[脚本插件] 已设置当前活动任务: taskInstanceId=${taskInstanceId}, executionId=${executionIdToSet}`);
    
    // 由于监听器已全局化，不再需要在此处管理 __currentLogUnsubscribers
    // window.__currentLogUnsubscribers = []; //确保清空，即使不太可能被用到
}

/**
 * 加载模块内容
 * @param {string} moduleId - 模块ID
 * @param {string} taskInstanceId - 任务实例ID
 */
async function loadModuleContent(moduleId, taskInstanceId) {
    const moduleContentDisplay = document.getElementById('moduleContentDisplay');
    if (!moduleContentDisplay) return;
    
    const taskConfig = batchTaskConfigs[taskInstanceId];
    
    try {
        // 获取钱包和代理数据
        const [availableWallets, availableProxies] = await Promise.all([
            getWallets(),
            getProxies()
        ]);
        
        pageState.proxyManager.setAvailableProxies(availableProxies);
        
        // 如果当前没有选择代理但有可用代理，则预填充所有代理
        if (taskConfig.proxyConfig.proxies.length === 0 && availableProxies.length > 0) {
            taskConfig.proxyConfig.proxies = availableProxies.map(proxy => pageState.proxyManager.formatProxy(proxy));
            console.log('预填充代理列表:', taskConfig.proxyConfig.proxies);
        }
        
        // 检查当前脚本是否需要钱包
        const scriptRequires = pageState.currentBatchScriptType?.requires;
        const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true; // 默认需要钱包
        
        // 生成模块内容HTML
        let moduleHtml = '';
        
        if (requiresWallets) {
            // 需要钱包的脚本显示完整配置
            const walletGroups = pageState.walletGroupManager.groupWallets(availableWallets);
            const walletGroupsHtml = pageState.walletGroupManager.generateWalletGroupsHTML(walletGroups, taskInstanceId);
            const proxyConfigHtml = pageState.proxyManager.generateProxyConfigHTML(taskInstanceId, taskConfig.proxyConfig);
            
            moduleHtml = `
                <div class="module-section">
                    <h2><i class="fas fa-wallet"></i> 选择钱包账户</h2>
                    <div class="wallet-selection-section">
                        <div class="section-header">
                            <span id="selected-wallet-count-${taskInstanceId}">已选择 0 个钱包</span>
                            <div class="wallet-actions">
                                <button class="btn btn-sm" id="select-all-wallets-${taskInstanceId}">全选</button>
                                <button class="btn btn-sm" id="deselect-all-wallets-${taskInstanceId}">取消全选</button>
                            </div>
                        </div>
                        <div class="wallet-search-box">
                            <input type="text" id="wallet-search-${taskInstanceId}" placeholder="搜索钱包...">
                            <i class="fas fa-search"></i>
                        </div>
                        <div id="wallet-list-${taskInstanceId}" class="wallet-list">
                            ${walletGroupsHtml}
                        </div>
                    </div>
                    
                    ${proxyConfigHtml}
                </div>
            `;
        } else {
            // 不需要钱包的脚本显示简化配置
            const proxyConfigHtml = pageState.proxyManager.generateProxyConfigHTML(taskInstanceId, taskConfig.proxyConfig);
            
            moduleHtml = `
                <div class="module-section">
                    <h2><i class="fas fa-cog"></i> 脚本配置</h2>
                    <div class="script-info-section">
                        <div class="info-card">
                            <div class="info-header">
                                <i class="fas fa-info-circle"></i>
                                <span>脚本信息</span>
                            </div>
                            <div class="info-content">
                                <p><strong>脚本名称：</strong>${pageState.currentBatchScriptType.name}</p>
                                <p><strong>脚本类型：</strong>通用工具脚本</p>
                                <p><strong>说明：</strong>此脚本不需要钱包账户，可直接执行</p>
                            </div>
                        </div>
                    </div>
                    
                    ${proxyConfigHtml}
                </div>
            `;
        }
        
        moduleContentDisplay.innerHTML = moduleHtml;
        
        // 初始化钱包分组折叠功能
        pageState.walletGroupManager.initWalletGroupCollapse();
        
        // 绑定事件
        bindModuleSpecificInputEvents(moduleId, taskInstanceId, availableProxies);
        
        // 修复：确保在DOM更新后再次初始化折叠功能
        setTimeout(() => {
            pageState.walletGroupManager.initWalletGroupCollapse();
        }, 100);
        
        // 如果IPC不可用，显示警告
        if (!detectIPC()) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'warning-banner';
            warningDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 注意：当前使用的是模拟数据，因为IPC通信未配置。真实数据不可用。';
            moduleContentDisplay.insertBefore(warningDiv, moduleContentDisplay.firstChild);
        }
        
        // 对于不需要钱包的脚本，手动触发按钮状态更新
        if (!requiresWallets) {
            setTimeout(() => {
                const startTaskButton = document.getElementById('start-execution-btn');
                if (startTaskButton) {
                    startTaskButton.disabled = false;
                    console.log('[脚本插件] 不需要钱包的脚本，已启用执行按钮');
                }
            }, 100);
        }
        
    } catch (error) {
        console.error('加载模块内容失败:', error);
        moduleContentDisplay.innerHTML = '<div class="error-message">加载配置失败，请刷新页面重试</div>';
    }
}

/**
 * 绑定模块特定的输入事件
 * @param {string} moduleId - 模块ID
 * @param {string} taskInstanceId - 任务实例ID
 * @param {Array} availableProxies - 可用代理列表
 */
function bindModuleSpecificInputEvents(moduleId, taskInstanceId, availableProxies) {
    const taskConfig = batchTaskConfigs[taskInstanceId];
    const scriptRequires = pageState.currentBatchScriptType?.requires;
    const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true; // 默认需要钱包
    
    // 钱包选择相关事件（仅对需要钱包的脚本）
    if (requiresWallets) {
        const walletsListDiv = document.getElementById(`wallet-list-${taskInstanceId}`);
        
        if (walletsListDiv) {
            // 更新选中计数的函数
            const updateSelectedCount = () => {
                const selectedWallets = walletsListDiv.querySelectorAll('input[name="selected-wallets"]:checked');
                const countElement = document.getElementById(`selected-wallet-count-${taskInstanceId}`);
                if (countElement) {
                    countElement.textContent = `已选择 ${selectedWallets.length} 个钱包`;
                }
                
                // 更新任务配置
                taskConfig.accounts = Array.from(selectedWallets).map(cb => cb.value);
                
                // 更新代理策略详情
                pageState.proxyManager.updateProxyStrategyDetails(taskInstanceId, taskConfig);
            };
            
            // 钱包复选框变化事件
            walletsListDiv.addEventListener('change', (e) => {
                if (e.target.name === 'selected-wallets') {
                    updateSelectedCount();
                    
                    // 更新分组复选框状态
                    const group = e.target.dataset.group;
                    if (group) {
                        pageState.walletGroupManager.updateGroupCheckboxState(group, walletsListDiv);
                    }
                }
                
                // 分组复选框
                if (e.target.classList.contains('group-checkbox')) {
                    const group = e.target.dataset.group;
                    pageState.walletGroupManager.handleGroupCheckboxChange(group, e.target.checked, walletsListDiv);
                    updateSelectedCount(); // 更新总计数
                }
            });
            
            // 全选/取消全选按钮
            const selectAllBtn = document.getElementById(`select-all-wallets-${taskInstanceId}`);
            const deselectAllBtn = document.getElementById(`deselect-all-wallets-${taskInstanceId}`);
            
            if (selectAllBtn) {
                selectAllBtn.addEventListener('click', () => {
                    walletsListDiv.querySelectorAll('input[name="selected-wallets"]').forEach(cb => {
                        cb.checked = true;
                        cb.dispatchEvent(new Event('change', { bubbles: true }));
                    });
                });
            }
            
            if (deselectAllBtn) {
                deselectAllBtn.addEventListener('click', () => {
                    walletsListDiv.querySelectorAll('input[name="selected-wallets"]').forEach(cb => {
                        cb.checked = false;
                        cb.dispatchEvent(new Event('change', { bubbles: true }));
                    });
                });
            }
            
            // 钱包搜索功能
            const walletSearchInput = document.getElementById(`wallet-search-${taskInstanceId}`);
            if (walletSearchInput) {
                walletSearchInput.addEventListener('input', (e) => {
                    const searchTerm = e.target.value.toLowerCase();
                    const walletItems = walletsListDiv.querySelectorAll('.wallet-item');
                    
                    walletItems.forEach(item => {
                        const label = item.querySelector('label').textContent.toLowerCase();
                        item.style.display = label.includes(searchTerm) ? '' : 'none';
                    });
                    
                    // 更新分组显示
                    const walletGroups = walletsListDiv.querySelectorAll('.wallet-group');
                    walletGroups.forEach(group => {
                        const visibleItems = group.querySelectorAll('.wallet-item:not([style*="display: none"])');
                        group.style.display = visibleItems.length > 0 ? '' : 'none';
                    });
                });
            }
        }
    }
    
    // 代理配置相关事件
    const proxyEnabledCheckbox = document.getElementById(`proxy-enabled-${taskInstanceId}`);
    const proxyConfigContent = document.getElementById(`proxy-config-content-${taskInstanceId}`);
    const proxyStrategySelect = document.getElementById(`proxy-strategy-${taskInstanceId}`);
    const refreshProxyBtn = document.getElementById(`refresh-proxy-list-${taskInstanceId}`);
    
    if (proxyEnabledCheckbox) {
        proxyEnabledCheckbox.addEventListener('change', (e) => {
            taskConfig.proxyConfig.enabled = e.target.checked;
            if (proxyConfigContent) {
                proxyConfigContent.style.display = e.target.checked ? '' : 'none';
            }
            if (e.target.checked) {
                pageState.proxyManager.reloadProxyList(taskInstanceId, taskConfig);
                pageState.proxyManager.updateProxyStrategyDetails(taskInstanceId, taskConfig);
            }
        });
    }
    
    if (proxyStrategySelect) {
        proxyStrategySelect.addEventListener('change', (e) => {
            taskConfig.proxyConfig.strategy = e.target.value;
            pageState.proxyManager.updateProxyStrategyDetails(taskInstanceId, taskConfig);
        });
    }
    
    if (refreshProxyBtn) {
        refreshProxyBtn.addEventListener('click', async () => {
            try {
                const proxies = await getProxies();
                pageState.proxyManager.setAvailableProxies(proxies);
                pageState.proxyManager.reloadProxyList(taskInstanceId, taskConfig);
            } catch (error) {
                console.error('刷新代理列表失败:', error);
            }
        });
    }
    
    // 初始化代理列表
    if (taskConfig.proxyConfig.enabled) {
        pageState.proxyManager.reloadProxyList(taskInstanceId, taskConfig);
        pageState.proxyManager.updateProxyStrategyDetails(taskInstanceId, taskConfig);
    }
}

/**
 * 保存当前模块数据
 * @param {string} taskInstanceId - 任务实例ID
 */
function saveCurrentModuleData(taskInstanceId) {
    const taskConfig = batchTaskConfigs[taskInstanceId];
    if (!taskConfig) return;
    
    // 保存钱包选择
    const selectedWallets = document.querySelectorAll(`input[name="selected-wallets"]:checked`);
    taskConfig.accounts = Array.from(selectedWallets).map(cb => cb.value);
    
    // 保存代理配置
    const proxyEnabledCheckbox = document.getElementById(`proxy-enabled-${taskInstanceId}`);
    if (proxyEnabledCheckbox) {
        taskConfig.proxyConfig.enabled = proxyEnabledCheckbox.checked;
    }
    
    const proxyStrategySelect = document.getElementById(`proxy-strategy-${taskInstanceId}`);
    if (proxyStrategySelect) {
        taskConfig.proxyConfig.strategy = proxyStrategySelect.value;
    }
    
    console.log(`保存任务配置 ${taskInstanceId}:`, taskConfig);
}

/**
 * 开始执行计时器
 */
function startExecutionTimer() {
    let seconds = 0;
    const timerElement = document.getElementById('timer');
    
    // 记录开始时间（用于后台任务管理）
    window.__startTime = Date.now();
    
    if (window.__executionTimer) {
        clearInterval(window.__executionTimer);
    }
    
    window.__executionTimer = setInterval(() => {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        
        if (timerElement) {
            timerElement.textContent = 
                `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }, 1000);
    
    // 绑定日志控制按钮
    const clearLogsBtn = document.getElementById('clearBtn');
    const downloadLogsBtn = document.getElementById('downloadBtn');
    const toggleAutoScrollBtn = document.getElementById('autoScrollBtn');
    
    if (clearLogsBtn) {
        clearLogsBtn.onclick = () => {
            const logContainer = document.getElementById('taskLogContainer');
            if (logContainer) {
                TaskLogger.clearLogContainer(logContainer);
                TaskLogger.logInfo('日志已清空');
            }
        };
    }
    
    if (downloadLogsBtn) {
        downloadLogsBtn.onclick = downloadLogs;
    }
    
    if (toggleAutoScrollBtn) {
        let autoScroll = true;
        toggleAutoScrollBtn.classList.add('active');
        
        toggleAutoScrollBtn.onclick = () => {
            autoScroll = !autoScroll;
            toggleAutoScrollBtn.classList.toggle('active', autoScroll);
            
            if (autoScroll) {
                const logContainer = document.getElementById('taskLogContainer');
                if (logContainer) {
                    logContainer.scrollTop = logContainer.scrollHeight;
                }
            }
        };
        
        // 自动滚动逻辑
        const logContainer = document.getElementById('taskLogContainer');
        if (logContainer) {
            const observer = new MutationObserver(() => {
                if (autoScroll) {
                    logContainer.scrollTop = logContainer.scrollHeight;
                }
            });
            
            observer.observe(logContainer, { childList: true, subtree: true });
            window.__logObserver = observer;
        }
    }
}

/**
 * 清理资源
 * @param {boolean} preserveTaskInstanceId - 是否保留任务实例ID
 */
function cleanupResources(preserveTaskInstanceId) {
    // 清理定时器
    if (window.__executionTimer) {
        clearInterval(window.__executionTimer);
        window.__executionTimer = null;
    }
    
    // 清理日志监听器
    if (window.__currentLogUnsubscribers) {
            window.__currentLogUnsubscribers.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            });
            window.__currentLogUnsubscribers = null;
    }
    
    // 清理日志渲染器
    if (window.__currentLogCleanup && typeof window.__currentLogCleanup === 'function') {
        window.__currentLogCleanup();
        window.__currentLogCleanup = null;
    }
    
    // 清理日志观察器
    if (window.__logObserver) {
        window.__logObserver.disconnect();
        window.__logObserver = null;
    }
    
    // 清理执行ID
    if (window.__currentExecutionId) {
        window.__currentExecutionId = null;
    }
    
    // 清理批量任务日志
    if (window.batchTaskLogs) {
        window.batchTaskLogs = {};
    }
    
    // 根据参数决定是否清理任务实例ID
    if (!preserveTaskInstanceId && window.__currentTaskInstanceId) {
        console.log('[脚本插件] 清理任务实例ID:', window.__currentTaskInstanceId);
        window.__currentTaskInstanceId = null;
    } else if (preserveTaskInstanceId && window.__currentTaskInstanceId) {
        console.log('[脚本插件] 保留任务实例ID:', window.__currentTaskInstanceId);
    }
    
    console.log('[脚本插件] 资源清理完成');
}

/**
 * 添加紧凑任务管理器样式
 */
function addCompactTaskStyles() {
    if (document.getElementById('compact-task-styles')) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'compact-task-styles';
    styleElement.textContent = `
        /* 基础样式重置 - 限定在脚本插件页面 */
        .plugin-page * {
            box-sizing: border-box;
        }
        
        /* 页面基础样式 - 限定在脚本插件页面 */
        .plugin-page .page-header {
            margin-bottom: 20px;
        }
        
        .plugin-page .header-actions {
            display: flex;
            gap: 12px;
            align-items: center;
        }
        
        /* 以下为 .batch-task-container 内部的样式，它们已经有较好的作用域，保持不变 */
        .batch-task-container .btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            background: #fff;
            color: #495057;
            text-decoration: none;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .batch-task-container .btn:hover {
            border-color: #6c5ce7;
            color: #6c5ce7;
        }
        
        .batch-task-container .btn.btn-secondary {
            border-color: #6c757d;
            color: #6c757d;
        }
        
        .batch-task-container .btn.btn-secondary:hover {
            background: #6c757d;
            color: #fff;
        }
        
        /* 主容器 */
        .batch-task-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            background: #f8f9fa;
        }
        
        /* 顶部栏 */
        .task-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 20px;
            background: #fff;
            border-bottom: 1px solid #e9ecef;
        }
        
        .header-nav {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .back-btn {
            width: 32px;
            height: 32px;
            border: none;
            background: transparent;
            border-radius: 6px;
            cursor: pointer;
            color: #666;
            transition: all 0.2s;
        }
        
        .back-btn:hover {
            background: #f0f0f0;
            color: #333;
        }
        
        .header-nav h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 500;
            color: #1a1a1a;
        }
        
        .header-status {
            display: flex;
            align-items: center;
            gap: 16px;
            font-size: 14px;
        }
        
        .status-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .status-text {
            color: #666;
        }
        
        .timer {
            font-family: monospace;
            color: #666;
        }
        
        /* 头部控制按钮 */
        .header-controls {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .control-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: #fff;
            color: #666;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
        }
        
        .control-btn:hover {
            border-color: #bbb;
            color: #333;
            background: #f8f9fa;
        }
        
        .control-btn.btn-secondary {
            border-color: #6c757d;
            color: #6c757d;
        }
        
        .control-btn.btn-secondary:hover {
            background: #6c757d;
            color: #fff;
        }
        
        .control-btn.btn-danger {
            border-color: #dc3545;
            color: #dc3545;
        }
        
        .control-btn.btn-danger:hover {
            background: #dc3545;
            color: #fff;
        }
        
        .control-btn i {
            font-size: 12px;
        }
        
        /* 主体区域 */
        .task-body {
            flex: 1;
            overflow: hidden;
        }
        
        /* 配置区域 */
        .config-section {
            height: 100%;
            display: flex;
            flex-direction: column;
        }
        
        .config-content {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
        }
        
        .action-bar {
            padding: 16px 20px;
            background: #fff;
            border-top: 1px solid #e9ecef;
            text-align: center;
        }
        
        /* 日志区域 */
        .log-section {
            height: 100%;
            display: flex;
            flex-direction: column;
            background: #fff;
        }
        
        .log-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 20px;
            border-bottom: 1px solid #e9ecef;
        }
        
        .log-info {
            font-size: 14px;
        }
        
        .log-title {
            font-weight: 500;
            color: #1a1a1a;
            margin-right: 16px;
        }
        
        .log-stats {
            color: #666;
        }
        
        .log-stats span {
            font-weight: 500;
            color: #1a1a1a;
        }
        
        .log-actions {
            display: flex;
            gap: 8px;
        }
        
        .tool-btn {
            width: 32px;
            height: 32px;
            border: none;
            background: transparent;
            border-radius: 6px;
            cursor: pointer;
            color: #666;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .tool-btn:hover {
            background: #f0f0f0;
            color: #333;
        }
        
        .tool-btn.active {
            background: #6c5ce7;
            color: #fff;
        }
        
        .log-container {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 13px;
            line-height: 1.6;
            background: #1e1e1e;
            color: #d4d4d4;
        }
        
        .log-entry {
            margin-bottom: 4px;
            display: flex;
            align-items: flex-start;
        }
        
        .log-time {
            color: #858585;
            margin-right: 12px;
            flex-shrink: 0;
        }
        
        .log-message {
            flex: 1;
            word-break: break-word;
        }
        
        .log-type-info .log-message { color: #d4d4d4; }
        .log-type-success .log-message { color: #4ec9b0; }
        .log-type-warning .log-message { color: #dcdcaa; }
        .log-type-error .log-message { color: #f48771; }
        
        .log-footer {
            padding: 16px 20px;
            background: #fff;
            border-top: 1px solid #e9ecef;
            text-align: center;
        }
        
        /* 模块内容样式 */
        .module-section {
            background: #fff;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 16px;
        }
        
        .module-section h2 {
            margin: 0 0 16px;
            font-size: 16px;
            font-weight: 500;
            color: #1a1a1a;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        /* 钱包选择 */
        .wallet-selection-section {
            border: 1px solid #e9ecef;
            border-radius: 6px;
            overflow: hidden;
        }
        
        /* 脚本信息卡片 */
        .script-info-section {
            margin-bottom: 20px;
        }
        
        .info-card {
            border: 1px solid #e9ecef;
            border-radius: 6px;
            overflow: hidden;
            background: #fff;
        }
        
        .info-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 16px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
            font-size: 14px;
            font-weight: 500;
            color: #495057;
        }
        
        .info-header i {
            color: #6c757d;
        }
        
        .info-content {
            padding: 16px;
        }
        
        .info-content p {
            margin: 0 0 8px 0;
            font-size: 14px;
            line-height: 1.5;
        }
        
        .info-content p:last-child {
            margin-bottom: 0;
        }
        
        .info-content strong {
            color: #495057;
        }
        
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
            font-size: 13px;
        }
        
        .wallet-actions {
            display: flex;
            gap: 6px;
        }
        
        .wallet-actions .btn {
            padding: 3px 8px;
            font-size: 12px;
        }
        
        .wallet-search-box {
            padding: 8px 12px;
            border-bottom: 1px solid #e9ecef;
            position: relative;
        }
        
        .wallet-search-box input {
            width: 100%;
            padding: 5px 8px;
            padding-right: 28px;
            font-size: 12px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
        }
        
        .wallet-search-box i {
            position: absolute;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            color: #999;
            font-size: 12px;
        }
        
        .wallet-list {
            max-height: 250px;
            overflow-y: auto;
        }
        
        /* 钱包分组样式 */
        .wallet-group {
            border-bottom: 1px solid #f0f0f0;
        }
        
        .wallet-group:last-child {
            border-bottom: none;
        }
        
        .wallet-group-header {
            display: flex;
            align-items: center;
            padding: 6px 12px;
            background: #fafafa;
            cursor: pointer;
            font-size: 13px;
            user-select: none;
        }
        
        .wallet-group-header:hover {
            background: #f5f5f5;
        }
        
        .group-toggle {
            margin-right: 6px;
            color: #666;
            font-size: 10px;
            transition: transform 0.2s;
        }
        
        .group-toggle.collapsed {
            transform: rotate(-90deg);
        }
        
        .group-checkbox {
            margin-right: 8px;
        }
        
        .group-name {
            flex: 1;
            font-weight: 500;
            color: #333;
        }
        
        .group-count {
            font-size: 12px;
            color: #666;
        }
        
        .wallet-group-content {
            display: block;
        }
        
        .wallet-group-content.collapsed {
            display: none;
        }
        
        .wallet-item {
            display: flex;
            align-items: center;
            padding: 6px 12px 6px 32px;
            font-size: 12px;
            transition: background 0.2s;
        }
        
        .wallet-item:hover {
            background: #f8f9fa;
        }
        
        .wallet-item input[type="checkbox"] {
            margin-right: 8px;
        }
        
        .wallet-item label {
            flex: 1;
            cursor: pointer;
            display: flex;
            align-items: center;
            margin: 0;
        }
        
        .wallet-address {
            font-family: monospace;
            font-size: 11px;
            color: #666;
            margin-left: 8px;
        }
        
        /* 代理配置样式优化 */
        .proxy-section {
            margin-top: 20px;
        }
        
        .proxy-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
        }
        
        .proxy-header label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            cursor: pointer;
        }
        
        .proxy-config-content {
            padding: 16px;
            background: #f8f9fa;
            border-radius: 6px;
        }
        
        .proxy-strategy {
            margin-bottom: 16px;
        }
        
        .proxy-strategy label {
            font-size: 13px;
            color: #666;
            margin-bottom: 6px;
            display: block;
        }
        
        .proxy-strategy select {
            padding: 6px 10px;
            font-size: 13px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            background: #fff;
        }
        
        .proxy-list-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        
        .proxy-list-title {
            font-size: 13px;
            color: #666;
        }
        
        .refresh-proxy-btn {
            padding: 4px 10px;
            font-size: 12px;
            background: transparent;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .refresh-proxy-btn:hover {
            border-color: #6c5ce7;
            color: #6c5ce7;
        }
        
        /* 代理列表样式 */
        .proxy-list-container {
            border: 1px solid #e9ecef;
            border-radius: 6px;
            background: #fff;
            max-height: 200px;
            overflow-y: auto;
        }
        
        .proxy-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 16px;
            border-bottom: 1px solid #f0f0f0;
            font-size: 13px;
            transition: background 0.2s;
        }
        
        .proxy-item:last-child {
            border-bottom: none;
        }
        
        .proxy-item:hover {
            background: #f8f9fa;
        }
        
        .proxy-item input[type="checkbox"] {
            margin-right: 10px;
        }
        
        .proxy-item label {
            flex: 1;
            display: flex;
            align-items: center;
            cursor: pointer;
        }
        
        .proxy-info {
            flex: 1;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .proxy-address {
            color: #1a1a1a;
            font-family: monospace;
        }
        
        .proxy-location {
            color: #666;
            font-size: 12px;
        }
        
        .proxy-strategy-details {
            margin-top: 12px;
            padding: 12px;
            background: #e9ecef;
            border-radius: 4px;
            font-size: 13px;
            color: #666;
        }
        
        /* 按钮样式 */
        .batch-task-container .btn.btn-primary,
        .background-tasks-panel .btn.btn-primary {
            background: #6c5ce7;
            color: #fff;
            border: none;
            padding: 8px 20px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .batch-task-container .btn.btn-primary:hover:not(:disabled),
        .background-tasks-panel .btn.btn-primary:hover:not(:disabled) {
            background: #5a4cdb;
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(108, 92, 231, 0.3);
        }
        
        .batch-task-container .btn.btn-primary:disabled,
        .background-tasks-panel .btn.btn-primary:disabled {
            background: #e9ecef;
            color: #adb5bd;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .batch-task-container .btn.btn-secondary,
        .background-tasks-panel .btn.btn-secondary {
            background: transparent;
            color: #666;
            border: 1px solid #dee2e6;
            padding: 8px 20px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .batch-task-container .btn.btn-secondary:hover,
        .background-tasks-panel .btn.btn-secondary:hover {
            border-color: #6c5ce7;
            color: #6c5ce7;
        }
        
        .batch-task-container .btn.btn-danger,
        .background-tasks-panel .btn.btn-danger {
            background: #dc3545;
            color: #fff;
            border: none;
            padding: 8px 20px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .batch-task-container .btn.btn-danger:hover,
        .background-tasks-panel .btn.btn-danger:hover {
            background: #c82333;
        }
        
        .btn-sm {
            padding: 4px 10px;
            font-size: 12px;
        }
        
        /* 后台任务相关样式 */
        .has-background-tasks {
            background: #27ae60 !important;
            color: #fff !important;
            border-color: #27ae60 !important;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
        
        .background-tasks-panel {
            position: fixed;
            top: 80px;
            right: 20px;
            width: 400px;
            max-height: 500px;
            background: #fff;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 1000;
            overflow: hidden;
        }
        
        .background-tasks-panel .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
        }
        
        .background-tasks-panel .panel-header h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 500;
            color: #1a1a1a;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .background-tasks-panel .close-btn {
            width: 28px;
            height: 28px;
            border: none;
            background: transparent;
            border-radius: 4px;
            cursor: pointer;
            color: #666;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .background-tasks-panel .close-btn:hover {
            background: #e9ecef;
            color: #333;
        }
        
        .background-tasks-panel .panel-content {
            max-height: 400px;
            overflow-y: auto;
            padding: 12px;
        }
        
        .background-task-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            margin-bottom: 8px;
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            transition: all 0.2s;
        }
        
        .background-task-item:hover {
            border-color: #6c5ce7;
            background: #fff;
        }
        
        .background-task-item:last-child {
            margin-bottom: 0;
        }
        
        .task-info {
            flex: 1;
        }
        
        .task-name {
            font-size: 14px;
            font-weight: 500;
            color: #1a1a1a;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .task-details {
            font-size: 12px;
            color: #666;
            display: flex;
            gap: 12px;
        }
        
        .task-status.running {
            color: #27ae60;
            font-weight: 500;
        }
        
        .task-duration {
            color: #666;
        }
        
        .task-actions {
            display: flex;
            gap: 6px;
        }
        
        .action-btn {
            width: 32px;
            height: 32px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
        }
        
        .action-btn.resume-btn {
            background: #6c5ce7;
            color: #fff;
        }
        
        .action-btn.resume-btn:hover {
            background: #5a4cdb;
        }
        
        .action-btn.stop-btn {
            background: #dc3545;
            color: #fff;
        }
        
        .action-btn.stop-btn:hover {
            background: #c82333;
        }
        
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #666;
        }
        
        .empty-state i {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.3;
        }
        
        .empty-state p {
            margin: 0;
            font-size: 14px;
        }
        
        .text-success {
            color: #27ae60 !important;
        }
        

    `;
    document.head.appendChild(styleElement);
}

/**
 * 下载日志
 */
function downloadLogs() {
    const logContainer = document.getElementById('taskLogContainer');
    if (!logContainer) return;
    
    // 获取所有日志文本
    const logEntries = logContainer.querySelectorAll('.log-entry');
    let logText = '';
    
    logEntries.forEach(entry => {
        const time = entry.querySelector('.log-time')?.textContent || '';
        const message = entry.querySelector('.log-message')?.textContent || '';
        logText += `${time} ${message}\n`;
    });
    
    // 创建Blob并下载
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    const now = new Date();
    const timestamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}${now.getSeconds().toString().padStart(2,'0')}`;
    
    a.href = url;
    a.download = `batch_script_log_${timestamp}.txt`;
    a.click();
    
    URL.revokeObjectURL(url);
}

/**
 * 将当前任务移至后台运行
 * @param {string} taskInstanceId - 任务实例ID
 */
function moveTaskToBackground(taskInstanceId) {
    const currentExecutionId = window.__currentExecutionId;
    const hasExecutionTimer = !!window.__executionTimer;
    
    console.log('[后台任务] 尝试移至后台:', { 
        taskInstanceId, 
        currentExecutionId, 
        hasExecutionTimer,
        startTime: window.__startTime 
    });
    
    // 如果没有执行ID但有计时器和任务ID，说明任务可能在运行
    if (!currentExecutionId && !hasExecutionTimer) {
        console.warn('[后台任务] 没有执行ID且没有计时器，任务可能已完成');
        return;
    }
    
    // 如果没有执行ID但有计时器，生成一个临时执行ID
    let executionId = currentExecutionId;
    if (!executionId && hasExecutionTimer) {
        executionId = 'restored_exec_' + Date.now();
        window.__currentExecutionId = executionId;
        console.log('[后台任务] 生成临时执行ID:', executionId);
    }
    
    // 收集当前日志历史 - 优化版本
    const logContainer = document.getElementById('taskLogContainer');
    let logHistory = [];
    if (logContainer) {
        const logEntries = logContainer.querySelectorAll('.log-entry');
        logEntries.forEach((entry, index) => {
            try {
                const timeElement = entry.querySelector('.log-time');
                const messageElement = entry.querySelector('.log-message');
                
                if (timeElement && messageElement) {
                    // 从class中提取日志类型
                    const classList = Array.from(entry.classList);
                    const logTypeClass = classList.find(cls => cls.startsWith('log-type-'));
                    const logType = logTypeClass ? logTypeClass.replace('log-type-', '') : 'info';
                    
                    // 保存完整的日志条目信息
                    const logData = {
                        type: logType,
                        time: timeElement.textContent,
                        message: messageElement.textContent,
                        html: entry.outerHTML,
                        timestamp: Date.now(),
                        index: index,
                        // 提取日志内容用于搜索和过滤
                        content: entry.textContent || ''
                    };
                    logHistory.push(logData);
                }
            } catch (error) {
                console.warn('[后台任务] 保存日志条目失败:', error);
            }
        });
        console.log('[后台任务] 保存了', logHistory.length, '条日志记录');
    }
    
    // 保存当前任务的运行状态 - 增强版本
    const backgroundTask = {
        taskInstanceId,
        executionId: executionId,
        scriptType: pageState.currentBatchScriptType,
        logUnsubscribers: window.__currentLogUnsubscribers,
        logCleanup: window.__currentLogCleanup,
        timer: window.__executionTimer,
        startTime: window.__startTime || Date.now(),
        status: 'running',
        // 保存模拟任务函数引用（如果存在）
        mockTaskFunction: window[`__mockTask_${taskInstanceId}`] || null,
        // 保存日志历史 - 增强版本
        logHistory: logHistory,
        // 添加任务元数据
        metadata: {
            backgroundTime: Date.now(), // 移至后台的时间
            logCount: logHistory.length,
            scriptName: pageState.currentBatchScriptType?.name || '未知脚本',
            version: '2.0', // 标记为新版本的后台任务数据
            // 保存当前UI状态
            uiState: {
                currentView: pageState.currentView,
                taskConfig: window.batchTaskConfigs?.[taskInstanceId] || null
            }
        }
    };
    
    console.log('[后台任务] 保存的任务数据:', {
        ...backgroundTask,
        logHistory: `${backgroundTask.logHistory.length} 条日志`,
        logUnsubscribers: `${backgroundTask.logUnsubscribers?.length || 0} 个监听器`,
        metadata: backgroundTask.metadata
    });
    
    // 保存到后台任务列表
    backgroundTasks.set(taskInstanceId, backgroundTask);
    console.log('[后台任务] 保存成功，当前后台任务数量:', backgroundTasks.size);
    
    // 持久化到localStorage
    saveBackgroundTasksToStorage();
    
    // 更新后台任务指示器
    updateBackgroundTaskIndicator();
    
    // 清理前台引用，但后台任务仍持有这些资源的引用
    // 这样可以避免新任务覆盖正在运行的任务资源
    window.__currentExecutionId = null;
    window.__currentLogUnsubscribers = null;
    window.__currentLogCleanup = null;
    window.__executionTimer = null;
    window.__currentTaskInstanceId = null;
    // 不清理模拟任务函数，让它继续运行
    // window[`__mockTask_${taskInstanceId}`] = null;
    
    console.log(`[后台任务] 任务 ${taskInstanceId} 已移至后台运行`);
    
    // 显示通知
    if (window.showNotification) {
        window.showNotification('任务已移至后台运行', 'success');
    }
}

/**
 * 从后台恢复任务
 * @param {string} taskInstanceId - 任务实例ID
 */
function restoreTaskFromBackground(taskInstanceId) {
    const backgroundTask = backgroundTasks.get(taskInstanceId);
    if (!backgroundTask) return false;
    
    // 恢复全局状态
    window.__currentExecutionId = backgroundTask.executionId;
    window.__currentLogUnsubscribers = backgroundTask.logUnsubscribers;
    window.__currentLogCleanup = backgroundTask.logCleanup;
    window.__executionTimer = backgroundTask.timer;
    window.__startTime = backgroundTask.startTime;
    
    // 恢复模拟任务函数引用（如果存在）
    if (backgroundTask.mockTaskFunction) {
        window[`__mockTask_${taskInstanceId}`] = backgroundTask.mockTaskFunction;
    }
    
    // 设置当前脚本类型
    pageState.currentBatchScriptType = backgroundTask.scriptType;
    
    // 保存日志历史到全局变量，供后续使用
    window.__restoredLogHistory = backgroundTask.logHistory || [];
    
    // 从后台任务列表中移除
    backgroundTasks.delete(taskInstanceId);
    
    // 更新localStorage
    saveBackgroundTasksToStorage();
    
    updateBackgroundTaskIndicator();
    
    console.log(`[后台任务] 任务 ${taskInstanceId} 已从后台恢复`);
    return true;
}

/**
 * 获取所有后台任务
 * @returns {Array} 后台任务列表
 */
function getBackgroundTasks() {
    return Array.from(backgroundTasks.entries()).map(([taskId, task]) => ({
        taskId,
        scriptName: task.scriptType?.name || '未知脚本',
        status: task.status,
        startTime: task.startTime
    }));
}

/**
 * 停止后台任务
 * @param {string} taskInstanceId - 任务实例ID
 */
async function stopBackgroundTask(taskInstanceId) {
    const backgroundTask = backgroundTasks.get(taskInstanceId);
    if (!backgroundTask) return false;
    
    try {
        // 停止脚本执行
        if (backgroundTask.executionId) {
            if (window.scriptAPI && window.scriptAPI.stopScript && !backgroundTask.executionId.startsWith('mock_exec_')) {
                // 真实脚本执行
                await window.scriptAPI.stopScript(backgroundTask.executionId);
            } else if (backgroundTask.executionId.startsWith('mock_exec_')) {
                // 模拟执行 - 清理模拟任务函数
                console.log('[后台任务] 停止模拟执行:', backgroundTask.executionId);
                if (window[`__mockTask_${taskInstanceId}`]) {
                    delete window[`__mockTask_${taskInstanceId}`];
                }
            }
        }
        
        // 清理资源
        if (backgroundTask.timer) {
            clearInterval(backgroundTask.timer);
        }
        
        if (backgroundTask.logUnsubscribers) {
            backgroundTask.logUnsubscribers.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            });
        }
        
        if (backgroundTask.logCleanup && typeof backgroundTask.logCleanup === 'function') {
            backgroundTask.logCleanup();
        }
        
        // 从后台任务列表中移除
        backgroundTasks.delete(taskInstanceId);
        
        // 更新localStorage
        saveBackgroundTasksToStorage();
        
        updateBackgroundTaskIndicator();
        
        console.log(`[后台任务] 任务 ${taskInstanceId} 已停止`);
        return true;
    } catch (error) {
        console.error(`[后台任务] 停止任务 ${taskInstanceId} 失败:`, error);
        return false;
    }
}

/**
 * 更新后台任务指示器
 */
function updateBackgroundTaskIndicator() {
    console.log('[后台任务] 更新指示器，当前后台任务数量:', backgroundTasks.size);
    console.log('[后台任务] 后台任务列表:', Array.from(backgroundTasks.keys()));
    
    const backgroundTasksBtn = document.getElementById('background-tasks-btn');
    const backgroundTaskCount = document.getElementById('background-task-count');
    
    console.log('[后台任务] 按钮元素:', backgroundTasksBtn);
    console.log('[后台任务] 计数元素:', backgroundTaskCount);
    
    if (!backgroundTasksBtn || !backgroundTaskCount) {
        console.warn('[后台任务] 找不到后台任务按钮或计数元素');
        return;
    }
    
    const taskCount = backgroundTasks.size;
    
    // 调试模式：强制显示按钮和面板，方便测试
    if (DEBUG_BACKGROUND_TASKS) {
        console.log('[后台任务] DEBUG模式：强制显示后台任务按钮');
        backgroundTasksBtn.style.display = 'inline-flex';
        backgroundTaskCount.textContent = taskCount;
        
        if (taskCount > 0) {
            backgroundTasksBtn.classList.add('has-background-tasks');
            console.log(`[后台任务] 有 ${taskCount} 个后台任务，显示绿色指示器`);
        } else {
            backgroundTasksBtn.classList.remove('has-background-tasks');
            console.log('[后台任务] 无后台任务，显示普通按钮');
        }
        return;
    }
    
    if (taskCount > 0) {
        backgroundTasksBtn.style.display = 'inline-flex';
        backgroundTaskCount.textContent = taskCount;
        backgroundTasksBtn.classList.add('has-background-tasks');
        console.log(`[后台任务] 显示按钮，任务数量: ${taskCount}`);
    } else {
        backgroundTasksBtn.style.display = 'none';
        backgroundTasksBtn.classList.remove('has-background-tasks');
        console.log('[后台任务] 隐藏按钮，没有后台任务');
    }
}

/**
 * 切换后台任务面板显示
 * @param {boolean} show - 是否显示，不传则切换
 */
function toggleBackgroundTasksPanel(show) {
    const panel = document.getElementById('backgroundTasksPanel');
    if (!panel) return;
    
    const isVisible = panel.style.display !== 'none';
    const shouldShow = show !== undefined ? show : !isVisible;
    
    if (shouldShow) {
        panel.style.display = 'block';
        renderBackgroundTasksList();
    } else {
        panel.style.display = 'none';
    }
}

/**
 * 渲染后台任务列表
 */
function renderBackgroundTasksList() {
    const container = document.getElementById('backgroundTasksList');
    if (!container) return;
    
    const backgroundTasksList = getBackgroundTasks();
    
    if (backgroundTasksList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>当前没有后台运行的任务</p>
            </div>
        `;
        return;
    }
    
    const tasksHtml = backgroundTasksList.map(task => {
        const duration = formatDuration(Date.now() - task.startTime);
        return `
            <div class="background-task-item" data-task-id="${task.taskId}">
                <div class="task-info">
                    <div class="task-name">
                        <i class="fas fa-play-circle text-success"></i>
                        ${task.scriptName}
                    </div>
                    <div class="task-details">
                        <span class="task-status running">运行中</span>
                        <span class="task-duration">运行时长: ${duration}</span>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="action-btn resume-btn" onclick="resumeBackgroundTask('${task.taskId}')" title="查看任务">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn stop-btn" onclick="stopBackgroundTaskFromPanel('${task.taskId}')" title="停止任务">
                        <i class="fas fa-stop"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = tasksHtml;
}

/**
 * 格式化持续时间
 * @param {number} ms - 毫秒数
 * @returns {string} 格式化的时间字符串
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}小时${minutes % 60}分钟`;
    } else if (minutes > 0) {
        return `${minutes}分钟${seconds % 60}秒`;
    } else {
        return `${seconds}秒`;
    }
}

/**
 * 从面板恢复后台任务
 * @param {string} taskInstanceId - 任务实例ID
 */
async function resumeBackgroundTask(taskInstanceId) {
    // 获取后台任务数据
    const backgroundTask = backgroundTasks.get(taskInstanceId);
    if (!backgroundTask) {
        console.error(`[任务恢复] 未找到后台任务: ${taskInstanceId}`);
        return;
    }

    // 隐藏后台任务面板
    toggleBackgroundTasksPanel(false);

    // 设置当前脚本类型（确保页面状态正确）
    pageState.currentBatchScriptType = backgroundTask.scriptType;

    // 使用新的任务恢复管理器
    const { taskRestoreManager } = await import('./taskRestoreManager.js');
    
    try {
        // 执行任务恢复
        const success = await taskRestoreManager.restoreTask(taskInstanceId, backgroundTask);
        
        if (success) {
            // 恢复成功后，不要立即删除后台任务
            // 任务应该继续在前台运行，只有在任务完成或被停止时才删除
            console.log(`[任务恢复] 任务 ${taskInstanceId} 恢复成功，任务继续在前台运行`);
            
            // 确保执行ID正确设置（从后台任务数据中恢复）
            if (backgroundTask.executionId && !window.__currentExecutionId) {
                window.__currentExecutionId = backgroundTask.executionId;
                console.log(`[任务恢复] 恢复执行ID: ${backgroundTask.executionId}`);
            }
            
            // 从后台任务列表中移除（因为现在在前台运行）
            backgroundTasks.delete(taskInstanceId);
            saveBackgroundTasksToStorage();
            updateBackgroundTaskIndicator();
            
            // 确保UI正确显示执行状态
            setTimeout(() => {
                // 更新状态显示
                const statusText = document.getElementById('statusText');
                if (statusText) {
                    statusText.textContent = '执行中';
                    statusText.style.color = '#f39c12';
                }
                
                // 显示计时器
                const timerElement = document.getElementById('timer');
                if (timerElement) {
                    timerElement.style.display = 'inline';
                }
                
                // 显示停止按钮
                const stopBtn = document.getElementById('stop-btn');
                if (stopBtn) {
                    stopBtn.style.display = 'inline-flex';
                }
                
                // 确保日志容器可见并滚动到底部
                const logContainer = document.getElementById('taskLogContainer');
                if (logContainer) {
                    logContainer.scrollTop = logContainer.scrollHeight;
                }
            }, 500);
            
        } else {
            console.error(`[任务恢复] 任务 ${taskInstanceId} 恢复失败`);
        }
    } catch (error) {
        console.error(`[任务恢复] 恢复任务时发生错误:`, error);
    }
}

/**
 * 从面板停止后台任务
 * @param {string} taskInstanceId - 任务实例ID
 */
async function stopBackgroundTaskFromPanel(taskInstanceId) {
    if (confirm('确定要停止这个后台任务吗？')) {
        const success = await stopBackgroundTask(taskInstanceId);
        if (success) {
            // 重新渲染后台任务列表
            renderBackgroundTasksList();
            updateBackgroundTaskIndicator();
        }
    }
}

// 将函数绑定到全局作用域，供HTML使用
window.resumeBackgroundTask = resumeBackgroundTask;
window.stopBackgroundTaskFromPanel = stopBackgroundTaskFromPanel;
window.navigateToModularTaskManager = navigateToModularTaskManager;

/**
 * 测试函数：创建模拟后台任务（仅用于调试）
 */
function createTestBackgroundTask() {
    const testTaskId = 'test_task_' + Date.now();
    const testTask = {
        taskInstanceId: testTaskId,
        executionId: 'test_exec_' + Date.now(),
        scriptType: { name: '测试脚本', id: 'test_script' },
        logUnsubscribers: [],
        logCleanup: null,
        timer: null,
        startTime: Date.now() - 60000, // 假设已运行1分钟
        status: 'running'
    };
    
    backgroundTasks.set(testTaskId, testTask);
    saveBackgroundTasksToStorage();
    updateBackgroundTaskIndicator();
    console.log('[测试] 已创建测试后台任务:', testTaskId);
    console.log('[测试] 当前后台任务总数:', backgroundTasks.size);
    return testTaskId;
}

/**
 * 调试函数：显示后台任务状态
 */
function debugBackgroundTasks() {
    console.log('=== 后台任务调试信息 ===');
    console.log('内存中的任务数量:', backgroundTasks.size);
    console.log('内存中的任务:', Array.from(backgroundTasks.entries()));
    
    const stored = localStorage.getItem(BACKGROUND_TASKS_STORAGE_KEY);
    if (stored) {
        const parsedStored = JSON.parse(stored);
        console.log('localStorage中的任务数量:', parsedStored.length);
        console.log('localStorage中的任务:', parsedStored);
    } else {
        console.log('localStorage中没有后台任务');
    }
    
    const btnElement = document.getElementById('background-tasks-btn');
    const countElement = document.getElementById('background-task-count');
    console.log('后台任务按钮元素:', btnElement);
    console.log('计数元素:', countElement);
    console.log('按钮显示状态:', btnElement?.style.display);
    console.log('按钮类名:', btnElement?.className);
    console.log('调试模式状态:', DEBUG_BACKGROUND_TASKS);
    
    console.log('全局管理器:', window.FABackgroundTaskManager);
    console.log('========================');
}

/**
 * 测试函数：清理所有测试任务
 */
function clearAllTestTasks() {
    const testTaskIds = [];
    for (const [taskId, task] of backgroundTasks.entries()) {
        if (taskId.startsWith('test_task_')) {
            testTaskIds.push(taskId);
        }
    }
    
    console.log('[测试] 准备清理测试任务，找到:', testTaskIds.length, '个');
    console.log('[测试] 清理前后台任务总数:', backgroundTasks.size);
    
    testTaskIds.forEach(taskId => {
        backgroundTasks.delete(taskId);
    });
    
    saveBackgroundTasksToStorage();
    updateBackgroundTaskIndicator();
    console.log('[测试] 已清理', testTaskIds.length, '个测试任务');
    console.log('[测试] 清理后后台任务总数:', backgroundTasks.size);
}

/**
 * 强制刷新后台任务指示器
 */
function forceUpdateIndicator() {
    console.log('[调试] 强制刷新后台任务指示器');
    updateBackgroundTaskIndicator();
    
    // 也更新面板内容
    const panel = document.getElementById('backgroundTasksPanel');
    if (panel && panel.style.display !== 'none') {
        renderBackgroundTasksList();
    }
}

/**
 * 清理所有僵尸任务
 * 用于手动清理localStorage中的无效后台任务
 */
function clearZombieTasks() {
    console.log('[后台任务] 开始清理僵尸任务...');
    
    const stored = localStorage.getItem(BACKGROUND_TASKS_STORAGE_KEY);
    if (stored) {
        try {
            const tasksArray = JSON.parse(stored);
            console.log(`[后台任务] 发现 ${tasksArray.length} 个可能的僵尸任务`);
            
            if (tasksArray.length > 0) {
                console.log('[后台任务] 清理的任务列表:');
                tasksArray.forEach(task => {
                    console.log(`  - ${task.scriptType?.name || '未知脚本'} (${task.taskId})`);
                });
                
                // 清理localStorage
                localStorage.removeItem(BACKGROUND_TASKS_STORAGE_KEY);
                
                // 清理内存中的任务
                backgroundTasks.clear();
                
                // 更新UI
                updateBackgroundTaskIndicator();
                
                console.log('[后台任务] ✅ 僵尸任务清理完成');
            } else {
                console.log('[后台任务] 没有发现僵尸任务');
            }
        } catch (error) {
            console.error('[后台任务] 清理僵尸任务时出错:', error);
            // 如果解析失败，直接清理
            localStorage.removeItem(BACKGROUND_TASKS_STORAGE_KEY);
            backgroundTasks.clear();
            updateBackgroundTaskIndicator();
        }
    } else {
        console.log('[后台任务] localStorage中没有后台任务数据');
    }
}

/**
 * 强制清理当前的僵尸任务（立即生效）
 * 用于在应用运行时立即清理不应该存在的后台任务
 */
function forceCleanZombies() {
    console.log('\n🧹 强制清理僵尸任务...');
    
    const beforeCount = backgroundTasks.size;
    const stored = localStorage.getItem(BACKGROUND_TASKS_STORAGE_KEY);
    
    console.log('清理前状态:');
    console.log(`  - 内存中的任务: ${beforeCount} 个`);
    console.log(`  - localStorage: ${stored ? '有数据' : '无数据'}`);
    
    if (stored) {
        try {
            const tasksArray = JSON.parse(stored);
            console.log(`  - localStorage中的任务: ${tasksArray.length} 个`);
            
            if (tasksArray.length > 0) {
                console.log('\n清理的任务:');
                tasksArray.forEach((task, index) => {
                    console.log(`  ${index + 1}. ${task.scriptType?.name || '未知脚本'} (${task.taskId})`);
                });
            }
        } catch (error) {
            console.log('  - localStorage数据解析失败');
        }
    }
    
    // 强制清理所有
    localStorage.removeItem(BACKGROUND_TASKS_STORAGE_KEY);
    backgroundTasks.clear();
    
    // 重置会话标志，确保下次启动时不会再恢复
    sessionStorage.setItem('fa_app_session_active', 'true');
    
    // 更新UI
    updateBackgroundTaskIndicator();
    
    console.log('\n✅ 强制清理完成！');
    console.log('清理后状态:');
    console.log(`  - 内存中的任务: ${backgroundTasks.size} 个`);
    console.log(`  - localStorage: ${localStorage.getItem(BACKGROUND_TASKS_STORAGE_KEY) ? '有数据' : '无数据'}`);
    console.log(`  - 会话标志: ${sessionStorage.getItem('fa_app_session_active') ? '已设置' : '未设置'}`);
    
    // 检查UI状态
    const btn = document.getElementById('background-tasks-btn');
    if (btn) {
        console.log(`  - 后台任务按钮: ${btn.style.display === 'none' ? '已隐藏' : '显示中'}`);
    }
    
    console.log('\n🎉 僵尸任务已彻底清理，页面状态已重置！');
}

/**
 * 初始化调试工具
 */
function initDebugTools() {
    // 将调试函数绑定到全局作用域
    window.debugBackgroundTasks = debugBackgroundTasks;
    window.createTestBackgroundTask = createTestBackgroundTask;
    window.clearAllTestTasks = clearAllTestTasks;
    window.forceUpdateIndicator = forceUpdateIndicator;
    window.testBackgroundTaskFlow = testBackgroundTaskFlow;
    window.clearZombieTasks = clearZombieTasks;
    window.forceCleanZombies = forceCleanZombies;
    
    // 异步加载调试工具
    import('./taskRestoreDebug.js').then(() => {
        console.log('[调试工具] 任务恢复调试工具已加载');
    }).catch(error => {
        console.warn('[调试工具] 加载调试工具失败:', error);
    });
    
    console.log('[调试工具] 已初始化，可用函数:');
    console.log('  - debugBackgroundTasks() : 显示调试信息');
    console.log('  - createTestBackgroundTask() : 创建测试任务');
    console.log('  - clearAllTestTasks() : 清理测试任务');
    console.log('  - forceUpdateIndicator() : 强制刷新指示器');
    console.log('  - testBackgroundTaskFlow() : 完整流程测试');
    console.log('  - clearZombieTasks() : 清理僵尸任务');
    console.log('  - forceCleanZombies() : 强制清理当前僵尸任务');
    console.log('  - debugTaskRestore() : 检查任务恢复状态');
    console.log('  - quickFixTaskRestore() : 快速修复恢复问题');
    console.log('  - forceRestoreTaskUI() : 强制恢复任务UI');
    console.log('  - checkLogContainer() : 检查日志容器状态');

    // 检查是否有僵尸任务需要立即清理
    const stored = localStorage.getItem(BACKGROUND_TASKS_STORAGE_KEY);
    if (stored) {
        try {
            const tasksArray = JSON.parse(stored);
            if (tasksArray.length > 0) {
                console.log('\n⚠️ 检测到可能的僵尸任务！');
                console.log(`发现 ${tasksArray.length} 个后台任务，但应用刚启动`);
                console.log('如果这些任务不应该存在，请运行: forceCleanZombies()');
                tasksArray.forEach((task, index) => {
                    console.log(`  ${index + 1}. ${task.scriptType?.name || '未知脚本'} (${task.taskId})`);
                });
            }
        } catch (error) {
            console.warn('检查僵尸任务时出错:', error);
        }
    }
    
    // 自动运行一次完整测试（仅在调试模式下）
    if (DEBUG_BACKGROUND_TASKS) {
        setTimeout(() => {
            console.log('\n🚀 自动运行后台任务系统测试...');
            testBackgroundTaskFlow();
        }, 2000);
    }
}

/**
 * 完整的后台任务流程测试
 */
function testBackgroundTaskFlow() {
    console.log('\n=== 🧪 后台任务完整流程测试 ===');
    
    // 1. 清理现有测试任务
    console.log('1️⃣ 清理现有测试任务...');
    clearAllTestTasks();
    
    // 2. 创建测试任务
    console.log('2️⃣ 创建测试后台任务...');
    const testTaskId = createTestBackgroundTask();
    
    // 3. 检查指示器状态
    setTimeout(() => {
        console.log('3️⃣ 检查指示器状态...');
        debugBackgroundTasks();
        
        // 4. 测试面板功能
        console.log('4️⃣ 测试后台任务面板...');
        const panelTestResult = testBackgroundTasksPanel();
        
        // 5. 显示测试结果
        setTimeout(() => {
            console.log('5️⃣ 测试结果总结:');
            const btnElement = document.getElementById('background-tasks-btn');
            console.log('✅ 测试完成！结果：');
            console.log('  📊 后台任务数量:', backgroundTasks.size);
            console.log('  🔘 脚本插件页面按钮:', btnElement ? '✅ 存在' : '❌ 缺失');
            console.log('  🔘 按钮显示状态:', btnElement?.style.display);
            console.log('  💾 localStorage数据:', localStorage.getItem(BACKGROUND_TASKS_STORAGE_KEY) ? '✅ 已保存' : '❌ 未保存');
            
            if (btnElement && btnElement.style.display !== 'none') {
                console.log('🎉 后台任务系统工作正常！');
                console.log('📝 用户可以：');
                console.log('  - 点击绿色的"后台任务"按钮查看任务');
                console.log('  - 切换到其他页面时任务继续运行');
            } else {
                console.log('⚠️ 后台任务系统可能存在问题');
                console.log('🔧 尝试运行 forceUpdateIndicator() 强制刷新');
            }
        }, 1000);
    }, 500);
}

/**
 * 测试后台任务面板功能
 */
function testBackgroundTasksPanel() {
    console.log('📋 测试后台任务面板功能...');
    
    try {
        // 检查面板元素
        const panel = document.getElementById('backgroundTasksPanel');
        const btnElement = document.getElementById('background-tasks-btn');
        
        if (!panel) {
            console.log('❌ 后台任务面板不存在');
            return false;
        }
        
        if (!btnElement) {
            console.log('❌ 后台任务按钮不存在');
            return false;
        }
        
        // 模拟点击按钮打开面板
        console.log('🖱️ 模拟点击后台任务按钮...');
        btnElement.click();
        
        setTimeout(() => {
            const isVisible = panel.style.display !== 'none';
            console.log('👀 面板显示状态:', isVisible ? '✅ 可见' : '❌ 隐藏');
            
            if (isVisible) {
                console.log('✅ 后台任务面板功能正常');
                // 自动关闭面板
                setTimeout(() => {
                    toggleBackgroundTasksPanel(false);
                }, 2000);
            }
        }, 100);
        
        return true;
    } catch (error) {
        console.log('❌ 面板测试失败:', error);
        return false;
    }
}

/**
 * 页面卸载处理（供导航系统调用）
 * 在页面切换时自动保存运行中的任务到后台
 */
export function onBatchScriptsPageUnload() {
    console.log('脚本插件页面卸载，清理资源...');
    window.__isBatchScriptsPageActive = false;

    // 移除由 addCompactTaskStyles 添加的特定样式
    const compactTaskStyles = document.getElementById('compact-task-styles');
    if (compactTaskStyles) {
        compactTaskStyles.remove();
        console.log('[BatchScripts] Compact task styles (ID: compact-task-styles) removed.');
    }

    // 清理全局监听器
    if (globalLogUnsubscriber) {
        try {
            globalLogUnsubscriber();
            globalLogUnsubscriber = null;
            console.log('[脚本插件] 全局日志监听器已卸载');
        } catch (e) {
            console.warn('[脚本插件] 卸载全局日志监听器失败:', e);
        }
    }
    if (globalCompletedUnsubscriber) {
        try {
            globalCompletedUnsubscriber();
            globalCompletedUnsubscriber = null;
            console.log('[脚本插件] 全局完成监听器已卸载');
        } catch (e) {
            console.warn('[脚本插件] 卸载全局完成监听器失败:', e);
        }
    }

    // 其他清理逻辑...
    cleanupResources(); 
    pageState.currentBatchScriptType = null;
    pageState.currentView = VIEW_MODES.CARDS;

    // 清理可能存在的计时器
    if (window.__executionTimer) {
        clearInterval(window.__executionTimer);
        window.__executionTimer = null;
    }
    if (window.__currentLogCleanup) {
        try {
            window.__currentLogCleanup();
            window.__currentLogCleanup = null;
        } catch (e) {
            console.warn('卸载页面时清理日志渲染器失败:', e);
        }
    }
    
    // 保存后台任务（如果需要）
    // saveBackgroundTasksToStorage(); // 取决于是否希望在页面切换时也保存
}

// 模块级别变量
let globalLogUnsubscriber = null;
let globalCompletedUnsubscriber = null;

function globalLogEventHandler(data) {
    if (!data) return;

    const activeTaskInstanceId = window.__currentTaskInstanceId;
    const activeExecutionId = window.__currentExecutionId;

    // 只在真正需要时修复中文乱码，避免破坏正常文本
    let originalMessage = data.message;
    let fixedMessage = originalMessage;
    
    // 只对包含特定中文乱码模式的消息进行修复
    if (typeof originalMessage === 'string' && /鑴氭湰|鎵ц|閰嶇疆|鍒濆鍖|姝ｅ湪|瀹屾垚|閽卞寘|鑾峰彇|鎴愬姛|澶辫触/.test(originalMessage)) {
        if (typeof window.__fixChineseText === 'function') {
            fixedMessage = window.__fixChineseText(originalMessage);
        }
    }

    // 日志是否属于当前在前台活动并显示UI的任务？
    if (data.executionId && activeExecutionId && data.executionId === activeExecutionId && 
        document.getElementById('taskLogContainer') && pageState.currentView === VIEW_MODES.MANAGER) {
        try {
            const message = typeof fixedMessage === 'string' ? fixedMessage : JSON.stringify(fixedMessage);
            const level = data.level?.toLowerCase() || 'info';
            switch (level) {
                case 'success': TaskLogger.logSuccess(message); break;
                case 'warning': case 'warn': TaskLogger.logWarning(message); break;
                case 'error': TaskLogger.logError(message); break;
                default: TaskLogger.logInfo(message);
            }
        } catch (e) {
            console.error('[脚本插件日志] 处理前台日志失败:', e);
        }
    } else if (data.executionId) {
        // 日志属于其他执行ID，检查是否是后台任务
        const task = Array.from(backgroundTasks.values()).find(t => t.executionId === data.executionId);
        if (task) {
            if (!task.logHistory) {
                task.logHistory = [];
            }
            task.logHistory.push({
                level: data.level || 'info',
                message: fixedMessage, // 使用修复后的消息
                originalMessage: originalMessage, // 保留原始消息用于调试
                timestamp: data.timestamp || new Date().toISOString(),
                executionId: data.executionId
            });
            if (task.logHistory.length > 200) {
                task.logHistory.shift();
            }
            // 仅在调试模式或特殊情况下打印后台日志，避免控制台输出过多
            // console.log(`[后台日志] 记录到任务 ${task.taskInstanceId} (ExecID: ${data.executionId}): ${String(fixedMessage).substring(0,50)}...`);
        } else {
             console.log(`[脚本插件] 收到孤立日志 (ExecID: ${data.executionId}), 忽略.`);
        }
    }
}

function globalScriptCompletedHandler(data) {
    if (!data || !data.executionId) return;

    console.log('[全局脚本完成事件]', data);

    const activeTaskInstanceId = window.__currentTaskInstanceId;
    const activeExecutionId = window.__currentExecutionId;
    const startButton = document.getElementById('start-execution-btn'); // 尝试获取开始按钮

    if (activeExecutionId && data.executionId === activeExecutionId && pageState.currentView === VIEW_MODES.MANAGER) {
        TaskLogger.logSuccess('✅ 脚本插件执行完成！');
        if (data.summary) {
            TaskLogger.logInfo(`📊 执行总结:`);
            TaskLogger.logInfo(`   - 总账户数: ${data.summary.totalAccounts || 0}`);
            TaskLogger.logInfo(`   - 成功: ${data.summary.successCount || 0}`);
            TaskLogger.logInfo(`   - 失败: ${data.summary.failedCount || 0}`);
            TaskLogger.logInfo(`   - 耗时: ${data.summary.duration || '未知'}`);
            const successCountEl = document.getElementById('successCount');
            if (successCountEl) successCountEl.textContent = data.summary.successCount || 0;
            const failCountEl = document.getElementById('failCount');
            if (failCountEl) failCountEl.textContent = data.summary.failedCount || 0;
        }

        if (window.__executionTimer) {
            clearInterval(window.__executionTimer);
            window.__executionTimer = null;
        }
        
        window.__currentExecutionId = null; // 清理当前执行ID
        // window.__currentTaskInstanceId 通常在返回卡片页时清理，或在任务完全结束时
        window.__startTime = null;

        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = '已完成';
            statusText.style.color = '#27ae60';
        }
        const stopBtn = document.getElementById('stop-btn');
        if (stopBtn) stopBtn.style.display = 'none';
        
        if (startButton) {
            startButton.disabled = false;
            startButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
        }
    }

    const taskToRemoveEntry = Array.from(backgroundTasks.entries()).find(([taskId, task]) => task.executionId === data.executionId);
    if (taskToRemoveEntry) {
        backgroundTasks.delete(taskToRemoveEntry[0]);
        saveBackgroundTasksToStorage();
        updateBackgroundTaskIndicator();
        console.log(`[后台任务] 任务 ${taskToRemoveEntry[0]} (ExecID: ${data.executionId}) 执行完成，已从后台列表移除`);
    }
    
    // 如果完成的脚本是当前UI正在显示的脚本，确保开始按钮被重置
    // (即使它不是后台任务，但在前台完成了)
    if (pageState.currentBatchScriptType && 
        batchTaskConfigs[window.__currentTaskInstanceId]?.scriptTypeId === pageState.currentBatchScriptType.id &&
        window.__currentTaskInstanceId?.includes(data.executionId) && // 这是一个不太可靠的检查，最好是直接比较 taskInstanceId
        startButton && pageState.currentView === VIEW_MODES.MANAGER) {
        
        // 再次检查 executionId，因为上面可能已置null
        if (window.__currentExecutionId_completed_check === data.executionId) { // 使用一个临时变量来避免覆盖
             if (startButton) {
                startButton.disabled = false;
                startButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
             }
             window.__currentExecutionId_completed_check = null; // 清理临时变量
        }
    }
    // 保存当前执行ID用于检查，以防它在回调中被修改
    window.__currentExecutionId_completed_check = activeExecutionId;
}