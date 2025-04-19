# FourAir社区撸毛工具箱

这是一个专为Web3用户设计的空投任务管理和批量交互工具，旨在帮助用户高效地参与各种空投活动和链上交互。项目目前处于前端重构和开发阶段。

## 功能特点 (规划中)

- **仪表盘**：概览核心数据、近期任务、主要网络 Gas 等。
- **项目跟踪**：卡片式展示和管理不同链上的空投项目及相关活动。
- **钱包管理**：统一管理链上钱包和交易所账户。
- **社交账户管理**：管理 Twitter、Discord 等社交媒体账号。
- **脚本插件**：通过可配置的插件执行批量或自动化操作（如跨链、Swap）。
- **IP代理管理**：管理网络代理配置。
- **教程中心**：提供Web3知识、安全防范和项目交互教程。
- **社区交流**：提供社区入口（如 Discord、Telegram）。
- **软件设置**：配置应用参数。

## 技术栈

- 前端：HTML5, CSS3, JavaScript (ES Modules)
- 核心库：Font Awesome (图标)
- (未来) 区块链交互：可能使用 ethers.js / viem 等库
- (未来) 桌面应用：计划使用 Electron 打包

## 项目结构

项目采用了模块化的前端结构：

```
├── src/
│   ├── css/                # CSS 样式
│   │   ├── base/           # 基础样式 (reset, layout, responsive)
│   │   ├── components/     # 可重用组件样式 (buttons, cards, tables, modals)
│   │   └── pages/          # 页面特定样式 (dashboard, projects, etc.)
│   ├── js/                 # JavaScript 模块
│   │   ├── core/           # 核心逻辑 (app entry, navigation, listeners)
│   │   ├── components/     # 可重用 UI 组件逻辑 (modal, table helper)
│   │   ├── pages/          # 页面特定逻辑 (dashboard, projects, wallets, etc.)
│   │   └── utils/          # 通用工具函数 (debounce, etc.)
│   └── templates/          # HTML 页面模板片段
│       ├── dashboard.html
│       ├── projects.html
│       └── ... (其他页面模板)
├── index.html              # 主 HTML 骨架文件
├── README.md               # 项目说明
└── ... (其他配置文件，例如 package.json - 如果添加)
```

## 如何运行

**重要：** 由于项目使用了 JavaScript ES Modules (`<script type="module">`) 并且通过 `fetch` 加载 HTML 模板，**不能直接通过 `file:///` 协议打开 `index.html` 文件**。这样做会遇到浏览器的 CORS 安全限制。

你需要使用本地 HTTP 服务器来运行此项目：

1.  **确保你的电脑安装了 Node.js 或 Python。**
2.  **打开终端 (命令行)。**
3.  **`cd` 进入项目的根目录** (包含 `index.html` 和 `src` 文件夹的 `FourAir` 目录)。
4.  **选择一种方式启动服务器：**
    *   **使用 Node.js 的 `http-server` (推荐，如果已安装):**
        ```bash
        # 如果没有安装，先全局安装: npm install --global http-server
        http-server
        ```
        服务器通常会运行在 `http://localhost:8080`。
    *   **使用 Python 3:**
        ```bash
        python -m http.server
        ```
        服务器通常会运行在 `http://localhost:8000`。
    *   **使用 Python 2:**
        ```bash
        python -m SimpleHTTPServer
        ```
        服务器通常会运行在 `http://localhost:8000`。
5.  **在浏览器中打开服务器提示的地址** (例如 `http://localhost:8080` 或 `http://localhost:8000`)。

## 注意事项

- 本项目目前主要进行前端界面和结构的开发与重构，许多功能 (如实际的钱包交互、数据保存、后端逻辑) 尚未实现，界面上的数据多为占位符。
- 交互逻辑 (如点击按钮后的弹窗、日志记录) 多数为模拟或占位提示。
- 使用任何Web3工具时都应注意安全风险。

## 后续开发计划

- [ ] 完善所有页面的基础交互和功能占位。
- [ ] 实现数据持久化 (可能使用 LocalStorage 或 IndexedDB，Electron环境下可能使用文件存储)。
- [ ] 集成钱包连接库 (如 Web3Modal)。
- [ ] 开始实现核心的链上交互功能 (需要后端或 Electron 主进程支持)。
- [ ] 增加单元测试和集成测试。
- [ ] 使用 Electron 打包为桌面应用。

## 贡献

欢迎通过 Issue 或 Pull Request 提供建议和改进。

## 免责声明

本工具仅供学习和研究使用，用户应自行承担使用过程中的风险。开发者不对因使用本工具导致的任何损失负责。 