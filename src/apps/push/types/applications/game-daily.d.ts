export type GameLogDetailQuery = {
  name: string; // 信息名称
  findStr: RegExp; // 查找正则
};

export type GameLogDetailResult = Record<string, string | null>;

export type GameLogInfo = {};

export interface GameLogFetchOption {
  gameName: string; // 游戏名称
  logUrl: URL; // 日志获取地址
  successFlag: string; // 每日完成标志
  detailQuery: GameLogDetailQuery[]; // 完成详情查询
}

export interface GameLogFetchResult {
  querySuccess: boolean; // 查询是否成功
  dailyCompleted: boolean; // 每日是否完成
  details: GameLogDetailResult[]; // 完成详情
}
