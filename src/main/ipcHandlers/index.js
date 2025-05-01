// 添加清除Discord会话的处理器
ipcMain.on('clear-discord-session', async (event) => {
    try {
        const { session } = require('electron');
        if (session) {
            await session.fromPartition('persist:discord').clearStorageData();
            console.log('Discord session data cleared successfully');
            event.reply('clear-discord-session-reply', { success: true });
        } else {
            console.error('Session module not available');
            event.reply('clear-discord-session-reply', { 
                success: false, 
                error: 'Session module not available' 
            });
        }
    } catch (error) {
        console.error('Error clearing Discord session data:', error);
        event.reply('clear-discord-session-reply', { 
            success: false, 
            error: error.message || 'Unknown error' 
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