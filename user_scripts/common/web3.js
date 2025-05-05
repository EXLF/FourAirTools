/**
 * Web3工具模块
 * 提供与区块链交互的常用功能
 */
const { ethers } = require('ethers');
const http = require('./http');

/**
 * 创建一个JSON-RPC提供者
 * @param {string} rpcUrl - RPC节点URL
 * @param {Object} proxy - 可选的代理配置
 * @returns {ethers.JsonRpcProvider} RPC提供者
 */
function createProvider(rpcUrl, proxy = null) {
  // ethers默认没有代理支持，这里通过使用fetch函数覆盖来支持代理
  const fetchWithProxy = async (url, options) => {
    try {
      const response = await http.get(url, proxy, {
        method: options.method || 'GET',
        headers: options.headers || {},
        data: options.body || null,
        timeout: 30000
      });
      
      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        statusText: response.statusText,
        text: async () => JSON.stringify(response.data),
        json: async () => response.data
      };
    } catch (error) {
      throw new Error(`RPC请求失败: ${error.message}`);
    }
  };
  
  const networkOptions = {
    // 使用自定义fetch来支持代理
    staticNetwork: true,
    fetchFunc: proxy ? fetchWithProxy : undefined
  };
  
  return new ethers.JsonRpcProvider(rpcUrl, undefined, networkOptions);
}

/**
 * 获取钱包余额
 * @param {string} address - 钱包地址
 * @param {string} rpcUrl - RPC节点URL
 * @param {Object} proxy - 可选的代理配置
 * @returns {Promise<Object>} 余额信息
 */
async function getBalance(address, rpcUrl, proxy = null) {
  try {
    const provider = createProvider(rpcUrl, proxy);
    const balanceBigInt = await provider.getBalance(address);
    const balanceEther = ethers.formatEther(balanceBigInt);
    
    return {
      address,
      balance: balanceEther,
      balanceWei: balanceBigInt.toString(),
      error: null
    };
  } catch (error) {
    return {
      address,
      balance: null,
      balanceWei: null,
      error: error.message
    };
  }
}

/**
 * 创建钱包实例
 * @param {string} privateKey - 私钥
 * @returns {ethers.Wallet} 钱包实例
 */
function createWallet(privateKey) {
  return new ethers.Wallet(privateKey);
}

/**
 * 连接钱包到提供者
 * @param {ethers.Wallet} wallet - 钱包实例
 * @param {string} rpcUrl - RPC节点URL
 * @param {Object} proxy - 可选的代理配置
 * @returns {ethers.Wallet} 已连接提供者的钱包
 */
function connectWallet(wallet, rpcUrl, proxy = null) {
  const provider = createProvider(rpcUrl, proxy);
  return wallet.connect(provider);
}

/**
 * 发送交易
 * @param {ethers.Wallet} wallet - 已连接提供者的钱包
 * @param {string} to - 接收地址
 * @param {string|number} value - 发送金额(ETH)
 * @param {Object} options - 其他交易选项
 * @returns {Promise<Object>} 交易结果
 */
async function sendTransaction(wallet, to, value, options = {}) {
  try {
    // 准备交易参数
    const tx = {
      to,
      value: ethers.parseEther(value.toString()),
      ...options
    };
    
    // 发送交易
    const txResponse = await wallet.sendTransaction(tx);
    
    // 等待交易确认
    const receipt = await txResponse.wait();
    
    return {
      success: true,
      hash: txResponse.hash,
      receipt,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      hash: null,
      receipt: null,
      error: error.message
    };
  }
}

/**
 * 调用合约函数
 * @param {string} contractAddress - 合约地址
 * @param {Array} abi - 合约ABI
 * @param {string} method - 方法名
 * @param {Array} params - 方法参数
 * @param {ethers.Wallet|ethers.Provider} signerOrProvider - 签名者或提供者
 * @returns {Promise<any>} 调用结果
 */
async function callContract(contractAddress, abi, method, params = [], signerOrProvider) {
  try {
    // 创建合约实例
    const contract = new ethers.Contract(contractAddress, abi, signerOrProvider);
    
    // 判断是读取还是写入操作
    const isReadOperation = contract.interface.getFunction(method).constant;
    
    if (isReadOperation) {
      // 读取操作
      const result = await contract[method](...params);
      return {
        success: true,
        result,
        error: null
      };
    } else {
      // 写入操作
      const tx = await contract[method](...params);
      const receipt = await tx.wait();
      
      return {
        success: true,
        result: receipt,
        error: null
      };
    }
  } catch (error) {
    return {
      success: false,
      result: null,
      error: error.message
    };
  }
}

module.exports = {
  createProvider,
  getBalance,
  createWallet,
  connectWallet,
  sendTransaction,
  callContract
}; 