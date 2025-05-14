# 项目目录结构详解

本项目是一个基于 Electron 的桌面应用程序，具有丰富的功能，包括脚本执行、数据管理、网络工具等。

```
fourAirtools/
├── .cursorignore
├── .git/
├── .gitignore
├── index.html
├── node_modules/
├── package-lock.json
├── package.json
├── preload/
│   └── webview-preload.js
├── project_structure.md
├── public
├── README.md
├── src/
│   ├── assets/
│   │   └── icons/
│   │       ├── across.png
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
│   ├── css/
│   │   ├── base/
│   │   │   ├── layout.css
│   │   │   ├── reset.css
│   │   │   └── responsive.css
│   │   ├── components/
│   │   │   ├── buttons.css
│   │   │   ├── cards.css
│   │   │   ├── forms.css
│   │   │   ├── modals.css
│   │   │   ├── network.css
│   │   │   ├── scriptCards.css
│   │   │   ├── scriptDetail.css
│   │   │   ├── tables.css
│   │   │   └── tags.css
│   │   ├── pages/
│   │   │   ├── dashboard.css
│   │   │   ├── plugins.css
│   │   │   ├── projects.css
│   │   │   ├── social.css
│   │   │   ├── tools.css
│   │   │   └── tutorials.css
│   │   └── main.css
│   ├── data/
│   │   └── tutorials.json
│   ├── js/
│   │   ├── components/
│   │   │   ├── modal.js
│   │   │   ├── tableHelper.js
│   │   │   └── toast.js
│   │   ├── core/
│   │   │   ├── app.js
│   │   │   ├── authSetup.js
│   │   │   ├── authUnlock.js
│   │   │   ├── globalListeners.js
│   │   │   └── navigation.js
│   │   ├── pages/
│   │   │   ├── community/
│   │   │   │   └── index.js
│   │   │   ├── dashboard/
│   │   │   │   └── index.js
│   │   │   ├── network/
│   │   │   │   ├── modules/
│   │   │   │   │   ├── dom.js
│   │   │   │   │   ├── events.js
│   │   │   │   │   ├── import-export.js
│   │   │   │   │   ├── modals.js
│   │   │   │   │   ├── pagination.js
│   │   │   │   │   ├── state.js
│   │   │   │   │   ├── table.js
│   │   │   │   │   └── utils.js
│   │   │   │   └── index.js
│   │   │   ├── projects/
│   │   │   │   ├── actions.js
│   │   │   │   ├── index.js
│   │   │   │   ├── modals.js
│   │   │   │   └── table.js
│   │   │   ├── scriptPlugins/
│   │   │   │   ├── detail/
│   │   │   │   │   ├── config.js
│   │   │   │   │   ├── events.js
│   │   │   │   │   ├── index.js
│   │   │   │   │   ├── logger.js
│   │   │   │   │   ├── proxy.js
│   │   │   │   │   ├── scripts.js
│   │   │   │   │   ├── state.js
│   │   │   │   │   ├── view.js
│   │   │   │   │   └── wallets.js
│   │   │   │   └── index.js
│   │   │   ├── settings/
│   │   │   │   └── index.js
│   │   │   ├── social/
│   │   │   │   ├── actions.js
│   │   │   │   ├── index.js
│   │   │   │   ├── modals.js
│   │   │   │   ├── socialTableRenderer.js
│   │   │   │   └── table.js
│   │   │   ├── tools/
│   │   │   │   └── index.js
│   │   │   ├── tutorials/
│   │   │   │   └── index.js
│   │   │   └── wallets/
│   │   │       ├── actions.js
│   │   │       ├── index.js
│   │   │       ├── modals/
│   │   │       │   ├── add-wallet-manual-modal.js
│   │   │       │   ├── generate-wallets-modal.js
│   │   │       │   ├── index.js
│   │   │       │   ├── link-socials-modal.js
│   │   │       │   ├── manage-groups-modal.js
│   │   │       │   ├── view-details-modal.js
│   │   │       │   └── wallet-form-modal.js
│   │   │       ├── modals.js
│   │   │       └── table.js
│   │   └── utils/
│   │       ├── index.js
│   │       └── locationTranslator.js
│   ├── main/
│   │   ├── core/
│   │   │   ├── cryptoService.js
│   │   │   └── walletGenerator.js
│   │   ├── db/
│   │   │   ├── group.js
│   │   │   ├── index.js
│   │   │   ├── links.js
│   │   │   ├── proxy.js
│   │   │   ├── social.js
│   │   │   └── wallet.js
│   │   ├── ipcHandlers/
│   │   │   ├── appHandlers.js
│   │   │   ├── dbHandlers.js
│   │   │   ├── index.js
│   │   │   └── proxyHandlers.js
│   │   ├── index.js
│   │   └── scriptEngine.js
│   ├── preload.js
│   └── templates/
│       ├── community.html
│       ├── dashboard.html
│       ├── projects.html
│       ├── script-plugins.html
│       ├── settings.html
│       ├── social.html
│       ├── tool-network.html
│       ├── tools.html
│       ├── tutorials.html
│       └── wallets.html
├── test_script_loading.js
└── user_scripts/
    ├── common/
    │   ├── captcha/
    │   │   ├── recaptchaV3.js
    │   │   ├── recaptchaV3Solver.js
    │   │   └── solver-wrapper.js
    │   ├── http.js
    │   ├── logger.js
    │   ├── script-utils.js
    │   └── web3.js
    └── scripts/
        ├── balance_check.js
        ├── mira.js
        ├── mira_chat_bot.js
        └── print123.js
```

## 项目信息简要说明:

这是一个基于 Electron 的桌面应用程序。

*   **核心功能:**
    *   前端界面 (`index.html`, `src/css/`, `src/js/`, `src/templates/`, `src/assets/`)：负责用户界面的展示和交互。
    *   后端逻辑/主进程 (`src/main/index.js`, `src/main/`)：处理应用的核心逻辑，包括窗口管理、进程间通信 (IPC) 等。
    *   脚本引擎 (`src/main/scriptEngine.js`, `user_scripts/`)：允许用户运行自定义脚本。
    *   数据库 (`database.db`, `src/main/db/`, `src/main/ipcHandlers/dbHandlers.js`)：使用 SQLite 存储数据。
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
