# FourAir社区撸毛工具箱 (Electron 桌面版)

这是一个专为Web3用户设计的空投任务管理和批量交互工具，以 Electron 桌面应用的形式提供，旨在帮助用户在本地安全、高效地参与各种空投活动和链上交互。

## 功能特点 (开发中)

*   **仪表盘**: 概览核心数据、主要网络 Gas 等 (开发中)。
*   **撸毛商店 (Airdrop Shop)**: (开发中) 提供购买常用撸毛资源（如社交媒体账号四件套、代理IP等）的第三方渠道信息聚合与导航，**非直接交易平台**，包含必要的风险提示。
*   **钱包管理 (功能已完善)**:
    *   使用本地 SQLite 数据库统一管理钱包（地址、私钥、助记词、备注、分组）。
    *   **数据加密**: 钱包的私钥和助记词在存入数据库前，会使用基于用户主密码派生的密钥进行 AES-GCM 加密存储。
    *   **按需解密**: 点击"查看详情"或执行导出操作时，应用会安全地解密并显示/使用私钥/助记词。
    *   **基础操作**: 支持添加、编辑（仅备注和分组）、删除钱包。
    *   **分组管理**: 支持创建、重命名、删除钱包分组。
    *   **批量操作**: 支持批量生成钱包、批量删除钱包（带确认提示）。
    *   **导入/导出**: 支持从 JSON 文件导入钱包数据（导入时自动加密）；支持将选中钱包导出为 JSON 文件（提供明文导出的安全确认）。
    *   **查看详情**: 可在模态框中查看钱包的完整地址、解密后的私钥和助记词（如果已存储），并提供复制按钮。
    *   **余额查询**: 表格中显示钱包的 ETH 余额（通过 JSON-RPC 查询，带缓存机制）。
    *   **钱包-社交账户关联 (功能完成)**: 
        *   支持将钱包与已添加的社交账户（如 Twitter, Discord, Email 等）进行关联。
        *   钱包列表新增"关联账户"列，用平台图标和数量徽章简洁展示关联状态。
        *   点击该列可直接打开管理模态框，提供标签页（所有、已关联）、搜索和分页（针对"所有"和"已关联"）功能，方便高效地管理钱包与社交账户的关联关系。
    *   **界面交互**:
        *   实现表格筛选（按分组）、搜索（地址/名称/备注/分组）、分页（可自定义每页条数）、行内点击选中、统一 Toast 提示等交互优化。
        *   **加密数据显示**: 表格中加密的私钥和助记词会以缩短形式显示。
        *   优化模态框样式（如钱包编辑、分组管理），统一输入框风格。
*   **社交账户管理 (基础功能已实现)**:
    *   使用本地 SQLite 数据库管理社交账户（平台、用户名、绑定邮箱/手机、备注、分组）。
    *   **基础操作**: 支持添加、编辑、删除社交账户。
    *   **界面交互**: 实现平台按钮筛选、分页（可自定义每页条数）、表头全选、行内点击选中、添加时自动选择默认分组。
        *   优化添加/编辑模态框的样式，修复分组选择布局问题。
    *   *(待实现)* 导入/导出、批量操作。
*   **项目跟踪**: 卡片式展示和管理空投项目 (开发中)。
*   **脚本插件**: 执行批量或自动化操作 (开发中)。
*   **IP代理管理 (功能已完善)**:
    *   使用本地 SQLite 数据库管理代理配置（支持 HTTP、HTTPS、SOCKS5）。
    *   **基础操作**: 
        *   支持添加、编辑、删除、测试代理
        *   支持批量测试、批量删除
        *   支持导入/导出代理配置（可选是否包含密码信息）
    *   **代理测试**: 
        *   支持测试代理连通性
        *   获取出口 IP 信息（国家、地区、城市、ISP）
        *   获取延迟数据（ms）
        *   获取风险评分和风险等级
    *   **界面交互**: 
        *   实现类型筛选（HTTP/HTTPS/SOCKS5）
        *   状态筛选（可用/不可用/测试中等）
        *   搜索功能（支持搜索名称/主机/出口IP）
        *   分页功能（可自定义每页条数）
    *   **数据展示**:
        *   延迟显示不同颜色（优秀/良好/一般/较差）
        *   风险等级显示不同颜色（低/中/高风险）
        *   代理状态显示不同颜色（可用/不可用/测试中）
    *   **导入导出**:
        *   支持多种格式导入：
            - IP:端口
            - IP:端口:用户名:密码
            - 协议类型:IP:端口:用户名:密码
        *   导出支持选择性导出密码信息
        *   支持导出选中的代理或全部代理
    *   **全局应用**: 支持将代理应用到 Electron 应用全局。
*   **常用工具 (功能已完善)**:
    *   提供常用Web3工具和资源的快速访问入口
    *   **分类展示**:
        *   交易所: Binance, OKX (移除了 Gate.io, Bybit)
        *   钱包插件: MetaMask, OKX Wallet, Phantom
        *   数据分析 & 看板: Dune Analytics, DeFiLlama, Token Terminal
        *   跨链桥 (新增): Stargate Finance, Hop Protocol, Across Protocol, Synapse Protocol, LI.FI (移除了 Celer cBridge, Orbiter Finance)
        *   链上浏览器: Etherscan, BscScan, PolygonScan, Arbiscan, OptimismScan, Solscan
        *   安全授权 & 工具管理: Revoke.cash, DeBank, Chainlist
        *   (原 "安全 & 授权管理" 和 "实用工具" 已合并调整)
    *   **界面交互**:
        *   清晰分类展示不同工具类型 (原为三栏布局，根据内容调整)
        *   使用FontAwesome图标美化界面
        *   工具项支持外部链接，点击在系统默认浏览器中打开网站
        *   **IPC通信**: 使用Electron的shell.openExternal安全打开外部链接
        *   **（优化）** 链接处理方式已重构：使用 `data-url` 属性替代 JS `switch` 语句进行 URL 映射，提高了代码健壮性和可维护性。
        *   **（修复）** 修复了渲染进程与主进程之间 IPC 事件名称不匹配导致链接无法打开的问题（`open-external-url` vs `open-external-link`）。
*   **教程中心**: 提供Web3知识和教程 (开发中)。
*   **社区交流 (功能已完善)**:
    *   支持在应用内直接访问Discord社区，无需打开浏览器
    *   使用webview嵌入Discord，提供完整的聊天和交流功能
    *   智能会话管理：保存频道URL，后续访问时自动打开上次访问的频道位置
    *   提供退出账户功能，支持用户切换Discord账户或重新登录
    *   优化UI交互：自定义确认对话框，防止误操作
    *   精简Discord界面：移除滚动条，优化展示效果
*   **软件设置**: 配置应用参数 (开发中)。
*   **安全机制 (核心已实现)**:
    *   **主密码**: 应用首次启动时引导用户设置主密码。
    *   **密码验证与配置**: 加密验证字符串、盐值、迭代次数存储在 `encryption.config.json`。
    *   **加密核心**: 使用 PBKDF2 和 AES-GCM 对敏感数据进行加密。
    *   **应用解锁**: 启动时要求输入主密码以加载会话密钥（除非使用自动解锁）。
    *   **自动解锁**: 可选，通过操作系统凭据管理器（`keytar`）安全存储主密钥，实现自动登录。
    *   **手动锁定**: 提供接口 (`app:lock`) 清除内存和系统中的密钥，强制下次需要密码。(UI 按钮待添加)

## 技术栈

*   **框架**: Electron
*   **前端**: HTML5, CSS3, JavaScript (ES Modules)
*   **本地数据库**: SQLite (通过 `sqlite3` Node.js 模块)
*   **核心库**:
    *   Font Awesome (图标)
    *   `keytar` (操作系统凭据管理器访问)
    *   `ethers.js` (用于查询钱包余额)

## 项目结构

```
.                                   # 项目根目录
├── .gitignore                      # Git 忽略文件配置
├── README.md                       # 项目说明文档
├── database.db                     # SQLite 数据库文件（本地自动生成）
├── index.html                      # 主 HTML 骨架文件
├── main.js                         # Electron 主进程入口
├── package-lock.json               # npm 依赖锁定文件
├── package.json                    # 项目依赖与配置
├── src/                            # 源码目录
│   ├── css/                        # 样式文件目录
│   │   ├── main.css                # 主样式入口
│   │   ├── base/                   # 基础布局/重置/响应式样式
│   │   ├── components/             # 组件级样式（表单、模态框、按钮等）
│   │   └── pages/                  # 各页面专属样式
│   ├── js/                         # 前端 JS 逻辑
│   │   ├── core/                   # 应用核心逻辑（导航、入口、加密、认证等）
│   │   ├── components/             # 可复用UI组件逻辑
│   │   ├── db/                     # 数据库访问与CRUD（主进程用）
│   │   ├── pages/                  # 各页面业务逻辑
│   │   │   ├── dashboard/          # 仪表盘页面模块
│   │   │   │   ├── index.js        # 仪表盘页面入口
│   │   │   │   ├── actions.js      # (可选) 仪表盘操作逻辑
│   │   │   │   ├── modals.js       # (可选) 仪表盘模态框逻辑
│   │   │   │   └── table.js        # (可选) 仪表盘表格/列表逻辑
│   │   │   ├── wallets/            # 钱包管理页面模块
│   │   │   │   ├── index.js        # 钱包页面入口
│   │   │   │   ├── actions.js      # 钱包页面操作逻辑 (导入/导出/批量删除等)
│   │   │   │   ├── modals.js       # 钱包页面模态框逻辑 (编辑/分组/生成等)
│   │   │   │   └── table.js        # 钱包表格渲染/分页/筛选逻辑
│   │   │   ├── social/             # 社交账户页面模块
│   │   │   │   ├── index.js        # 社交页面入口
│   │   │   │   ├── actions.js      # 社交页面操作逻辑 (编辑/删除/批量)
│   │   │   │   ├── modals.js       # 社交页面模态框逻辑 (添加/编辑)
│   │   │   │   └── table.js        # 社交表格渲染/分页/筛选逻辑
│   │   │   ├── network/            # 网络工具页面模块 (结构同上)
│   │   │   ├── settings/           # 设置页面模块 (结构同上)
│   │   │   ├── tutorials/          # 教程页面模块 (结构同上)
│   │   │   ├── projects/           # 项目跟踪页面模块 (结构同上)
│   │   │   └── scriptPlugins/      # 脚本插件页面模块 (结构同上)
│   │   └── utils/                  # 通用工具函数
│   ├── main/                       # 主进程相关代码
│   │   └── ipcHandlers/            # 主进程IPC处理器
│   ├── templates/                  # HTML页面模板片段
│   └── preload.js                  # Electron Preload 脚本
```

## 模块化重构

为了提升代码的可维护性、可读性和团队协作效率，我们对项目中部分核心功能模块进行了细致的模块化重构。主要包括：

*   **网络（IP代理）管理模块 (`src/js/pages/network/`)**：
    *   该模块原先的逻辑较为集中，现已将其核心功能拆分为多个高内聚、低耦合的子模块，存放于 `src/js/pages/network/modules/` 目录下。
    *   **主要模块包括**：
        *   `dom.js`: 负责页面DOM元素的初始化、获取和基本操作。
        *   `events.js`: 统一处理页面内的所有事件监听和响应逻辑，如按钮点击、表单提交、筛选等。
        *   `state.js`: 管理该页面的全局状态，如加载状态、当前页码、筛选条件等。
        *   `table.js`: 负责代理列表的渲染、行更新以及全选框状态管理。
        *   `pagination.js`: 处理分页逻辑的渲染和事件。
        *   `import-export.js`: 封装代理数据的导入和导出功能。
        *   `modals.js`: 管理页面中使用的各种模态框（如添加/编辑代理、确认对话框）的显示和逻辑。
        *   `utils.js`: 提供该模块专属的工具函数。
    *   `src/js/pages/network/index.js` 作为该模块的主入口文件，负责初始化和协调各个子模块。
    *   **重构收益**：显著提高了IP代理管理功能代码的组织性和清晰度，使得未来新增功能或修改现有逻辑更为便捷和安全。

*   **脚本插件模块 (`src/js/pages/scriptPlugins/`)**：
    *   对脚本插件的相关功能，特别是插件详情和执行配置部分，也进行了模块化拆分。
    *   **主要拆分如下**：
        *   `detail/index.js`: 脚本插件详情页面的主入口和协调逻辑。
        *   `detail/events.js`: 处理插件详情页面的事件。
        *   `detail/proxy.js`: 管理与该插件相关的代理选择和配置逻辑。
        *   `detail/wallet-select.js`: 负责插件执行时钱包选择的交互和逻辑。
    *   `src/js/pages/scriptPlugins/index.js` 作为脚本插件列表页面的主入口。
    *   **重构收益**：使得脚本插件的配置和执行逻辑更加分离和专注，便于后续扩展更多插件类型和配置选项。

## 模块化页面结构

`src/js/pages/` 目录下的每个页面逻辑被拆分为独立的模块 (`index.js`, `actions.js`, `modals.js`, `table.js`)，以提高代码的可读性和可维护性。

## 如何运行 (开发模式)

1.  确保安装了 Node.js (自带 npm)。
2.  克隆或下载本仓库。
3.  进入项目根目录，运行 `npm install` 安装依赖。
4.  运行 `npm start` 或 `npm run dev` 启动应用。

## 注意事项

*   **安全提示**:
    *   请务必 **牢记并妥善保管您设置的主密码**。丢失主密码可能导致加密数据永久丢失。
    *   确保您的操作系统账户安全，特别是在启用自动解锁功能时。
*   目前主要完成了钱包管理的核心功能和安全机制，以及社交账户管理的基础功能。其他模块仍在开发中。

## 后续开发计划

* ✅ 项目排期：完善项目排期跟踪页面，优化任务管理
* ✅ 社区交流：Discord社区内嵌展示和交互优化
* ✅ 常用工具：实现常用Web3工具快速访问
* ⬜ 社交账号管理：完善账号关联和社交信息同步
* ⬜ 其他模块界面优化：优化设置界面、增加主题支持

## 贡献

欢迎通过 Issue 或 Pull Request 提供建议和改进。

## 免责声明

本工具仅供学习和研究使用，用户应自行承担使用过程中的风险。开发者不对因使用本工具导致的任何损失负责。

## 近期重要更新

*   **脚本插件支持代理连接 (2024-05-07)**
    *   修复了脚本执行时代理不生效的问题，更新脚本执行引擎从数据库获取实际代理配置
    *   优化代理使用逻辑，解决了HTTP代理与HTTPS请求的协议不匹配问题
    *   修改执行设置界面，用IP代理选择替代原有的任务间隔和Gas策略
    *   增强脚本错误处理能力，提供更详细的错误诊断信息
    *   添加代理连通性测试功能，确保代理可用后再执行请求

*   **脚本插件格式标准 (2024-05-07)**
    *   制定了统一的脚本格式标准，确保系统能正确识别和执行脚本
    *   **基本结构**：每个脚本必须是Node.js模块，通过`module.exports`导出
    *   **必需组件**：
        *   `metadata` 元数据对象：包含脚本ID、名称、描述、版本等信息
        *   `execute` 函数：脚本执行入口点，接收钱包列表、配置和工具
    *   **标准格式**:
    ```javascript
    module.exports = {
      metadata: {
        id: "script_id",              // 唯一标识符
        name: "脚本名称",              // 显示名称
        description: "脚本描述",        // 功能说明
        version: "1.0.0",             // 版本号
        author: "作者",                // 作者信息
        category: "分类",              // 脚本分类
        icon: "图标名称",              // FontAwesome图标
        imageUrl: "图片URL",           // 脚本图片（可选）
        requires: {                   // 脚本需要的资源
          wallets: true/false,        // 是否需要钱包
          proxy: true/false           // 是否需要代理
        },
        platforms: ["ETH", "其他支持的链"], // 支持的区块链平台
        config: {                     // 脚本配置选项
          // 自定义配置项
        }
      },
      
      async execute(wallets, config, utils) {
        const { logger, http, proxy } = utils;
        
        try {
          // 执行逻辑
          return { success: true, data: {} };
        } catch (error) {
          logger.error(`执行失败: ${error.message}`);
          return { success: false, error: error.message };
        }
      }
    };
    ```

*   **脚本插件钱包选择优化 (2024-06-02)**
    *   钱包选择列表从简单列表改进为按分组显示。
    *   初步实现分组内分页，后根据反馈调整为【分组选项卡 + 组内全量滚动】方案，简化交互逻辑。
    *   优化多选交互：
        *   "全选/取消全选"和"反选"按钮现在只操作当前激活分组内的所有钱包。
        *   全局Set (`window._selectedWalletIds`) 统一记录所有已选钱包ID，确保跨分组/翻页选择不丢失。
        *   "已选"数量统计始终显示全局已选总数。
        *   "全选"按钮文本根据当前激活分组的选中状态动态切换。
    *   修复UI Bug：解决了搜索图标不显示、双滚动条、全选按钮状态错误、已选数量统计错误等问题。
    *   界面调整：移除了钱包地址后默认显示的 `(Account-x)` 昵称后缀。
    *   搜索功能优化：搜索时禁用分组操作按钮（全选/反选），清除搜索后恢复。

*   **脚本插件模块架构更新 (2024-06-01)**
    *   实现了模块化脚本架构设计，采用清晰的目录结构组织本地脚本
    *   设计了统一的脚本格式，包含元数据和执行函数，方便管理和运行
    *   添加了验证码处理模块，支持多种验证码类型的检测和处理
    *   设计了通用工具库，提供Web3操作、HTTP请求、钱包交互等常用功能
    *   实现了脚本执行引擎，通过IPC通信在渲染进程和主进程间传递数据
    *   支持实时日志显示，用户可监控脚本执行状态和进度

*   **脚本插件模块优化 (2024-05-29)**
    *   重构了脚本执行界面，添加实时日志窗口功能
    *   优化了日志显示样式，采用类终端的暗色主题
    *   支持不同类型日志（info、success、error、warning）的彩色显示
    *   添加了请求执行功能，支持发送POST请求并实时显示请求过程
    *   优化了执行按钮状态和图标的动态变化
    *   集成 axios 用于发送 HTTP 请求
    *   日志窗口支持自动滚动到最新内容

*   **社区交流优化**
    *   保存Discord频道URL，自动重新打开上次访问的频道
    *   优化登出功能，支持完整的会话管理
    *   确认对话框位置优化，使用自定义确认对话框
    *   支持点击背景关闭对话框
    *   使用IPC处理Discord会话数据清理
    *   优化登出按钮外观和位置

*   **常用工具模块**
    *   新增常用工具模块，提供Web3相关工具快速访问
    *   实现响应式三栏布局，分类展示不同类型工具
    *   集成FontAwesome图标，美化界面
    *   使用Electron的shell.openExternal安全打开外部链接
    *   优化工具分类和排列，提升用户体验

*   **社交账户管理重构 (2024-05-22)**
    *   数据库表 `social_accounts` 结构更新，以支持存储平台特定的详细信息（如 Twitter 2FA、邮箱，Discord Token，Telegram API 信息等）。
    *   移除了原有的 `binding` 字段。
    *   账户的唯一标识符现在存储在 `identifier` 字段中（对应原 `username` 或 email）。
    *   添加/编辑模态框现在会根据所选平台动态显示相应的输入字段。
    *   **表格显示**:
        *   移除了"全部"平台视图，表格现在根据所选平台（Twitter, Discord, Telegram, Email）动态生成列。
        *   仅显示与当前选定平台相关的字段。
        *   **⚠️ 安全警告**: 表格中现在**直接显示解密后的明文**敏感信息（密码、Token、API 信息等）。长字符串会截断显示 (例如 `前8字符...后8字符`)。
        *   为成功解密的敏感字段提供了**复制按钮**。
        *   如果应用未解锁或解密失败，对应字段会显示错误提示 (`[应用未解锁]` 或 `[解密失败]`)。
        *   请用户**务必注意此功能带来的安全风险**，谨慎在不安全的环境下使用。
    *   **后端解密**: 在获取账户列表时 (`db:getSocialAccounts`)，后端会尝试解密敏感字段，并将结果（明文或错误标记）返回给前端。

*   **社交账户管理优化 (2024-05-28)**
    * **修复平台特定字段**: 解决了Discord密码和Email辅助邮箱字段无法正确显示和存储的问题。
    * **数据库结构增强**: 为社交账户表增加了`discord_password`字段，完善对Discord账户的支持。
    * **表单处理改进**: 优化了非敏感特殊字段(如Twitter绑定邮箱、Email辅助邮箱)的收集逻辑。
    * **数据收集逻辑**: 改进了表单提交处理，确保所有字段(包括非敏感字段)都能正确地传递到数据库。
    * **表格显示兼容性**: 增强了表格渲染逻辑，支持同时检查新旧字段名，确保历史数据和新数据都能正确显示。

## 教程中心

教程中心模块旨在为用户提供与Web3相关的知识和特定项目教程。

*   **内置教程列表**: 支持从本地 `src/data/tutorials.json` 或远程服务器API加载教程数据，按分类展示。
*   **远程API服务器**: 
    *   部署了Express服务器提供教程数据API
    *   支持添加、编辑、删除和查询教程数据
    *   通过RESTful API实现教程数据的CRUD操作
    *   支持按分类筛选、分页查询和搜索功能
*   **嵌入式内容浏览**: 利用 Electron 的 `<webview>` 标签在应用内直接展示教程内容（例如 Notion 页面）。
    *   解决了直接嵌入 Notion 等网站时可能出现的安全限制和内容显示问题。
    *   通过注入自定义 CSS 优化了嵌入页面的显示效果，确保内容能正常填充可用区域。
    *   **外部链接处理**: 实现了智能链接处理机制，使webview内点击的外部链接能自动在系统默认浏览器中打开。
    *   **预加载脚本**: 使用Electron的预加载脚本机制，在webview内部注入事件拦截代码，确保点击链接时的正确行为。
    *   **防重复处理**: 实现了防重复处理机制，避免同一链接短时间内被重复打开。
    *   **资源清理**: 优化了webview的创建和销毁流程，防止使用过程中出现资源泄漏和标签页累积问题。
*   **交互体验**: 支持分类切换、点击教程项在 WebView 中打开、关闭和刷新 WebView。

## 服务器部署

项目包含一个Express服务器，用于提供教程数据API和其他后端功能。

*   **服务器目录**: `server/` 包含Express服务器代码
*   **API端点**:
    *   `GET /api/tutorials`: 获取教程列表，支持分页和搜索
    *   `POST /api/tutorials`: 创建新教程
    *   `PUT /api/tutorials/:id`: 更新现有教程
    *   `DELETE /api/tutorials/:id`: 删除教程
*   **部署步骤**:
    *   服务器代码已部署到远程服务器
    *   使用PM2进行进程管理，确保服务持久运行
    *   配置防火墙开放必要端口
    *   客户端通过服务器IP+端口访问API服务

## 脚本插件架构

脚本插件模块采用模块化设计，提供统一的目录结构和API接口，方便扩展和维护。

### 目录结构

```
user_scripts/
├── common/                # 通用工具库
│   ├── utils.js           # 通用工具函数
│   ├── web3.js            # Web3相关功能
│   ├── http.js            # HTTP请求工具
│   ├── captcha/           # 验证码处理模块
│   │   ├── index.js       # 验证码处理入口
│   │   ├── solvers.js     # 验证码解决方案
│   │   ├── detection.js   # 验证码检测
│   │   └── interaction.js # 用户交互处理
│   └── logger.js          # 日志记录工具
├── wallets/               # 钱包相关功能
│   ├── address.js         # 地址操作工具
│   ├── signature.js       # 签名功能
│   └── transaction.js     # 交易操作
├── protocols/             # 协议交互模块
│   ├── uniswap.js         # Uniswap协议操作
│   ├── aave.js            # Aave协议操作
│   └── opensea.js         # OpenSea操作
└── scripts/               # 具体脚本实现
    ├── mint.js            # NFT铸造脚本
    ├── swap.js            # 代币交换脚本
    └── bridge.js          # 跨链桥接脚本
```

### 脚本格式

每个脚本都遵循统一的格式，包含元数据和执行函数：

```javascript
// scripts/example.js
module.exports = {
  // 脚本元数据
  metadata: {
    id: "example_script",             // 唯一标识符
    name: "示例脚本",                  // 显示名称
    description: "这是一个示例脚本",   // 描述
    version: "1.0.0",                 // 版本号
    author: "FourAir",                // 作者
    category: "测试",                  // 分类
    icon: "code",                     // 图标 (FontAwesome)
    requires: {
      wallets: true,                  // 是否需要钱包
      proxy: false                    // 是否需要代理
    },
    platforms: ["ETH", "Arbitrum"],   // 支持的平台
    config: {
      // 配置项定义，用于生成UI
      delay: {
        type: "number",
        label: "延迟(秒)",
        default: 5,
        min: 1,
        max: 60
      }
    }
  },
  
  // 执行函数
  async execute(wallets, config, utils) {
    const { logger, http, web3 } = utils;
    
    logger.info("开始执行示例脚本");
    
    try {
      // 脚本具体逻辑
      logger.info(`使用配置: ${JSON.stringify(config)}`);
      
      // 处理钱包
      if (wallets && wallets.length > 0) {
        logger.info(`选择了 ${wallets.length} 个钱包`);
        
        for (const wallet of wallets) {
          logger.info(`处理钱包: ${wallet.address}`);
          // 执行具体操作...
        }
      }
      
      // 模拟延迟
      logger.info(`等待 ${config.delay} 秒...`);
      await new Promise(resolve => setTimeout(resolve, config.delay * 1000));
      
      logger.success("脚本执行成功");
      return { success: true };
    } catch (error) {
      logger.error(`脚本执行失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
};
```

### 验证码处理模块

验证码处理模块支持多种类型的验证码检测和处理：

- **支持的验证码类型**:
  - reCAPTCHA
  - hCaptcha 
  - 图形验证码
  - 滑块验证码

- **功能特点**:
  - 自动检测页面中的验证码类型
  - 尝试自动解决验证码(可选集成第三方验证码服务)
  - 需要人工干预时提供用户交互界面
  - 验证码截图展示和结果反馈

- **使用方式**:
  ```javascript
  const { CaptchaHandler } = require('../common/captcha');
  
  // 创建验证码处理器
  const captchaHandler = new CaptchaHandler(logger);
  
  // 处理页面上的验证码
  const result = await captchaHandler.handleCaptcha(page, {
    autoSolve: true,        // 尝试自动解决
    allowUserInput: true    // 允许用户干预
  });
  
  if (result) {
    logger.success("验证码处理成功");
  } else {
    logger.error("验证码处理失败");
  }
  ```

### 脚本执行引擎

脚本执行引擎负责加载、管理和执行脚本：

```javascript
// main/scriptEngine.js
const fs = require('fs').promises;
const path = require('path');
const { ipcMain } = require('electron');

// 通用工具
const logger = require('../user_scripts/common/logger');
const http = require('../user_scripts/common/http');
const web3 = require('../user_scripts/common/web3');
const { CaptchaHandler } = require('../user_scripts/common/captcha');

class ScriptEngine {
  constructor() {
    this.scriptsDir = path.join(__dirname, '../user_scripts/scripts');
    this.scriptCache = new Map();
    
    // 注册IPC处理器
    this.registerIpcHandlers();
  }
  
  // 注册IPC处理器
  registerIpcHandlers() {
    ipcMain.handle('script:getAll', () => this.getAllScripts());
    ipcMain.handle('script:execute', (event, { scriptId, wallets, config }) => 
      this.executeScript(scriptId, wallets, config));
  }
  
  // 获取所有可用脚本
  async getAllScripts() {
    try {
      const files = await fs.readdir(this.scriptsDir);
      const scriptFiles = files.filter(file => file.endsWith('.js'));
      
      const scripts = [];
      for (const file of scriptFiles) {
        const script = await this.loadScript(file);
        if (script && script.metadata) {
          scripts.push(script.metadata);
        }
      }
      
      return { success: true, scripts };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  // 加载脚本
  async loadScript(filename) {
    const filePath = path.join(this.scriptsDir, filename);
    
    try {
      // 清除缓存以确保加载最新版本
      delete require.cache[require.resolve(filePath)];
      return require(filePath);
    } catch (error) {
      console.error(`加载脚本 ${filename} 失败:`, error);
      return null;
    }
  }
  
  // 执行脚本
  async executeScript(scriptId, wallets, config) {
    try {
      // 查找脚本
      const files = await fs.readdir(this.scriptsDir);
      const scriptFiles = files.filter(file => file.endsWith('.js'));
      
      let targetScript = null;
      let scriptModule = null;
      
      for (const file of scriptFiles) {
        const script = await this.loadScript(file);
        if (script && script.metadata && script.metadata.id === scriptId) {
          targetScript = script.metadata;
          scriptModule = script;
          break;
        }
      }
      
      if (!scriptModule || !targetScript) {
        return { success: false, error: `找不到脚本: ${scriptId}` };
      }
      
      // 准备工具库
      const utils = {
        logger: logger.createLogger(),
        http,
        web3,
        captcha: new CaptchaHandler(logger)
      };
      
      // 执行脚本
      return await scriptModule.execute(wallets, config, utils);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ScriptEngine();
```

### UI集成

脚本插件UI分为卡片视图和详情视图两部分:

1. **卡片视图**: 展示所有可用脚本，支持筛选和搜索
2. **详情视图**: 提供脚本配置、执行和日志查看功能

接口设计采用IPC通信，确保渲染进程和主进程之间的数据交换安全可靠。