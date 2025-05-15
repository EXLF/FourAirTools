# FourAir社区撸毛工具箱 (Electron 桌面版)

这是一个专为Web3用户设计的空投任务管理和批量交互工具，以 Electron 桌面应用的形式提供，旨在帮助用户在本地安全、高效地参与各种空投活动和链上交互。

## 主要功能

*   **仪表盘**: 概览核心数据、主要网络 Gas 费等。
*   **钱包管理**:
    *   安全管理钱包（地址、私钥、助记词、备注、分组），支持批量生成、导入/导出 (JSON) 和精细化分组。
    *   敏感信息（私钥、助记词）通过主密码加密存储在本地数据库，字段名明确为 `encryptedPrivateKey` 和 `encryptedMnemonic`。
    *   支持查看钱包详情（含按需解密后的敏感数据）和主要代币余额查询。
    *   可将钱包与社交账户进行关联管理。
*   **社交账户管理**:
    *   统一管理多平台社交账户（Twitter, Discord, Telegram, Email 等），包括账户凭证和分组。
    *   支持根据平台动态显示和编辑特定信息（如Twitter 2FA, Discord Token）。
    *   表格中可按平台筛选并安全显示（解密后）相关账户信息。
*   **IP代理管理**:
    *   管理HTTP/HTTPS/SOCKS5代理配置，支持批量测试、导入/导出。
    *   代理密码在存储前会进行加密，并在需要时（如脚本执行）由应用后端按需解密。
    *   提供代理连通性、延迟、出口IP信息及风险评估。
*   **脚本插件**:
    *   支持加载和执行用户自定义脚本，实现批量或自动化链上交互。
    *   脚本引擎在执行脚本时，会按需解密选定钱包的私钥/助记词以及选定代理的密码，安全地提供给沙箱中的脚本使用。
    *   脚本沙箱环境进一步加固，限制了对宿主 `process.env` 的直接访问。
    *   提供脚本执行配置界面（如关联钱包、代理选择）和实时日志监控。
    *   内置脚本格式标准和通用工具库（HTTP, Web3, Logger, 验证码处理等）。
*   **常用工具**:
    *   聚合常用Web3工具和资源链接（如交易所、钱包插件、数据分析、跨链桥、区块浏览器、安全工具），点击可在外部浏览器中安全打开。
*   **社区交流**:
    *   应用内嵌入Discord社区，支持会话保持和账户管理。
*   **软件设置**:
    *   提供应用级参数配置。
*   **通用交互**:
    *   大部分模块提供统一的数据表格交互，包括搜索、筛选、分页功能。
    *   通过 Toast 提供操作反馈，模态框用于复杂交互和信息展示。

## 安全机制

*   **主密码**: 首次启动强制设置主密码，用于加密本地敏感数据。后续启动需通过持久化模态框输入主密码解锁。
*   **数据加密**: 钱包私钥、助记词 (存储为 `encryptedPrivateKey` 和 `encryptedMnemonic`)、代理密码及社交账户凭证等敏感信息，使用基于主密码派生的密钥通过 AES-GCM 加密后存储在本地 SQLite 数据库。数据库层面包含迁移逻辑，以确保旧数据中的明文密码能被加密。
*   **按需解密**: 加密的敏感数据（如钱包密钥、代理密码）仅在必要时（如脚本执行、用户查看详情）在主进程中解密，并以安全的方式传递给渲染进程或脚本沙箱。
*   **脚本沙箱安全**: 用户脚本在受限的 `vm2` 沙箱环境中执行，移除了对 `process.env` 的直接暴露，脚本引擎负责安全地提供必要的上下文信息（包括解密后的密钥和代理凭证）。
*   **持久化模态框**: 核心认证流程（初始密码设置、应用解锁）采用持久化模态框 (`src/js/components/modal.js`)，确保用户完成关键安全步骤。
*   **自动解锁 (可选)**: 支持通过操作系统凭据管理器 (`keytar`) 安全存储主密钥，实现应用的自动解锁。
*   **手动锁定**: 提供应用锁定功能，清除内存和系统中的密钥，下次使用需重新输入主密码。

## 技术栈

*   **框架**: Electron
*   **前端**: HTML5, CSS3, JavaScript (ES Modules)
    *   **UI 组件**: 包括一个可配置的模态框组件 (`src/js/components/modal.js`)，支持常规关闭和持久化显示模式。
*   **本地数据库**: SQLite (通过 `sqlite3` Node.js 模块)
*   **核心库**: Font Awesome, `keytar`, `ethers.js`

## 项目结构概览

项目主要源码位于 `src/` 目录下，分为：
*   `src/main/`: Electron 主进程相关代码，包括应用生命周期管理、核心服务 (加密、钱包生成)、数据库接口、IPC通讯处理和脚本引擎。
*   `src/js/`: 渲染进程相关代码 (前端逻辑)，包括核心应用逻辑 (入口、认证、导航)、UI组件、各功能页面的业务逻辑和工具函数。
*   `src/css/`: 应用的样式文件。
*   `src/assets/`: 图标等静态资源。
*   `index.html`: 应用的主HTML骨架。
*   `preload.js`: Electron预加载脚本。

更详细的目录结构请参考 `project_structure.md` 文件。

## 如何运行 (开发模式)

1.  确保已安装 Node.js (自带 npm)。
2.  克隆或下载本仓库。
3.  在项目根目录下运行 `npm install` 安装依赖。
4.  运行 `npm start` 或 `npm run dev` 启动应用。

## 注意事项

*   **安全第一**: 请务必牢记并妥善保管您设置的主密码。丢失主密码将导致加密数据无法恢复。启用自动解锁功能时，请确保您的操作系统账户安全。
*   **开发状态**: 本项目仍在持续开发中，部分功能可能尚未完善。

## 模块重构: 脚本插件 (Script Plugins)

本次对 `src/js/pages/scriptPlugins/` 目录及其相关模板 `src/templates/script-plugins.html` 进行了重构。

**重构目标:**

1.  **提升模块化与代码组织**: 将逻辑拆分到更小、职责更单一的模块中（例如，详情页逻辑移至 `detail/` 子目录）。
2.  **增强代码清晰度和可维护性**: 通过合理的函数划分、参数传递和回调机制，使代码更易于理解和修改。
3.  **遵循关注点分离原则**: HTML 模板负责静态结构，JavaScript 专注于动态内容、交互和业务逻辑。
4.  **优化导航和视图切换**: 实现更可靠的页面内导航，特别是在脚本列表与详情视图之间，以及详情页内部切换不同脚本的体验。
5.  **移除冗余/未使用代码**: 清理不再使用的函数、事件监听器、全局变量及占位文件。
6.  **功能调整**: 根据需求移除了本地"添加脚本"的功能，脚本将通过服务器推送。

**主要重构内容概要:**

*   **`src/templates/script-plugins.html`**:
    *   重构为包含完整页面结构（头部、筛选/搜索栏、卡片容器）的静态骨架。
    *   移除了本地"添加脚本"按钮。
    *   确保了 `tpl-modal-run-plugin` 模态框模板的完整性和一致性。
*   **`src/js/pages/scriptPlugins/index.js` (脚本插件列表页主逻辑)**:
    *   `initScriptPluginPage`: 简化为入口，调用 `renderScriptPluginsListView`。
    *   `renderScriptPluginsListView`: 负责获取模板元素、绑定列表级事件、加载渲染脚本卡片、初始化搜索/筛选。
    *   `loadAndRenderScriptCards`: 从 `ScriptManager` 获取数据，创建卡片，填充筛选器。
    *   `ScriptManager`: 统一处理与主进程的脚本相关IPC通信。
    *   视图切换 (`initializeDetailView`, `navigateToScriptCards`, `loadScriptDetail`):
        *   `navigateToScriptCards` 修改为通过调用全局 `loadPage('script-plugins')` 重新加载和初始化列表页面。
        *   `loadScriptDetail` 作为回调传递给详情页内部脚本列表，用于在详情页内切换脚本显示。
    *   移除了 `handleAddScript` 函数及相关逻辑和大量旧代码。
*   **`src/js/pages/scriptPlugins/detail/` (脚本详情页)**:
    *   `view.js` (`renderScriptDetailView`): 渲染详情页HTML，接收并传递导航回调和侧边栏脚本选择回调。
    *   `events.js` (`bindDetailViewEvents`): 处理详情页事件，使用导航回调返回列表页。
    *   `scripts.js` (`loadScriptList`): 渲染详情页侧边栏脚本列表，接收并使用侧边栏脚本选择回调。
*   **文件清理**: 删除了 `src/js/pages/scriptPlugins/`目录下未使用的 `modals.js`, `table.js`, `actions.js` 文件。

## 模块重构: 社交账户 (Social)

当前正在对 `src/js/pages/social/` 目录及其相关模板 `src/templates/social.html` 进行重构。

**重构目标:**

1.  **提升模块化与代码组织**: 重点关注 `table.js` (原先超过600行)，将其中的渲染逻辑逐步迁移到新的 `socialTableRenderer.js` 文件中。
2.  **增强代码清晰度和可维护性**: 使 `table.js` 更侧重于业务逻辑、数据获取和事件处理，而 `socialTableRenderer.js` 专注于DOM元素的生成和更新。
3.  **遵循关注点分离原则**: 明确渲染逻辑和业务逻辑的界限。
4.  **修复潜在错误**: 在重构过程中解决发现的bug，例如模板字符串的语法错误。

**已完成的主要重构内容概要 (进行中):**

*   **创建 `src/js/pages/social/socialTableRenderer.js`**:
    *   用于存放从 `table.js` 中分离出来的渲染相关函数。
*   **功能迁移至 `socialTableRenderer.js`**:
    *   `renderTableHeader`: 负责根据平台配置动态生成表格头部HTML。
    *   `createSocialAccountRowElement`: 负责根据账户数据和列配置生成表格行DOM元素。
        *   其内部辅助函数 `getDisplayValue` (用于格式化单元格内容) 和 `escapeAttribute` (用于安全处理属性值) 也一并迁移。
*   **`src/js/pages/social/table.js` 更新**:
    *   移除了上述已迁移函数的本地定义。
    *   更新了导入语句，从 `socialTableRenderer.js` 导入这些渲染函数。
    *   相应地更新了函数调用，传递必要的参数 (例如，`createSocialAccountRowElement` 现在接收 `SENSITIVE_FIELDS_FOR_COPY` 和 `handleSocialAccountAction` 回调)。
*   **问题修复**:
    *   解决了在迁移 `createSocialAccountRowElement` 到 `socialTableRenderer.js` 时，由于模板字符串中反引号处理不当导致的 `SyntaxError: Invalid or unexpected token` 错误。
*   **HTML模板 (`src/templates/social.html`)**:
    *   为"批量导入"按钮添加了 `id="bulk-import-social-btn"`。
    *   为"导出选中"按钮添加了 `id="export-selected-social-btn"`。

**后续计划**:
*   继续将 `table.js` 中的其他渲染相关逻辑 (如 `createPageSizeSelector` 和 `renderPagination`) 迁移到 `socialTableRenderer.js`。

## 近期关键增强

*   **脚本插件系统**:
    *   实现了模块化脚本架构，支持用户自定义脚本的加载、配置和执行。
    *   完善了脚本执行引擎，支持代理配置和实时日志输出。
    *   优化了脚本执行相关的钱包选择和UI交互。
*   **安全性与认证**:
    *   增强了模态框组件，支持持久化模式，并应用于初始密码设置和应用解锁流程。
    *   修复了Electron应用打包后数据库路径问题。
*   **核心模块功能**:
    *   **社交账户管理**: 重构数据结构以支持平台特定信息，优化了添加/编辑流程和表格显示。
    *   **教程中心**: 实现教程数据的API加载和应用内`<webview>`嵌入式浏览，优化了外部链接处理。
    *   **社区交流**: 优化了Discord嵌入的会话管理和UI交互。
    *   **IP代理**: 修复了代理测试和应用中的若干问题。

## 贡献

欢迎通过 Issue 或 Pull Request 提供宝贵建议和代码贡献。

## 免责声明

本工具仅供学习和研究使用，用户需自行承担使用过程中的所有风险。开发者不对因使用本工具导致的任何直接或间接损失负责。