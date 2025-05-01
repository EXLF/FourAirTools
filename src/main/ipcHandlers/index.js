// 添加清除Discord会话的处理器
ipcMain.on('clear-discord-session', (event) => {
    try {
        // 尝试清除Discord会话存储的数据
        const session = electron.session.fromPartition('persist:discord');
        session.clearStorageData()
            .then(() => {
                console.log('Discord session data cleared');
                event.reply('clear-discord-session-reply', { success: true });
            })
            .catch((error) => {
                console.error('Error clearing Discord session data:', error);
                event.reply('clear-discord-session-reply', { 
                    success: false,
                    error: error.message
                });
            });
    } catch (error) {
        console.error('Error in clear-discord-session handler:', error);
        event.reply('clear-discord-session-reply', { 
            success: false,
            error: error.message
        });
    }
});

// 清除X（推特）会话数据
ipcMain.on('clear-x-session', (event) => {
    try {
        // 尝试清除X平台会话存储的数据
        const session = electron.session.fromPartition('persist:x-twitter');
        session.clearStorageData()
            .then(() => {
                console.log('X platform session data cleared');
                event.reply('clear-x-session-reply', { success: true });
            })
            .catch((error) => {
                console.error('Error clearing X platform session data:', error);
                event.reply('clear-x-session-reply', { 
                    success: false,
                    error: error.message
                });
            });
    } catch (error) {
        console.error('Error in clear-x-session handler:', error);
        event.reply('clear-x-session-reply', { 
            success: false,
            error: error.message
        });
    }
});

// 添加打开外部URL的处理器
ipcMain.on('open-external-url', (event, url) => {
    try {
        const { shell } = require('electron');
        console.log(`Opening external URL: ${url}`);
        shell.openExternal(url);
    } catch (error) {
        console.error('Error opening external URL:', error);
    }
}); 