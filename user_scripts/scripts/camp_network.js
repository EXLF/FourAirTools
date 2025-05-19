/**
 * Camp Network脚本
 * 自动化与Camp Network项目交互
 */
function getConfig() {
  return {
    id: "camp_network",
    name: "Camp Network",
    description: "自动化与Camp Network项目交互",
    version: "1.0.0",
    author: "FourAir",
    category: "社区",
    icon: "campground",  // FontAwesome图标
    imageUrl: "https://public.rootdata.com/images/b12/1712038428629.jpg",
    requires: {
      wallets: true,  // 需要钱包
      proxy: false    // 不需要代理
    },
    platforms: ["Camp"],
    config: {
      action: {
        type: "select",
        label: "操作类型",
        options: [
          { value: "quest", label: "完成任务" },
          { value: "mint", label: "铸造NFT" },
          { value: "collect", label: "收集徽章" },
          { value: "refer", label: "邀请好友" }
        ],
        default: "quest"
      },
      questId: {
        type: "text",
        label: "任务ID",
        default: "",
        placeholder: "输入任务ID",
        depends: { action: "quest" }
      },
      nftId: {
        type: "text",
        label: "NFT ID",
        default: "",
        placeholder: "输入NFT ID",
        depends: { action: "mint" }
      },
      badgeId: {
        type: "text",
        label: "徽章ID",
        default: "",
        placeholder: "输入徽章ID",
        depends: { action: "collect" }
      },
      referralEmail: {
        type: "text",
        label: "好友邮箱",
        default: "",
        placeholder: "输入好友邮箱",
        depends: { action: "refer" }
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
  const { config, wallets, utils, webdriver } = context;
  
  console.info("开始执行Camp Network脚本");
  
  try {
    const action = config.action || "quest";
    const questId = config.questId || "";
    const nftId = config.nftId || "";
    const badgeId = config.badgeId || "";
    const referralEmail = config.referralEmail || "";
    const waitTime = config.waitTime || 30;
    const wallet = wallets[0]; // 获取第一个钱包
    
    if (!wallet) {
      throw new Error("没有可用的钱包");
    }
    
    console.info(`使用钱包: ${wallet.address}`);
    console.info(`执行操作: ${action}`);
    
    // 连接到Camp Network
    console.info("连接到Camp Network...");
    // 这里是连接代码
    
    switch (action) {
      case "quest":
        if (!questId) {
          throw new Error("完成任务需要提供任务ID");
        }
        console.info(`执行完成任务操作，任务ID: ${questId}...`);
        // 这里是完成任务的代码
        break;
        
      case "mint":
        if (!nftId) {
          throw new Error("铸造NFT需要提供NFT ID");
        }
        console.info(`执行铸造NFT操作，NFT ID: ${nftId}...`);
        // 这里是铸造NFT的代码
        break;
        
      case "collect":
        if (!badgeId) {
          throw new Error("收集徽章需要提供徽章ID");
        }
        console.info(`执行收集徽章操作，徽章ID: ${badgeId}...`);
        // 这里是收集徽章的代码
        break;
        
      case "refer":
        if (!referralEmail) {
          throw new Error("邀请好友需要提供好友邮箱");
        }
        console.info(`执行邀请好友操作，好友邮箱: ${referralEmail}...`);
        // 这里是邀请好友的代码
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