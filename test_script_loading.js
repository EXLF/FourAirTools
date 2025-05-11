const scriptEngine = require('./src/main/scriptEngine.js');

async function test() {
  try {
    const result = await scriptEngine.testScriptLoading();
    console.log('测试结果:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('测试失败:', error);
  }
}

test(); 