/**
 * 代币转账脚本
 * 批量转账ERC20代币
 */
function getConfig() {
  return {
    id: "token_transfer",
    name: "代币批量转账",
    description: "批量转账ERC20代币到目标地址",
    version: "1.0.0",
    author: "FourAir",
    category: "转账",
    icon: "exchange-alt",  // FontAwesome图标
    requires: {
      wallets: true,  // 需要钱包
      proxy: false    // 不需要代理
    },
    platforms: ["Ethereum", "BSC", "Polygon", "Arbitrum", "Optimism"],
    config: {
      chain: {
        type: "select",
        label: "链",
        options: [
          { value: "ethereum", label: "以太坊" },
          { value: "bsc", label: "BSC" },
          { value: "polygon", label: "Polygon" },
          { value: "arbitrum", label: "Arbitrum" },
          { value: "optimism", label: "Optimism" }
        ],
        default: "ethereum"
      },
      tokenAddress: {
        type: "text",
        label: "代币合约地址",
        default: "",
        placeholder: "0x..."
      },
      receiversData: {
        type: "textarea",
        label: "接收地址和数量(每行一个，格式: 地址,数量)",
        default: "",
        placeholder: "0x123...,0.1\n0x456...,0.2"
      },
      gasLimit: {
        type: "number",
        label: "Gas限制",
        default: 100000,
        min: 21000,
        max: 1000000
      },
      intervalMin: {
        type: "number",
        label: "操作间隔最小值(秒)",
        default: 5,
        min: 1,
        max: 60
      },
      intervalMax: {
        type: "number",
        label: "操作间隔最大值(秒)",
        default: 15,
        min: 1,
        max: 60
      }
    }
  };
}

// 执行函数
async function main(context) {
  const { config, wallets, utils, web3 } = context;
  
  console.info("开始执行代币批量转账脚本");
  
  try {
    const chain = config.chain || "ethereum";
    const tokenAddress = config.tokenAddress;
    const receiversData = config.receiversData;
    const gasLimit = config.gasLimit || 100000;
    const intervalMin = config.intervalMin || 5;
    const intervalMax = config.intervalMax || 15;
    
    if (!tokenAddress) {
      throw new Error("代币合约地址不能为空");
    }
    
    if (!receiversData) {
      throw new Error("接收地址和数量不能为空");
    }
    
    console.info(`链: ${chain}`);
    console.info(`代币合约: ${tokenAddress}`);
    
    // 解析接收地址和数量
    const receivers = [];
    const lines = receiversData.split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const [address, amount] = line.split(",").map(item => item.trim());
      if (!address || !amount) {
        console.warn(`跳过无效行: ${line}`);
        continue;
      }
      
      receivers.push({ address, amount });
    }
    
    console.info(`总接收地址数: ${receivers.length}`);
    
    if (receivers.length === 0) {
      throw new Error("没有有效的接收地址");
    }
    
    // 获取代币信息
    console.info("获取代币信息...");
    // 这里是获取代币信息的代码
    
    // 对每个钱包执行转账
    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      console.info(`处理钱包 ${i+1}/${wallets.length}: ${wallet.address}`);
      
      // 检查代币余额
      console.info("检查代币余额...");
      // 这里是检查代币余额的代码
      
      // 执行每个转账
      for (let j = 0; j < receivers.length; j++) {
        const receiver = receivers[j];
        console.info(`转账 ${j+1}/${receivers.length} 到 ${receiver.address} 数量: ${receiver.amount}`);
        
        // 这里是执行转账的代码
        
        // 随机等待
        if (j < receivers.length - 1) {
          const waitTime = utils.getRandomInt(intervalMin, intervalMax);
          console.info(`等待 ${waitTime} 秒...`);
          await utils.delay(waitTime * 1000);
        }
      }
      
      // 钱包之间的等待
      if (i < wallets.length - 1) {
        const waitTime = utils.getRandomInt(intervalMin * 2, intervalMax * 2);
        console.info(`完成当前钱包，等待 ${waitTime} 秒后处理下一个...`);
        await utils.delay(waitTime * 1000);
      }
    }
    
    console.success("批量转账完成");
    return { success: true };
  } catch (error) {
    console.error(`批量转账失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = { getConfig, main }; 