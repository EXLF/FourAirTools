const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron'); // 需要 app 模块获取 userData 路径

// --- 配置常量 (可以根据需要调整) ---
const KEY_LENGTH = 32; // 256 位密钥
const SALT_LENGTH = 16; // 128 位盐
const IV_LENGTH = 12; // GCM 推荐 12 字节 IV
const AUTH_TAG_LENGTH = 16; // GCM 标准认证标签长度 (128 位)
const PBKDF2_ITERATIONS = 600000; // PBKDF2 迭代次数 (高迭代次数增加安全性)
const PBKDF2_DIGEST = 'sha512'; // PBKDF2 使用的哈希算法
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const CONFIG_FILE_NAME = 'encryption.config.json';
const VERIFICATION_STRING = 'FourAirPasswordCheck'; // 用于验证密码是否正确的固定字符串

// --- 状态存储 ---
let sessionKey = null; // 解锁后存储在内存中的会话密钥
let loadedConfig = null; // 缓存加载的配置

/** 获取配置文件的完整路径 */
function getConfigFilePath() {
    if (!app) {
        console.error('[CryptoService] Electron app module is not available. Cannot get user data path.');
        // 在非主进程调用时可能发生，或者初始化顺序问题
        // 可以考虑在主进程中获取路径并传递给这个模块
        throw new Error('无法获取用户数据目录');
    }
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, CONFIG_FILE_NAME);
}

/**
 * 加载加密配置 (盐、迭代次数和验证字符串)。
 * @returns {Promise<{salt: Buffer, iterations: number, encryptedVerification: string}>} 加载的配置。
 * @throws {Error} 如果配置文件不存在或格式无效。
 */
async function loadConfig() {
    if (loadedConfig) return loadedConfig; // 返回缓存

    const filePath = getConfigFilePath();
    try {
        console.log(`[CryptoService] Loading config from: ${filePath}`);
        const fileContent = await fs.readFile(filePath, 'utf8');
        const config = JSON.parse(fileContent);

        if (!config.salt || typeof config.iterations !== 'number' || !config.encryptedVerification) {
            throw new Error('配置文件格式无效 (缺少 salt, iterations 或 encryptedVerification)');
        }

        const salt = Buffer.from(config.salt, 'base64');
        if (salt.length !== SALT_LENGTH) {
            throw new Error(`配置文件中的盐长度无效 (应为 ${SALT_LENGTH}, 实际为 ${salt.length})`);
        }

        loadedConfig = { 
            salt, 
            iterations: config.iterations,
            encryptedVerification: config.encryptedVerification 
        };
        console.log('[CryptoService] Config loaded successfully.');
        return loadedConfig;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[CryptoService] Encryption config file not found.');
            throw new Error('配置文件不存在'); // 特定错误类型，方便上层判断
        } else {
            console.error('[CryptoService] Failed to load or parse config file:', error);
            throw new Error('加载配置文件失败');
        }
    }
}

/**
 * 保存加密配置 (盐、迭代次数和加密后的验证字符串) 到文件。
 * @param {Buffer} salt - 要保存的盐。
 * @param {number} iterations - PBKDF2 迭代次数。
 * @param {string} encryptedVerification - 加密后的验证字符串。
 * @returns {Promise<void>}
 */
async function saveConfig(salt, iterations, encryptedVerification) {
    if (!salt || salt.length !== SALT_LENGTH || typeof iterations !== 'number' || !encryptedVerification) {
        throw new Error('无效的盐、迭代次数或验证字符串，无法保存配置');
    }
    const config = {
        salt: salt.toString('base64'),
        iterations: iterations,
        encryptedVerification: encryptedVerification
    };
    const filePath = getConfigFilePath();
    try {
        await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
        loadedConfig = { salt, iterations, encryptedVerification };
        console.log(`[CryptoService] Config saved successfully to: ${filePath}`);
    } catch (error) {
        console.error('[CryptoService] Failed to save config file:', error);
        throw new Error('保存配置文件失败');
    }
}

/**
 * 检查加密配置是否已存在。
 * @returns {Promise<boolean>} 如果配置已存在则返回 true。
 */
async function isConfigured() {
    try {
        await loadConfig(); // 尝试加载，如果成功则表示已配置
        return true;
    } catch (error) {
        // 只关心文件不存在的错误，其他错误认为是异常
        if (error.message === '配置文件不存在') {
            return false;
        }
        // 对于其他加载错误 (如格式错误)，我们可能需要特殊处理，这里暂时视为未配置
        console.error('[CryptoService] Error checking configuration state:', error);
        return false;
    }
}

/**
 * 生成一个新的随机盐。
 * @returns {Buffer} 新生成的盐值 (Buffer 格式)。
 */
function generateSalt() {
    return crypto.randomBytes(SALT_LENGTH);
}

/**
 * 使用 PBKDF2 从密码和盐派生加密密钥。
 * @param {string} password - 用户主密码。
 * @param {Buffer} salt - 用于派生的盐值。
 * @returns {Promise<Buffer>} 派生出的加密密钥 (Buffer 格式)。
 */
function deriveKey(password, salt) {
    return new Promise((resolve, reject) => {
        if (!password || !salt) {
            return reject(new Error('密码和盐不能为空'));
        }
        crypto.pbkdf2(
            password,
            salt,
            PBKDF2_ITERATIONS,
            KEY_LENGTH,
            PBKDF2_DIGEST,
            (err, derivedKey) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(derivedKey);
                }
            }
        );
    });
}

/**
 * 使用 AES-256-GCM 加密文本。
 * @param {string} plainText - 需要加密的明文字符串。
 * @param {Buffer} key - 用于加密的 256 位密钥 (Buffer 格式)。
 * @returns {string} 加密后的数据，格式为 "iv:authTag:encryptedText"，Base64 编码。
 * @throws {Error} 如果加密失败。
 */
function encrypt(plainText, key) {
    if (!plainText || !key) {
        throw new Error('明文和密钥不能为空');
    }
    if (key.length !== KEY_LENGTH) {
        throw new Error(`密钥长度必须为 ${KEY_LENGTH} 字节`);
    }

    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

        let encrypted = cipher.update(plainText, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        const authTag = cipher.getAuthTag();

        // 组合 IV, Auth Tag 和密文，用 : 分隔，然后 Base64 编码整个字符串
        // 注意：Buffer 转 Base64
        const combined = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
        // console.log('[Encrypt] IV(b64):', iv.toString('base64'));
        // console.log('[Encrypt] Tag(b64):', authTag.toString('base64'));
        // console.log('[Encrypt] Encrypted(b64):', encrypted);
        // console.log('[Encrypt] Combined:', combined);
        return combined; // 直接返回组合字符串

    } catch (error) {
        console.error('加密失败:', error);
        throw new Error('加密过程中发生错误');
    }
}

/**
 * 解密 AES-256-GCM 加密的数据。
 * @param {string} encryptedData - 格式为 "iv_base64:authTag_base64:encryptedText_base64" 的加密字符串。
 * @param {Buffer} key - 用于解密的 256 位密钥 (Buffer 格式)。
 * @returns {string} 解密后的明文字符串。
 * @throws {Error} 如果解密或认证失败，或密钥/数据无效。
 */
function decrypt(encryptedData, key) {
    if (!encryptedData || !key) {
        throw new Error('加密数据和密钥不能为空');
    }
     if (key.length !== KEY_LENGTH) {
        throw new Error(`密钥长度必须为 ${KEY_LENGTH} 字节`);
    }

    try {
        // console.log('[Decrypt] Received Combined:', encryptedData);
        const parts = encryptedData.split(':');
        if (parts.length !== 3) {
            // console.error('[Decrypt] Invalid format: Expected 3 parts, got', parts.length);
            throw new Error('无效的加密数据格式 (缺少 : 分隔符)');
        }

        const iv = Buffer.from(parts[0], 'base64');
        const authTag = Buffer.from(parts[1], 'base64');
        const encryptedText = parts[2]; // 密文已经是 Base64 了

        // console.log('[Decrypt] IV(b64):', parts[0], 'Length:', iv.length);
        // console.log('[Decrypt] Tag(b64):', parts[1], 'Length:', authTag.length);
        // console.log('[Decrypt] Encrypted(b64):', encryptedText);

        if (iv.length !== IV_LENGTH) {
             throw new Error(`无效的 IV 长度，应为 ${IV_LENGTH}，实际为 ${iv.length}`);
        }
        if (authTag.length !== AUTH_TAG_LENGTH) {
             throw new Error(`无效的认证标签长度，应为 ${AUTH_TAG_LENGTH}，实际为 ${authTag.length}`);
        }


        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;

    } catch (error) {
        console.error('解密失败:', error);
        // 区分认证失败和其他错误
        if (error.message.toLowerCase().includes('unsupported state or unable to authenticate data')) {
            throw new Error('数据认证失败，可能已被篡改或密钥错误');
        }
        throw new Error('解密过程中发生错误');
    }
}

// --- 会话管理和简化接口 ---

/**
 * 设置当前会话的加密密钥。
 * @param {Buffer} key - 派生出的密钥。
 */
function setSessionKey(key) {
    if (key && key.length === KEY_LENGTH) {
        sessionKey = key;
        console.log('[CryptoService] 会话密钥已设置。');
    } else {
        console.error('[CryptoService] 尝试设置无效的会话密钥。');
        sessionKey = null;
    }
}

/** 清除当前会话密钥 (锁定应用时调用) */
function clearSessionKey() {
    sessionKey = null;
    console.log('[CryptoService] 会话密钥已清除 (应用已锁定)。');
}

/** 检查应用当前是否已解锁 */
function isUnlocked() {
    return sessionKey !== null;
}

/**
 * 使用当前会话密钥加密数据。
 * @param {string} plainText
 * @returns {string} Encrypted data string.
 * @throws {Error} If app is not unlocked.
 */
function encryptWithSessionKey(plainText) {
    if (!isUnlocked()) {
        throw new Error('应用未解锁，无法加密数据');
    }
    return encrypt(plainText, sessionKey);
}

/**
 * 使用当前会话密钥解密数据。
 * @param {string} encryptedData
 * @returns {string} Decrypted text.
 * @throws {Error} If app is not unlocked or decryption fails.
 */
function decryptWithSessionKey(encryptedData) {
    if (!isUnlocked()) {
        throw new Error('应用未解锁，无法解密数据');
    }
    // 允许解密空字符串或 null/undefined (直接返回)
    if (!encryptedData) {
        return encryptedData;
    }
    return decrypt(encryptedData, sessionKey);
}

/**
 * 使用提供的密码尝试解锁应用
 * 加载配置，派生密钥，并尝试解密验证字符串以确认密码正确性。
 * @param {string} password - 用户输入的主密码。
 * @returns {Promise<Buffer|null>} 如果解锁成功，返回派生的密钥 (Buffer)；否则返回 null 或抛出错误。
 * @throws {Error} 如果加载配置失败或解密时发生内部错误。
 */
async function unlockWithPassword(password) {
    if (!password) {
        throw new Error('密码不能为空');
    }

    try {
        // 1. 加载配置 (包括加密的验证字符串)
        const config = await loadConfig();
        if (!config || !config.salt || !config.iterations || !config.encryptedVerification) {
            throw new Error('无法加载有效的加密配置');
        }

        // 2. 使用输入密码和加载的盐派生密钥
        const derivedKey = await deriveKey(password, config.salt);

        // 3. 尝试使用派生的密钥解密验证字符串
        let decryptedVerification = '';
        try {
            decryptedVerification = decrypt(config.encryptedVerification, derivedKey);
        } catch (decryptionError) {
            // 解密失败通常意味着密码错误 (或者数据被篡改)
            console.warn('[CryptoService] Failed to decrypt verification string:', decryptionError.message);
            // 不需要向上抛出，因为我们要返回验证失败的结果
            return null; // 表示密码不正确
        }

        // 4. 比较解密后的字符串与原始验证字符串
        if (decryptedVerification === VERIFICATION_STRING) {
            // 密码正确！设置会话密钥
            setSessionKey(derivedKey);
            console.log('[CryptoService] 密码验证成功，应用已解锁。');
            return derivedKey; // 返回密钥，表示成功
        } else {
            // 解密成功但内容不匹配 (理论上不太可能，除非 VERIFICATION_STRING 变了)
            console.error('[CryptoService] Verification string mismatch after decryption! This should not happen.');
            return null; // 表示密码不正确
        }

    } catch (error) {
        console.error('[CryptoService] Error during unlock process:', error);
        // 区分配置加载错误和其他错误
        if (error.message === '配置文件不存在') {
           throw error; // 重新抛出，让上层知道需要设置密码
        }
        throw new Error(`解锁过程中发生错误: ${error.message}`);
    }
}

module.exports = {
    // 配置管理
    loadConfig,
    saveConfig,
    isConfigured,
    PBKDF2_ITERATIONS, // 导出供保存配置
    VERIFICATION_STRING, // 导出验证字符串常量 (虽然内部用，导出可能有用)
    // 核心操作
    generateSalt,
    deriveKey,
    encrypt,
    decrypt,
    // 会话管理
    unlockWithPassword, // *** 新增导出 ***
    setSessionKey,
    clearSessionKey,
    isUnlocked,
    // 便捷接口
    encryptWithSessionKey,
    decryptWithSessionKey,
    // 导出常量供参考
    SALT_LENGTH,
    IV_LENGTH,
    AUTH_TAG_LENGTH
}; 