const bip39 = require('bip39');
const { hdkey } = require('ethereumjs-wallet');

/**
 * 从助记词生成钱包 (内部使用)
 * @param {string} mnemonic
 * @param {number} index - 钱包索引，用于生成派生路径
 * @returns {object | null} 钱包对象 { address, privateKey, mnemonic, path } 或 null
 */
function generateWalletFromMnemonicInternal(mnemonic, index) {
    try {
        if (!bip39.validateMnemonic(mnemonic)) {
            throw new Error('无效的助记词');
        }
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        const derivationPath = `m/44'/60'/0'/0/${index}`; // 标准路径
        const masterNode = hdkey.fromMasterSeed(seed);
        const childNode = masterNode.derivePath(derivationPath);
        const wallet = childNode.getWallet();

        const privateKey = wallet.getPrivateKey();
        const privateKeyHex = '0x' + privateKey.toString('hex');
        const address = wallet.getAddressString();

        return {
            address: address,
            privateKey: privateKeyHex,
            mnemonic: mnemonic,
            path: derivationPath
        };
    } catch (error) {
        console.error(`从助记词生成钱包失败 (Index ${index}):`, error);
        return null;
    }
}

/**
 * 生成指定数量的钱包。
 * @param {number} count - 要生成的钱包数量。
 * @param {number} [startIndex=0] - 起始派生索引。
 * @returns {Array<object | null>} 返回生成的钱包信息数组，失败则对应位置为 null。
 */
function generateWallets(count, startIndex = 0) {
    const wallets = [];
    for (let i = 0; i < count; i++) {
        const mnemonic = bip39.generateMnemonic();
        const index = startIndex + i;
        const walletInfo = generateWalletFromMnemonicInternal(mnemonic, index);
        wallets.push(walletInfo); // 将成功或失败的结果都加入数组
    }
    return wallets;
}

module.exports = {
    generateWallets,
    // 如果需要，也可以单独导出 generateWalletFromMnemonicInternal
}; 