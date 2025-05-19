/**
 * Sui脚本
 * 自动化与Sui链和生态系统交互
 */
function getConfig() {
  return {
    id: "sui",
    name: "Sui SUI",
    description: "自动化与Sui链和生态系统交互",
    version: "1.0.0",
    author: "FourAir",
    category: "公链",
    icon: "water",  // FontAwesome图标
    imageUrl: "https://public.rootdata.com/images/b6/1744523743365.jpg",
    requires: {
      wallets: true,  // 需要钱包
      proxy: false    // 不需要代理
    },
    platforms: ["Sui"],
    config: {
      action: {
        type: "select",
        label: "操作类型",
        options: [
          { value: "stake", label: "质押SUI" },
          { value: "claim", label: "领取奖励" },
          { value: "transfer", label: "转账" },
          { value: "mint", label: "铸造NFT" }
        ],
        default: "stake"
      },
      amount: {
        type: "number",
        label: "数量",
        default: 1,
        min: 0.01,
        depends: { action: ["stake", "transfer"] }
      },
      recipient: {
        type: "text",
        label: "接收地址",
        default: "",
        placeholder: "0x...",
        depends: { action: "transfer" }
      },
      validator: {
        type: "text",
        label: "验证者地址",
        default: "",
        placeholder: "0x...",
        depends: { action: "stake" }
      },
      nftCollection: {
        type: "text",
        label: "NFT集合地址",
        default: "",
        placeholder: "0x...",
        depends: { action: "mint" }
      },
      waitTime: {
        type: "number",
        label: "等待时间(秒)",
        default: 30,
        min: 10,
        max: 120
      }
    }
  };
}

// 执行函数
async function main(context) {
  const { config, wallets, utils, web3 } = context;
  
  console.info("开始执行Sui脚本");
  
  try {
    const action = config.action || "stake";
    const amount = config.amount || 1;
    const recipient = config.recipient || "";
    const validator = config.validator || "";
    const nftCollection = config.nftCollection || "";
    const waitTime = config.waitTime || 30;
    const wallet = wallets[0]; // 获取第一个钱包
    
    if (!wallet) {
      throw new Error("没有可用的钱包");
    }
    
    console.info(`使用钱包: ${wallet.address}`);
    console.info(`执行操作: ${action}`);
    
    // 连接到Sui
    console.info("连接到Sui网络...");
    // 这里是连接代码
    
    switch (action) {
      case "stake":
        if (!validator) {
          throw new Error("质押SUI需要提供验证者地址");
        }
        console.info(`执行质押SUI操作，验证者: ${validator}, 数量: ${amount}...`);
        // 这里是质押SUI的代码
        break;
        
      case "claim":
        console.info("执行领取奖励操作...");
        // 这里是领取奖励的代码
        break;
        
      case "transfer":
        if (!recipient) {
          throw new Error("转账需要提供接收地址");
        }
        console.info(`执行转账操作，接收地址: ${recipient}, 数量: ${amount}...`);
        // 这里是转账的代码
        break;
        
      case "mint":
        if (!nftCollection) {
          throw new Error("铸造NFT需要提供NFT集合地址");
        }
        console.info(`执行铸造NFT操作，NFT集合: ${nftCollection}...`);
        // 这里是铸造NFT的代码
        break;
        
      default:
        throw new Error(`不支持的操作: ${action}`);
    }
    
    console.info(`等待操作完成，超时时间: ${waitTime}秒...`);
    // 这里是等待操作完成的代码
    
    console.success("操作成功完成");
    return { success: true };
  } catch (error) {
    console.error(`操作失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = { getConfig, main }; 