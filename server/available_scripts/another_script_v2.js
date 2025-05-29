/**
 * Another Script - Version 2
 * This script demonstrates a different functionality.
 */

function getConfig() {
  return {
    id: "another_script",
    name: "另一个脚本V2",
    description: "展示不同高级功能的另一个脚本。",
    version: "2.0.0",
    author: "DevTeam",
    category: "高级",
    icon: "cogs",
    requires: {
      wallets: true,
      proxy: true
    },
    platforms: ["Ethereum", "BSC"],
    config: {
      iterations: {
        type: "number",
        label: "执行次数",
        default: 3,
        min: 1,
        max: 10
      },
      apiKey: {
        type: "password",
        label: "API 密钥 (可选)",
        default: "",
        placeholder: "输入你的 API 密钥"
      }
    }
  };
}

async function main(context) {
  const { config, wallets, utils, proxy } = context;
  const iterations = config.iterations || 1;
  const apiKey = config.apiKey;

  console.log(`[Another Script V2] Executing ${iterations} iterations.`);
  utils.logToUI(`另一个脚本V2: 开始执行，迭代次数 ${iterations}。`);

  if (apiKey) {
    console.log("[Another Script V2] Using API Key: *****");
    utils.logToUI("另一个脚本V2: 检测到 API 密钥。");
  }

  if (proxy && proxy.host) {
    console.log(`[Another Script V2] Using proxy: ${proxy.host}:${proxy.port}`);
    utils.logToUI(`另一个脚本V2: 使用代理 ${proxy.host}`);
  }

  for (let i = 0; i < iterations; i++) {
    utils.logToUI(`另一个脚本V2: 迭代 ${i + 1}/${iterations}`);
    console.log(`[Another Script V2] Iteration ${i + 1}`);
    if (wallets && wallets.forEach) {
        wallets.forEach(wallet => {
          console.log(`  [Another Script V2] Processing wallet: ${wallet.address ? wallet.address.substring(0,10) : 'N/A'}...`);
        });
    }
    await utils.delay(500);
  }

  console.log("[Another Script V2] Finished execution.");
  utils.logToUI("另一个脚本V2: 执行完毕。");
  return { success: true, data: `Completed ${iterations} iterations.` };
}

module.exports = { getConfig, main };

/*
// Old IIFE and UI-specific code - removed as it causes issues in Node.js require()
(function() {
  const message = "Another script, version 2, reporting for duty!";
  // console.log(message); // Logging can be done in main if needed
  
  function showInfo() {
    // alert(message + "\nTimestamp: " + new Date().toLocaleTimeString()); // Avoid alert in backend scripts
    console.log(message + "\nTimestamp: " + new Date().toLocaleTimeString());
  }
  
  if (typeof window !== 'undefined') {
    // window.showAnotherScriptInfo = showInfo; // UI specific, not for backend processing
  } else {
    // showInfo(); // Avoid direct execution on load
  }
})();
*/ 