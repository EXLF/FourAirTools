const { app, net } = require('electron');
const fs = require('fs').promises; // 使用 fs.promises API
const fsSync = require('fs'); // 同步 fs 用于某些检查
const path = require('path');
const crypto = require('crypto');

// API Host Configuration
const IS_DEV = process.env.NODE_ENV === 'development';
const API_HOST = IS_DEV ? 'http://localhost:3001' : 'http://106.75.5.215:3001'; // 根据您的实际生产API调整

const USER_SCRIPTS_DIR = path.join(app.getPath('userData'), 'user_scripts', 'scripts'); // 目标脚本目录
const LOCAL_MANIFEST_PATH = path.join(app.getPath('userData'), 'user_scripts', 'scripts_local_manifest.json');

// 确保 user_scripts/scripts 目录存在
async function ensureUserScriptsDirExists() {
  try {
    await fs.mkdir(USER_SCRIPTS_DIR, { recursive: true });
    console.log(`[ScriptUpdater] User scripts directory ensured: ${USER_SCRIPTS_DIR}`);
  } catch (error) {
    console.error('[ScriptUpdater] Error ensuring user scripts directory exists:', error);
    throw error; // 抛出错误，调用者需要处理
  }
}

async function calculateFileChecksum(filePath) {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  } catch (error) {
    console.error(`[ScriptUpdater] Error calculating checksum for ${filePath}:`, error);
    return null; // 发生错误时返回 null
  }
}

async function fetchRemoteManifest() {
  const url = `${API_HOST}/api/scripts/manifest`;
  console.log(`[ScriptUpdater] Fetching remote manifest from: ${url}`);
  return new Promise((resolve, reject) => {
    const request = net.request(url);
    let body = '';
    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        console.error(`[ScriptUpdater] Error fetching remote manifest. Status: ${response.statusCode}`);
        return reject(new Error(`Failed to fetch remote manifest, status: ${response.statusCode}`));
      }
      response.on('data', (chunk) => {
        body += chunk.toString();
      });
      response.on('end', () => {
        try {
          const manifest = JSON.parse(body);
          console.log('[ScriptUpdater] Remote manifest fetched successfully.');
          resolve(manifest);
        } catch (e) {
          console.error('[ScriptUpdater] Error parsing remote manifest:', e);
          reject(new Error('Failed to parse remote manifest'));
        }
      });
    });
    request.on('error', (error) => {
      console.error('[ScriptUpdater] Network error fetching remote manifest:', error);
      reject(error);
    });
    request.end();
  });
}

async function loadLocalManifest() {
  try {
    if (!fsSync.existsSync(LOCAL_MANIFEST_PATH)) {
      console.log('[ScriptUpdater] Local manifest not found, returning empty.');
      return {}; // 如果文件不存在，返回空对象
    }
    const data = await fs.readFile(LOCAL_MANIFEST_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[ScriptUpdater] Error loading local manifest:', error);
    return {}; // 出错时也返回空对象，将视为无本地脚本
  }
}

async function saveLocalManifest(manifest) {
  try {
    // 确保包含 local manifest 的目录存在
    await fs.mkdir(path.dirname(LOCAL_MANIFEST_PATH), { recursive: true });
    await fs.writeFile(LOCAL_MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
    console.log('[ScriptUpdater] Local manifest saved.');
  } catch (error) {
    console.error('[ScriptUpdater] Error saving local manifest:', error);
  }
}

async function downloadScript(filename, destinationPath) {
  const url = `${API_HOST}/api/scripts/download/${filename}`;
  console.log(`[ScriptUpdater] Downloading script: ${filename} from ${url}`);
  return new Promise((resolve, reject) => {
    const request = net.request(url);
    const chunks = [];

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        console.error(`[ScriptUpdater] Error downloading script ${filename}. Status: ${response.statusCode}`);
        return reject(new Error(`Failed to download ${filename}, status: ${response.statusCode}`));
      }
      response.on('data', (chunk) => {
        chunks.push(chunk);
      });
      response.on('end', async () => {
        try {
          const scriptContent = Buffer.concat(chunks);
          await fs.writeFile(destinationPath, scriptContent);
          console.log(`[ScriptUpdater] Script ${filename} downloaded and saved to ${destinationPath}`);
          resolve();
        } catch (e) {
          console.error(`[ScriptUpdater] Error saving script ${filename}:`, e);
          reject(e);
        }
      });
    });
    request.on('error', (error) => {
      console.error(`[ScriptUpdater] Network error downloading script ${filename}:`, error);
      reject(error);
    });
    request.end();
  });
}

/**
 * 清理本地脚本缓存
 * 删除所有本地脚本文件和manifest，强制从服务器重新下载
 * @param {boolean} keepManifest - 是否保留manifest文件（默认false，完全清理）
 * @returns {Promise<Object>} 清理结果
 */
async function clearLocalCache(keepManifest = false) {
  console.log('[ScriptUpdater] 开始清理本地脚本缓存...');
  
  try {
    const cleanupResults = {
      deletedFiles: [],
      deletedManifest: false,
      errors: [],
      totalCleaned: 0
    };

    // 确保目录存在
    await ensureUserScriptsDirExists();

    // 清理脚本文件
    try {
      if (fsSync.existsSync(USER_SCRIPTS_DIR)) {
        const files = await fs.readdir(USER_SCRIPTS_DIR);
        
        for (const file of files) {
          if (file.endsWith('.js')) {
            const filePath = path.join(USER_SCRIPTS_DIR, file);
            try {
              await fs.unlink(filePath);
              cleanupResults.deletedFiles.push(file);
              cleanupResults.totalCleaned++;
              console.log(`[ScriptUpdater] 已删除脚本文件: ${file}`);
            } catch (deleteError) {
              console.error(`[ScriptUpdater] 删除脚本文件失败: ${file}`, deleteError);
              cleanupResults.errors.push({
                file,
                error: deleteError.message,
                type: 'file_deletion'
              });
            }
          }
        }
      }
    } catch (readDirError) {
      console.error('[ScriptUpdater] 读取脚本目录失败:', readDirError);
      cleanupResults.errors.push({
        error: readDirError.message,
        type: 'directory_read'
      });
    }

    // 清理manifest文件（如果需要）
    if (!keepManifest) {
      try {
        if (fsSync.existsSync(LOCAL_MANIFEST_PATH)) {
          await fs.unlink(LOCAL_MANIFEST_PATH);
          cleanupResults.deletedManifest = true;
          cleanupResults.totalCleaned++;
          console.log('[ScriptUpdater] 已删除本地manifest文件');
        }
      } catch (manifestError) {
        console.error('[ScriptUpdater] 删除manifest文件失败:', manifestError);
        cleanupResults.errors.push({
          error: manifestError.message,
          type: 'manifest_deletion'
        });
      }
    }

    console.log(`[ScriptUpdater] 缓存清理完成，共清理 ${cleanupResults.totalCleaned} 个文件`);
    
    return {
      success: true,
      message: `成功清理 ${cleanupResults.totalCleaned} 个缓存文件`,
      data: cleanupResults
    };

  } catch (error) {
    console.error('[ScriptUpdater] 清理本地缓存失败:', error);
    return {
      success: false,
      error: error.message,
      data: { deletedFiles: [], errors: [{ error: error.message, type: 'critical' }] }
    };
  }
}

async function checkForUpdates(options = {}) {
  const { forceRefresh = false, clearCache = false } = options;
  
  console.log('[ScriptUpdater] Checking for script updates...', { forceRefresh, clearCache });
  
  try {
    await ensureUserScriptsDirExists(); // 确保目录存在

    // 如果需要清理缓存，先执行清理
    let cacheCleanupResult = null;
    if (clearCache) {
      console.log('[ScriptUpdater] 执行缓存清理...');
      cacheCleanupResult = await clearLocalCache(false); // 完全清理，包括manifest
      
      if (!cacheCleanupResult.success) {
        console.warn('[ScriptUpdater] 缓存清理失败，但继续执行更新:', cacheCleanupResult.error);
      } else {
        console.log(`[ScriptUpdater] 缓存清理成功: ${cacheCleanupResult.message}`);
      }
    }

    const remoteManifestData = await fetchRemoteManifest();
    const localManifest = await loadLocalManifest();

    if (!remoteManifestData || !remoteManifestData.scripts || !Array.isArray(remoteManifestData.scripts)) {
      console.warn('[ScriptUpdater] Invalid or empty remote manifest received, or scripts array is missing.');
      return { 
        updatesFound: false, 
        updatedScripts: [], 
        errors: [{ message: 'Invalid remote manifest format' }],
        cacheCleanup: cacheCleanupResult
      };
    }

    const remoteScripts = remoteManifestData.scripts;
    const updatedScriptsInfo = [];
    const downloadPromises = [];
    let manifestChanged = false;

    // 处理已删除的脚本
    if (remoteManifestData.deletedScripts && Array.isArray(remoteManifestData.deletedScripts)) {
      console.log(`[ScriptUpdater] Found ${remoteManifestData.deletedScripts.length} deleted scripts to process`);
      for (const deletedScript of remoteManifestData.deletedScripts) {
        if (!deletedScript.id || !deletedScript.filename || !deletedScript.isDeleted) {
          continue; // 跳过无效的删除记录
        }
        
        // 检查这个脚本是否存在于本地清单中
        if (localManifest[deletedScript.id]) {
          const scriptFilePath = path.join(USER_SCRIPTS_DIR, deletedScript.filename);
          
          // 删除本地脚本文件
          try {
            if (fsSync.existsSync(scriptFilePath)) {
              await fs.unlink(scriptFilePath);
              console.log(`[ScriptUpdater] Deleted local script file: ${deletedScript.filename}`);
              updatedScriptsInfo.push({ 
                name: deletedScript.name || deletedScript.id, 
                status: 'deleted',
                deletedAt: deletedScript.deletedAt 
              });
            }
            
            // 从本地清单中移除记录
            delete localManifest[deletedScript.id];
            manifestChanged = true;
            console.log(`[ScriptUpdater] Removed deleted script from local manifest: ${deletedScript.name || deletedScript.id}`);
          } catch (deleteError) {
            console.error(`[ScriptUpdater] Error deleting local script ${deletedScript.filename}:`, deleteError);
            updatedScriptsInfo.push({ 
              name: deletedScript.name || deletedScript.id, 
              status: 'delete_error', 
              error: deleteError.message 
            });
          }
        }
      }
    }

    // 原有的下载/更新逻辑继续
    for (const remoteScript of remoteScripts) {
      if (!remoteScript || !remoteScript.id || !remoteScript.filename || !remoteScript.checksum) {
        console.warn('[ScriptUpdater] Skipping invalid remote script entry:', remoteScript);
        continue;
      }
      const localScriptInfo = localManifest[remoteScript.id];
      const scriptFilePath = path.join(USER_SCRIPTS_DIR, remoteScript.filename);
      let needsDownload = false;

      if (!localScriptInfo) {
        console.log(`[ScriptUpdater] New script found: ${remoteScript.name} (${remoteScript.filename})`);
        needsDownload = true;
      } else if (forceRefresh || localScriptInfo.version !== remoteScript.version || localScriptInfo.checksum !== remoteScript.checksum) {
        if (forceRefresh) {
          console.log(`[ScriptUpdater] Force refresh enabled, redownloading: ${remoteScript.name}`);
        } else {
          console.log(`[ScriptUpdater] Update found for script: ${remoteScript.name} (Local: v${localScriptInfo.version}, Remote: v${remoteScript.version})`);
          if (localScriptInfo.checksum !== remoteScript.checksum) {
             console.log(`[ScriptUpdater] Checksum mismatch for ${remoteScript.name}. Local: ${localScriptInfo.checksum}, Remote: ${remoteScript.checksum}`);
          }
        }
        needsDownload = true;
      } else {
        if (!fsSync.existsSync(scriptFilePath)) {
            console.log(`[ScriptUpdater] Local script file missing for ${remoteScript.name}, redownloading.`);
            needsDownload = true;
        } else {
            const currentLocalFileChecksum = await calculateFileChecksum(scriptFilePath);
            if (currentLocalFileChecksum !== localScriptInfo.checksum) {
                console.log(`[ScriptUpdater] Local file for ${remoteScript.name} seems tampered or corrupted. Checksum mismatch with local manifest. Redownloading.`);
                needsDownload = true;
            }
        }
      }
      
      if (needsDownload) {
        downloadPromises.push(
          (async () => {
            try {
              await downloadScript(remoteScript.filename, scriptFilePath);
              const downloadedFileChecksum = await calculateFileChecksum(scriptFilePath);

              if (downloadedFileChecksum === remoteScript.checksum) {
                localManifest[remoteScript.id] = {
                  id: remoteScript.id,
                  name: remoteScript.name,
                  version: remoteScript.version,
                  filename: remoteScript.filename,
                  checksum: remoteScript.checksum,
                  lastDownloaded: new Date().toISOString(),
                };
                manifestChanged = true;
                const status = forceRefresh ? 'force_updated' : (localScriptInfo ? 'updated' : 'new');
                updatedScriptsInfo.push({ name: remoteScript.name, version: remoteScript.version, status });
                console.log(`[ScriptUpdater] Successfully updated/downloaded script: ${remoteScript.name}`);
              } else {
                console.error(`[ScriptUpdater] Checksum mismatch for downloaded script ${remoteScript.filename}. Expected ${remoteScript.checksum}, got ${downloadedFileChecksum}. Deleting downloaded file.`);
                if (fsSync.existsSync(scriptFilePath)) {
                    await fs.unlink(scriptFilePath).catch(e => console.error(`Error deleting corrupted file ${scriptFilePath}`, e));
                }
                updatedScriptsInfo.push({ name: remoteScript.name, status: 'checksum_error' });
              }
            } catch (downloadError) {
              console.error(`[ScriptUpdater] Error processing script ${remoteScript.name}:`, downloadError);
              updatedScriptsInfo.push({ name: remoteScript.name, status: 'download_error', error: downloadError.message });
            }
          })()
        );
      }
    }
    
    await Promise.all(downloadPromises);

    if (manifestChanged) {
      await saveLocalManifest(localManifest);
    }
    
    const summary = {
        updatesFound: updatedScriptsInfo.length > 0,
        processedScripts: updatedScriptsInfo,
        errors: updatedScriptsInfo.filter(s => s.status && s.status.includes('error')),
        cacheCleanup: cacheCleanupResult,
        forceRefresh,
        clearCache
    };
    console.log('[ScriptUpdater] Update check finished.', summary);
    return summary;

  } catch (error) {
    console.error('[ScriptUpdater] Critical error during update check:', error);
    return { 
      updatesFound: false, 
      updatedScripts: [], 
      errors: [{ message: error.message || 'Unknown critical error' }],
      cacheCleanup: null
    };
  }
}

module.exports = {
  checkForUpdates,
  clearLocalCache,
  syncScripts: checkForUpdates // 导出另一个名称以便更语义化的调用
}; 