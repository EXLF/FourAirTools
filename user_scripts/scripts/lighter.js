/**
 * Lighter脚本
 * 自动化与Lighter项目交互
 */
function getConfig() {
  return {
    id: "lighter",
    name: "Lighter",
    description: "自动化与Lighter项目交互",
    version: "1.0.0",
    author: "FourAir",
    category: "交易",
    icon: "fire",  // FontAwesome图标
    imageUrl: "https://public.rootdata.com/images/b6/1713439192844.jpg",
    requires: {
      wallets: true,  // 需要钱包
      proxy: false    // 不需要代理
    },
    platforms: ["Lighter"],
    config: {
      action: {
        type: "select",
        label: "操作类型",
        options: [
          { value: "trade", label: "交易" },
          { value: "stake", label: "质押" },
          { value: "claim", label: "领取奖励" },
          { value: "referral", label: "推荐奖励" }
        ],
        default: "trade"
      },
      amount: {
        type: "number",
        label: "数量",
        default: 0.1,
        min: 0.0001,
        depends: { action: ["trade", "stake"] }
      },
      tokenPair: {
        type: "select",
        label: "交易对",
        options: [
          { value: "eth_usdc", label: "ETH/USDC" },
          { value: "btc_usdc", label: "BTC/USDC" },
          { value: "lighter_usdc", label: "LIGHTER/USDC" },
          { value: "dai_usdc", label: "DAI/USDC" }
        ],
        default: "eth_usdc",
        depends: { action: "trade" }
      },
      referralCode: {
        type: "text",
        label: "推荐码",
        default: "",
        placeholder: "输入推荐码",
        depends: { action: "referral" }
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
  
  console.info("开始执行Lighter脚本");
  
  try {
    const action = config.action || "trade";
    const amount = config.amount || 0.1;
    const tokenPair = config.tokenPair || "eth_usdc";
    const referralCode = config.referralCode || "";
    const waitTime = config.waitTime || 30;
    const wallet = wallets[0]; // 获取第一个钱包
    
    if (!wallet) {
      throw new Error("没有可用的钱包");
    }
    
    console.info(`使用钱包: ${wallet.address}`);
    console.info(`执行操作: ${action}`);
    
    // 连接到Lighter
    console.info("连接到Lighter...");
    // 这里是连接代码
    
    switch (action) {
      case "trade":
        console.info(`执行交易操作，交易对: ${tokenPair}, 数量: ${amount}...`);
        // 这里是交易的代码
        break;
        
      case "stake":
        console.info(`执行质押操作，数量: ${amount}...`);
        // 这里是质押的代码
        break;
        
      case "claim":
        console.info("执行领取奖励操作...");
        // 这里是领取奖励的代码
        break;
        
      case "referral":
        if (!referralCode) {
          throw new Error("推荐奖励需要提供推荐码");
        }
        console.info(`执行推荐奖励操作，推荐码: ${referralCode}...`);
        // 这里是推荐奖励的代码
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