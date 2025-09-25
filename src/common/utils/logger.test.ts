import { CompactLogger } from './logger';

/**
 * LoggerService 测试示例
 * 演示不同日志级别的输出格式和颜色
 */

// 测试基本日志功能
function testBasicLogging() {
  console.log('=== 基本日志测试 ===\n');

  const logger = new CompactLogger();

  logger.info('这是一条信息日志');
  logger.warn('这是一条警告日志');
  logger.error('这是一条错误日志');
  logger.debug('这是一条调试日志');
  logger.verbose('这是一条详细日志');

  console.log('\n');
}

// 测试带上下文的日志
function testContextLogging() {
  console.log('=== 带上下文的日志测试 ===\n');

  const logger = new CompactLogger('UserService');

  logger.info('用户登录成功', 'AuthModule');
  logger.warn('密码即将过期', 'SecurityModule');
  logger.error('数据库连接失败', 'DatabaseModule');
  logger.debug('查询用户信息', 'UserModule');
  logger.verbose('缓存命中', 'CacheModule');

  console.log('\n');
}

// 测试错误日志带堆栈跟踪
function testErrorWithTrace() {
  console.log('=== 错误日志带堆栈跟踪测试 ===\n');

  const logger = new CompactLogger('ErrorHandler');

  try {
    throw new Error('模拟错误');
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.stack || error.message : String(error);
    logger.error('捕获到异常', errorMessage, 'ExceptionFilter');
  }

  console.log('\n');
}

// 测试颜色输出（在支持颜色的终端中）
function testColorOutput() {
  console.log('=== 颜色输出测试 ===\n');
  console.log('注意：在支持ANSI颜色的终端中，你应该能看到不同颜色的输出\n');

  const logger = new CompactLogger('ColorTest');

  logger.info('绿色 - 信息日志');
  logger.warn('黄色 - 警告日志');
  logger.error('红色 - 错误日志');
  logger.debug('蓝色 - 调试日志');
  logger.verbose('紫色 - 详细日志');

  console.log('\n');
}

// 性能测试
function testPerformance() {
  // console.log('=== 性能测试 ===\n');
  // const logger = new LoggerService('PerformanceTest');
  // const startTime = Date.now();
  // // 输出100条日志
  // for (let i = 0; i < 100; i++) {
  //   logger.info(`性能测试日志 ${i + 1}`, 'BenchmarkModule');
  // }
  // const endTime = Date.now();
  // console.log(`输出100条日志耗时: ${endTime - startTime}ms\n`);
}

// 运行所有测试
function runAllTests() {
  console.log('🚀 LoggerService 测试开始\n');
  console.log('输出格式：Level[context](yyyy-MM-dd)：message\n');
  console.log('='.repeat(60) + '\n');

  testBasicLogging();
  testContextLogging();
  testErrorWithTrace();
  testColorOutput();
  testPerformance();

  console.log('✅ 所有测试完成！');
  console.log('\n说明：');
  console.log('- LOG：绿色显示');
  console.log('- WARN：黄色显示');
  console.log('- ERROR：红色显示');
  console.log('- DEBUG：蓝色显示');
  console.log('- VERBOSE：紫色显示');
  console.log('- Context：青色显示');
  console.log('- Date：灰色显示');
}

// 如果直接运行此文件，执行测试
//! 啊啊 ts 也可以淦
if (require.main === module) {
  runAllTests();
}

export {
  testBasicLogging,
  testContextLogging,
  testErrorWithTrace,
  testColorOutput,
  testPerformance,
  runAllTests,
};
