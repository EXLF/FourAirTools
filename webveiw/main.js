const { app, BrowserWindow, session, shell } = require('electron')
const path = require('path')

function createWindow() {
  // 创建浏览器窗口
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true, // 启用webview标签
      webSecurity: false // 临时关闭Web安全性以便调试
    }
  })

  // 加载index.html
  mainWindow.loadFile('index.html')
  
  // 打开开发者工具
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools()
  }
  
  // 拦截mainWindow中的新窗口请求
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // 在默认浏览器中打开URL
    shell.openExternal(url).catch(err => {
      console.error('打开外部URL失败:', err)
    })
    // 阻止创建新窗口
    return { action: 'deny' }
  })
}

// 当Electron完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(() => {
  // 配置会话
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  // 设置额外的安全策略
  app.on('web-contents-created', (event, contents) => {
    // 拦截所有新窗口创建请求
    contents.setWindowOpenHandler(({ url }) => {
      // 在默认浏览器中打开所有URL
      shell.openExternal(url).catch(err => {
        console.error('打开外部URL失败:', err)
      })
      // 阻止创建新窗口
      return { action: 'deny' }
    })
    
    // 配置webview的权限
    if (contents.getType() === 'webview') {
      // 禁止webview创建新窗口，改为在外部浏览器打开
      contents.on('will-navigate', (event, url) => {
        const parsedUrl = new URL(url)
        // 如果不是notion域名，则阻止导航并在外部浏览器打开
        if (!parsedUrl.hostname.includes('notion.so')) {
          event.preventDefault()
          shell.openExternal(url).catch(err => {
            console.error('打开外部URL失败:', err)
          })
        }
      })
      
      // 允许打开开发者工具
      contents.on('before-input-event', (event, input) => {
        // 允许使用F12打开开发者工具
        if (input.key === 'F12') {
          contents.openDevTools();
        }
      });
      
      // 为webview启用node集成
      contents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.notion.so https://notion.so; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.notion.so;"]
          }
        })
      })
    }
  })

  createWindow()

  app.on('activate', function () {
    // 在macOS上，当单击dock图标并且没有其他窗口打开时，
    // 通常在应用程序中重新创建一个窗口
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 除了macOS外，当所有窗口都被关闭的时候退出程序
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
}) 