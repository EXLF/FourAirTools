# 项目目录结构详解

本项目是一个基于 Electron 的桌面应用程序，具有丰富的功能，包括脚本执行、数据管理、网络工具等。

```
Four2/
├── .git/                                   # Git 版本控制系统目录
├── .gitignore (482B, 32 lines)             # Git 忽略文件配置，指定哪些文件或目录不纳入版本控制
├── database.db (84KB, 186 lines)           # SQLite 数据库文件，存储应用数据
├── index.html (30KB, 529 lines)            # 应用的主要 HTML 入口文件，渲染器进程的起点
├── main.js (15KB, 317 lines)               # Electron 主进程入口文件，负责应用生命周期、窗口管理和后端逻辑
├── node_modules/                           # Node.js 项目依赖包目录
├── package-lock.json (228KB, 6444 lines)   # 精确锁定项目依赖版本的文件
├── package.json (831B, 36 lines)           # Node.js 项目配置文件，包含项目元数据、依赖和脚本等
├── preload/                                # 预加载脚本目录
│   └── webview-preload.js (2.5KB, 83 lines) # 用于 webview 的预加载脚本，可能用于在 webview 环境中注入特定 API
├── public (2.2KB, 70 lines)                # 可能存放一些静态公共资源
├── README.md (29KB, 591 lines)             # 项目说明文档
├── src/                                    # 项目核心源代码目录
│   ├── assets/                             # 静态资源目录，如图片、字体等
│   │   └── icons/                          # 图标资源目录
│   │       ├── across.png                  # (以下均为各种服务的图标文件)
│   │       ├── arbiscan.png
│   │       ├── binance.png
│   │       ├── bscscan.png
│   │       ├── chainlist.png
│   │       ├── debank.png
│   │       ├── default.svg
│   │       ├── defillama.png
│   │       ├── dune.png
│   │       ├── etherscan.png
│   │       ├── hop.png
│   │       ├── lifi.png
│   │       ├── metamask.png
│   │       ├── okx.png
│   │       ├── optimism.png
│   │       ├── phantom.png
│   │       ├── polygonscan.png
│   │       ├── revoke.png
│   │       ├── solscan.png
│   │       ├── stargate.png
│   │       ├── synapse.png
│   │       └── tokenterminal.png
│   ├── css/                                # CSS 样式文件目录
│   │   ├── base/                           # 基础样式目录
│   │   │   ├── layout.css                  # 布局相关的全局样式
│   │   │   ├── responsive.css              # 响应式设计样式
│   │   │   └── reset.css                   # CSS 重置样式，用于统一不同浏览器的默认样式
│   │   ├── components/                     # UI 组件样式目录
│   │   │   ├── buttons.css                 # 按钮组件样式
│   │   │   ├── cards.css                   # 卡片组件样式
│   │   │   ├── forms.css                   # 表单组件样式
│   │   │   ├── modals.css                  # 模态框/弹窗组件样式
│   │   │   ├── network.css                 # 网络相关组件或页面的特定样式
│   │   │   ├── scriptCards.css             # 脚本卡片组件样式
│   │   │   ├── scriptDetail.css            # 脚本详情页面样式
│   │   │   ├── tables.css                  # 表格组件样式
│   │   │   └── tags.css                    # 标签组件样式
│   │   ├── main.css                        # 主要的全局 CSS 文件
│   │   └── pages/                          # 特定页面的 CSS 样式目录
│   │       ├── dashboard.css               # 仪表盘页面样式
│   │       ├── plugins.css                 # 插件页面样式
│   │       ├── projects.css                # 项目页面样式
│   │       ├── social.css                  # 社交页面样式
│   │       ├── tools.css                   # 工具页面样式
│   │       └── tutorials.css               # 教程页面样式
│   ├── data/                               # 数据文件目录
│   │   └── tutorials.json                  # 教程内容数据 (JSON 格式)
│   ├── js/                                 # JavaScript 源代码目录 (渲染器进程)
│   │   ├── components/                     # 可复用的 UI 组件或辅助模块
│   │   │   ├── modal.js                    # 模态框/弹窗组件逻辑
│   │   │   ├── tableHelper.js              # 表格辅助功能模块
│   │   │   └── toast.js                    # 提示/通知组件逻辑
│   │   ├── core/                           # 核心 JavaScript 模块
│   │   │   ├── __tests__/                  # 测试文件目录 (此项目中为空)
│   │   │   ├── app.js                      # 应用级别的前端逻辑初始化
│   │   │   ├── authSetup.js                # 认证设置相关逻辑
│   │   │   ├── authUnlock.js               # 认证解锁相关逻辑
│   │   │   ├── cryptoService.js            # 加密/解密服务模块
│   │   │   ├── globalListeners.js          # 全局事件监听器
│   │   │   ├── index.js                    # core 模块的入口或聚合文件
│   │   │   ├── navigation.js               # 页面导航和路由管理
│   │   │   └── walletGenerator.js          # 钱包生成相关逻辑
│   │   ├── db/                             # 前端与数据库交互的模块
│   │   │   ├── group.js                    # 分组数据模型操作
│   │   │   ├── index.js                    # db 模块的入口或聚合文件，封装数据库操作API
│   │   │   ├── links.js                    # 链接数据模型操作
│   │   │   ├── proxy.js                    # 代理数据模型操作
│   │   │   ├── social.js                   # 社交数据模型操作
│   │   │   └── wallet.js                   # 钱包数据模型操作
│   │   ├── pages/                          # 各个页面的 JavaScript 逻辑
│   │   │   ├── community/                  # 社区页面相关 JS
│   │   │   │   ├── actions.js              # 社区页面的操作逻辑 (可能为空或占位)
│   │   │   │   ├── index.js                # 社区页面的主要逻辑
│   │   │   │   ├── modals.js               # 社区页面的模态框逻辑 (可能为空或占位)
│   │   │   │   └── table.js                # 社区页面的表格逻辑 (可能为空或占位)
│   │   │   ├── dashboard/                  # 仪表盘页面相关 JS
│   │   │   │   ├── actions.js              # (类似上方，具体页面的 actions, index, modals, table 结构)
│   │   │   │   ├── index.js
│   │   │   │   ├── modals.js
│   │   │   │   └── table.js
│   │   │   ├── network/                    # 网络工具页面相关 JS
│   │   │   │   ├── actions.js
│   │   │   │   ├── index.js
│   │   │   │   ├── modals.js
│   │   │   │   └── table.js
│   │   │   ├── projects/                   # 项目页面相关 JS
│   │   │   │   ├── actions.js
│   │   │   │   ├── index.js
│   │   │   │   ├── modals.js
│   │   │   │   └── table.js
│   │   │   ├── scriptPlugins/              # 脚本插件页面相关 JS
│   │   │   │   ├── actions.js
│   │   │   │   ├── detail.js               # 脚本插件详情页逻辑
│   │   │   │   ├── index.js
│   │   │   │   ├── modals.js
│   │   │   │   └── table.js
│   │   │   ├── scripts/                    # 用户脚本管理页面相关 JS (此项目中为空)
│   │   │   ├── settings/                   # 设置页面相关 JS
│   │   │   │   ├── actions.js
│   │   │   │   ├── index.js
│   │   │   │   ├── modals.js
│   │   │   │   └── table.js
│   │   │   ├── social/                     # 社交页面相关 JS
│   │   │   │   ├── actions.js
│   │   │   │   ├── index.js
│   │   │   │   ├── modals.js
│   │   │   │   └── table.js
│   │   │   ├── store/                      # 商店/市场页面相关 JS (此项目中为空)
│   │   │   ├── tools/                      # 工具页面相关 JS
│   │   │   │   └── index.js
│   │   │   ├── tutorials/                  # 教程页面相关 JS
│   │   │   │   ├── actions.js
│   │   │   │   ├── index.js
│   │   │   │   ├── modals.js
│   │   │   │   └── table.js
│   │   │   └── wallets/                    # 钱包页面相关 JS
│   │   │       ├── actions.js
│   │   │       ├── index.js
│   │   │       ├── modals.js
│   │   │       └── table.js
│   │   ├── tool-network.js                 # 一个独立的网络工具相关 JS 文件 (可能与 `pages/network` 有关或是一个特定的小工具)
│   │   ├── utils/                          # 通用工具函数或模块
│   │   │   ├── index.js                    # utils 模块的入口或聚合文件
│   │   │   └── locationTranslator.js       # 地址/位置转换相关的工具
│   │   └── vendors/                        # 第三方库/插件 (前端)
│   │       └── axios.min.js                # Axios HTTP 客户端库
│   ├── main/                               # Electron 主进程相关代码
│   │   ├── ipcHandlers/                    # IPC (进程间通信) 事件处理模块
│   │   │   ├── appHandlers.js              # 处理应用级别相关的 IPC 事件 (如窗口操作、应用信息)
│   │   │   ├── dbHandlers.js               # 处理数据库相关的 IPC 事件 (来自渲染器进程的数据库请求)
│   │   │   ├── index.js                    # ipcHandlers 模块的入口，注册所有 IPC 事件处理函数
│   │   │   └── proxyHandlers.js            # 处理代理设置相关的 IPC 事件
│   │   └── scriptEngine.js                 # 脚本引擎核心逻辑，负责加载和执行用户脚本
│   ├── pages/                              # 存放 HTML 页面的目录 (这里的 store 为空，大部分页面在 templates)
│   │   └── store/                          # (此项目中为空)
│   ├── preload.js                          # Electron 预加载脚本，在渲染器进程的 web 内容加载前运行，用于安全地暴露 Node.js API 给渲染器进程
│   └── templates/                          # HTML 模板文件目录，用于构成应用的不同视图/页面
│       ├── community.html                  # 社区页面模板
│       ├── dashboard.html                  # 仪表盘页面模板
│       ├── projects.html                   # 项目页面模板
│       ├── script-plugins.html             # 脚本插件页面模板
│       ├── settings.html                   # 设置页面模板
│       ├── social.html                     # 社交页面模板
│       ├── tool-network.html               # 网络工具页面模板
│       ├── tools.html                      # 工具集合页面模板
│       ├── tutorials.html                  # 教程页面模板
│       └── wallets.html                    # 钱包页面模板
└── user_scripts/                           # 用户自定义脚本存放目录
    ├── common/                             # 用户脚本公用模块
    │   ├── captcha/                        # 验证码处理相关模块 (此项目中为空)
    │   ├── http.js                         # 用户脚本中可用的 HTTP 请求模块
    │   ├── logger.js                       # 用户脚本中可用的日志记录模块
    │   └── web3.js                         # 用户脚本中可用的 Web3 (以太坊等区块链交互) 模块
    ├── protocols/                          # 特定协议的脚本 (此项目中为空)
    ├── scripts/                            # 用户自定义的独立脚本
    │   ├── balance_check.js                # 示例脚本：余额检查
    │   └── print123.js                     # 示例脚本：简单打印
    └── wallets/                            # 与钱包操作相关的用户脚本 (此项目中为空)
```

## 项目信息简要说明:

这是一个基于 Electron 的桌面应用程序。

*   **核心功能:**
    *   前端界面 (`index.html`, `src/css/`, `src/js/`, `src/templates/`, `src/assets/`)：负责用户界面的展示和交互。
    *   后端逻辑/主进程 (`main.js`, `src/main/`)：处理应用的核心逻辑，包括窗口管理、进程间通信 (IPC) 等。
    *   脚本引擎 (`src/main/scriptEngine.js`, `user_scripts/`)：允许用户运行自定义脚本。
    *   数据库 (`database.db`, `src/js/db/`, `src/main/ipcHandlers/dbHandlers.js`)：使用 SQLite 存储数据。
    *   预加载脚本 (`preload/webview-preload.js`, `src/preload.js`)：在渲染器进程中安全地暴露 Node.js API。

*   **主要模块/页面 (通过 `src/templates` 和 `src/js/pages` 推断):**
    *   Dashboard, Wallets, Projects, Social, Network Tools, General Tools, Script Plugins, Tutorials, Community, Settings.

*   **技术栈 (推测):**
    *   Electron
    *   HTML, CSS, JavaScript
    *   Node.js
    *   SQLite
    *   Axios (HTTP 请求)

*   **项目结构特点:**
    *   **模块化:** 按功能组织代码。
    *   **关注点分离:** 前后端逻辑分离。
    *   **用户可扩展性:** 通过 `user_scripts/` 支持用户脚本。
    *   **丰富的 UI 组件:** 定义了多种常用 UI 组件的样式和逻辑。
    *   **多页面应用 (MPA) 风格:** 使用 HTML 模板构建不同页面。

</rewritten_file> 