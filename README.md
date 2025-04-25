# FourAir社区撸毛工具箱 (Electron 桌面版)

这是一个专为Web3用户设计的空投任务管理和批量交互工具，以 Electron 桌面应用的形式提供，旨在帮助用户在本地安全、高效地参与各种空投活动和链上交互。

## 功能特点 (开发中)

*   **仪表盘**：概览核心数据、主要网络 Gas 等。动态显示钱包和社交账户总数。
*   **钱包管理 (功能已完善)**：
    *   使用本地 SQLite 数据库统一管理钱包（地址、私钥、助记词、备注、分组）。
    *   **基础操作**: 支持添加、编辑（仅备注和分组）、删除钱包。
    *   **分组管理**: 支持创建、重命名、删除钱包分组。
    *   **批量操作**: 支持批量生成钱包、批量删除钱包（带确认提示）。
    *   **导入/导出**: 支持从 JSON 文件导入钱包数据；支持将选中钱包导出为 JSON 文件（包含私钥/助记词，有安全警告）。
    *   **查看详情**: 可在模态框中查看钱包的完整地址、私钥和助记词（如果已存储），并提供复制按钮。
    *   **界面交互**: 实现表格筛选（按分组）、搜索（地址/名称/备注/分组）、分页（可自定义每页条数）、行内点击选中、统一 Toast 提示等交互优化。
        *   优化模态框样式（如钱包编辑、分组管理），统一输入框风格。
*   **社交账户管理 (基础功能已实现)**：
    *   使用本地 SQLite 数据库管理社交账户（平台、用户名、绑定邮箱/手机、备注、分组）。
    *   **基础操作**: 支持添加、编辑、删除社交账户。
    *   **界面交互**: 实现平台按钮筛选、分页（可自定义每页条数）、表头全选、行内点击选中、添加时自动选择默认分组。
        *   优化添加/编辑模态框的样式，修复分组选择布局问题。
    *   *(待实现)* 导入/导出、批量操作。
*   **项目跟踪**：卡片式展示和管理不同链上的空投项目及相关活动。
*   **脚本插件**：通过可配置的插件执行批量或自动化操作（如跨链、Swap）。
*   **IP代理管理**：管理网络代理配置 (表格筛选功能初步实现)。
*   **教程中心**：提供Web3知识、安全防范和项目交互教程。
*   **社区交流**：提供社区入口（如 Discord、Telegram）。
*   **软件设置**：配置应用参数（增加了IP查询渠道设置项）。

## 代码重构

*   将所有数据库操作从渲染进程迁移到主进程，通过 IPC 进行通信，提升了应用的安全性和性能。
*   重构了数据库模块 (`src/main/db/index.js`) 和 IPC 处理逻辑 (`src/main/ipcHandlers/`)，使代码结构更清晰、更易于维护。
*   遵循 Electron 安全最佳实践，启用了 `contextIsolation` 并使用 `preload.js` 暴露安全的 API 给渲染进程。

## 技术栈

*   **框架**: Electron
*   **前端**: HTML5, CSS3, JavaScript (ES Modules)
*   **本地数据库**: SQLite (通过 `sqlite3` Node.js 模块)
*   **核心库**: Font Awesome (图标)
*   **(未来)** 区块链交互：可能使用 ethers.js / viem 等库

## 项目结构

```
FourAirTools/
├── .cursor/                # Cursor IDE 配置 (不重要)
├── .git/                   # Git 版本控制目录
├── .gitignore              # Git 忽略文件配置
├── node_modules/           # 项目依赖库 (自动生成)
├── src/
│   ├── css/                # CSS 样式
│   │   ├── base/
│   │   │   ├── layout.css
│   │   │   ├── reset.css
│   │   │   └── responsive.css
│   │   ├── components/
│   │   │   ├── buttons.css
│   │   │   ├── cards.css
│   │   │   ├── forms.css
│   │   │   ├── modals.css
│   │   │   ├── tables.css
│   │   │   └── tags.css
│   │   └── pages/
│   │       ├── dashboard.css
│   │       ├── plugins.css
│   │       ├── projects.css
│   │       ├── social.css
│   │       └── tutorials.css
│   ├── js/                 # JavaScript 模块 (渲染进程)
│   │   ├── components/
│   │   │   ├── custom-select.js
│   │   │   ├── modal.js
│   │   │   ├── tableHelper.js
│   │   │   └── toast.js
│   │   ├── core/
│   │   │   ├── app.js            # 渲染进程入口
│   │   │   ├── globalListeners.js # 全局事件监听
│   │   │   └── navigation.js     # 页面导航逻辑
│   │   ├── pages/
│   │   │   ├── community.js
│   │   │   ├── dashboard.js
│   │   │   ├── network.js
│   │   │   ├── projects.js
│   │   │   ├── scriptPlugins.js
│   │   │   ├── settings.js
│   │   │   ├── social.js
│   │   │   ├── tutorials.js
│   │   │   └── wallets.js
│   │   └── utils/
│   │       └── index.js        # 通用工具函数
│   ├── main/               # JavaScript 模块 (主进程)
│   │   ├── core/
│   │   │   └── walletGenerator.js # 钱包生成相关 (主进程侧)
│   │   ├── db/
│   │   │   └── index.js        # 数据库初始化、Schema 定义、CRUD 函数
│   │   └── ipcHandlers/        # 主进程 IPC 事件处理程序
│   │       ├── appHandlers.js
│   │       ├── dbHandlers.js
│   │       └── proxyHandlers.js
│   └── templates/          # HTML 页面模板片段
│       ├── community.html
│       ├── dashboard.html
│       ├── projects.html
│       ├── script-plugins.html
│       ├── settings.html
│       ├── social.html
│       ├── tool-network.html # 网络代理管理页面模板
│       ├── tools.html        # 常用工具链接页面模板 (静态)
│       ├── tutorials.html
│       └── wallets.html
├── index.html              # 主 HTML 骨架文件
├── main.js                 # Electron 主进程入口文件
├── package-lock.json       # 精确的依赖版本锁定文件
├── package.json            # 项目配置和依赖定义
├── preload.js              # Electron Preload 脚本 (用于安全的 IPC 通信)
└── README.md               # 项目说明
```

## 如何运行 (开发模式)

1.  **确保你的电脑安装了 Node.js (自带 npm)。**
2.  **克隆或下载本仓库代码。**
3.  **打开终端 (命令行)，`cd` 进入项目的根目录** (包含 `package.json` 的目录)。
4.  **安装依赖:**
    ```bash
    npm install
    ```
5.  **启动应用 (开发模式):**
    ```bash
    npm run dev
    ```
    或者
    ```bash
    npm start
    ```
    这将启动 Electron 应用，并自动打开开发者工具。

## 注意事项

*   本项目目前集成了 SQLite 本地数据库用于**钱包管理**和**社交账户管理**。其他模块的数据存储和功能仍在开发中。
*   **安全警告:** 钱包的私钥/助记词存储需要用户进行强加密，目前代码中仅包含占位符，**请勿直接存储明文私钥！**
*   链上交互功能（如查询余额、发送交易）尚未实现，表格中的相关数据为占位符。
*   导入/导出功能目前仅支持特定 JSON 格式。
*   使用任何Web3工具时都应注意安全风险。

## 后续开发计划

*   [x] **仪表盘**: 实现核心数据（钱包/社交账户数量）的动态加载。
*   [ ] **社交账户管理**: 实现导入/导出、批量操作。
*   [x] **IP代理管理**: 实现表格筛选功能 (类型, 分组, 搜索)。
*   [x] **软件设置**: 添加 IP 查询渠道配置项。
*   [ ] 完善其他模块 (项目跟踪、脚本插件等) 的 UI 和数据存储。
*   [x] 完善钱包管理模块功能（分组、导入/导出、批量操作、查看详情、UI 交互优化）。
*   [x] **社交账户管理**: 实现分组筛选、搜索功能，优化添加/编辑模态框样式及布局。
*   [x] 修复分组管理和社交账户模态框的样式问题。
*   [ ] **实现安全的私钥/助记词加密存储机制。**
*   [ ] 集成钱包连接库 (如 Web3Modal) 或实现基础的链上数据查询 (余额, Tx数)。
*   [ ] 优化 UI 和用户体验 (持续进行)。
*   [ ] 增加单元测试和集成测试。
*   [ ] 配置 `electron-builder` 实现应用打包。

## 贡献

欢迎通过 Issue 或 Pull Request 提供建议和改进。

## 免责声明

本工具仅供学习和研究使用，用户应自行承担使用过程中的风险。开发者不对因使用本工具导致的任何损失负责。 