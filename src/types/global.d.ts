/**
 * 全局模块声明文件
 * 用于支持路径别名对 .d.ts 文件的解析
 */

// // 使用字符串字面量类型来映射路径别名
// // 这样 @app/types/aaa/bbb 会匹配到 src/types/aaa/bbb
// declare module '@app/types/push/wxw-webhook' {
//   export * from 'src/types/push/wxw-webhook.d.ts';
// }

// 通用的通配符声明（用于其他可能的类型文件）
declare module '@app/types/*' {
  const content: any;
  export default content;
  export = content;
}

export { };