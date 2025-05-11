/**
 * recaptchaV3Solver.js (ESM模块) 的CommonJS包装器
 * 允许在CommonJS环境中调用ESM模块函数
 */
const { execSync } = require('child_process');
const path = require('path');

/**
 * 包装recaptchaV3Solver.js中的solveRecaptchaV3函数
 * @param {Object} proxy - 代理配置对象
 * @param {string} clientKey - CapSolver的API密钥
 * @param {string} websiteURL - 目标网站的URL
 * @param {string} websiteKey - 目标网站的reCAPTCHA站点密钥
 * @param {string} pageAction - reCAPTCHA的pageAction (可选)
 * @param {string} anchor - reCAPTCHA的anchor (可选)
 * @param {string} reload - reCAPTCHA的reload (可选)
 * @returns {Promise<string|null>} - 返回reCAPTCHA token或null
 */
function solveRecaptchaV3Wrapper(proxy, clientKey, websiteURL, websiteKey, pageAction = "", anchor = "", reload = "") {
  return new Promise((resolve, reject) => {
    try {
      // 将参数序列化为JSON
      const argsJson = JSON.stringify([proxy, clientKey, websiteURL, websiteKey, pageAction, anchor, reload]);
      
      // 获取真正的solver脚本路径
      const solverPath = path.join(__dirname, 'recaptchaV3Solver.js');
      
      // 创建一个临时Node.js脚本，它动态import solveRecaptchaV3并调用它
      const script = `
        import { solveRecaptchaV3 } from '${solverPath.replace(/\\/g, '\\\\')}';
        
        const args = JSON.parse(process.argv[1]);
        
        async function run() {
          try {
            const result = await solveRecaptchaV3(...args);
            console.log(JSON.stringify({ success: true, result }));
          } catch (error) {
            console.log(JSON.stringify({ success: false, error: error.message }));
          }
          process.exit(0);
        }
        
        run();
      `;
      
      // 使用子进程执行ESM脚本，并传递参数
      const output = execSync(`node --input-type=module -e "${script}" '${argsJson}'`, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024, // 10MB缓冲区
        timeout: 120000 // 120秒超时
      });
      
      // 解析输出的JSON结果
      const resultJson = output.trim();
      const result = JSON.parse(resultJson);
      
      if (result.success) {
        resolve(result.result);
      } else {
        reject(new Error(result.error || '未知错误'));
      }
    } catch (error) {
      console.error('执行captcha solver失败:', error);
      resolve(null); // 解析为null而不是拒绝承诺，便于上层处理
    }
  });
}

module.exports = { solveRecaptchaV3: solveRecaptchaV3Wrapper }; 