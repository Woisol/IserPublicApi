/**
 * 设备监控服务 - 监控本机系统资源使用情况
 * 当 CPU 连续高负荷时发送告警消息
 */
import { Injectable } from '@nestjs/common';
import { PushService } from '..';
import { WxwMarkdownInfo } from '../../types/wxw-webhook';
import * as os from 'os';
import { CompactLogger } from '@app/common/utils/logger';

export interface DeviceMonitorConfig {
  /** CPU 使用率阈值（百分比） */
  cpuThreshold: number;
  /** 连续检测次数 */
  consecutiveCount: number;
  /** 监控间隔（毫秒） */
  monitorInterval: number;
  /** 是否启用监控 */
  enabled: boolean;
}

export interface CpuUsage {
  /** CPU 使用率百分比 */
  usage: number;
  /** 检测时间戳 */
  timestamp: number;
}

export interface SystemInfo {
  /** 系统类型 */
  platform: string;
  /** CPU 型号 */
  cpuModel: string;
  /** CPU 核心数 */
  cpuCount: number;
  /** 总内存 */
  totalMemory: string;
  /** 可用内存 */
  freeMemory: string;
  /** 内存使用率 */
  memoryUsage: number;
  /** 系统运行时间 */
  uptime: string;
  /** 负载平均值 */
  loadAvg: number[];
}

@Injectable()
export class DeviceMonitorService {
  /** 与设备监控相关的逻辑 */
  private readonly logger = new CompactLogger(DeviceMonitorService.name);
  private readonly config: DeviceMonitorConfig;
  private monitorTimer: NodeJS.Timeout | null = null;
  private cpuHistory: CpuUsage[] = [];
  private lastAlertTime = 0;
  private readonly alertCooldown = 5 * 60 * 1000; // 5分钟冷却时间

  constructor(private readonly pushService: PushService) {
    this.config = {
      cpuThreshold: 80, // 80% CPU 使用率阈值
      consecutiveCount: 3, // 连续3次检测到高负荷
      monitorInterval: 30000, // 30秒检测一次
      enabled: false, // 默认不启用
    };
    this.startMonitoring();
  }

  /**
   * 启动监控
   */
  startMonitoring(): void {
    if (this.monitorTimer) {
      this.logger.warn('监控已在运行中');
      return;
    }

    this.config.enabled = true;
    this.logger.log('开始设备监控服务');

    // 立即执行一次检测
    void this.checkCpuUsage();

    // 设置定时器
    this.monitorTimer = setInterval(() => {
      void this.checkCpuUsage();
    }, this.config.monitorInterval);

    //     this.sendNotification(`「设备监控」监控服务已启动\n> 检测间隔：${this.config.monitorInterval / 1000}秒
    // > CPU阈值：${this.config.cpuThreshold}%
    // > 连续触发：${this.config.consecutiveCount}次`);
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }

    this.config.enabled = false;
    this.cpuHistory = [];
    this.logger.log('设备监控服务已停止');

    // this.sendNotification('「设备监控」监控服务已停止');
  }

  /**
   * 检测 CPU 使用率
   */
  private async checkCpuUsage(): Promise<void> {
    try {
      const cpuUsage = await this.getCurrentCpuUsage();
      const timestamp = Date.now();

      this.cpuHistory.push({ usage: cpuUsage, timestamp });

      // 保持历史记录数量
      if (this.cpuHistory.length > this.config.consecutiveCount) {
        this.cpuHistory.shift();
      }

      // this.logger.debug(`当前 CPU 使用率: ${cpuUsage.toFixed(2)}%`);

      // 检查是否触发告警
      this.checkForAlert(cpuUsage);
    } catch (error) {
      this.logger.error('获取 CPU 使用率失败', error);
    }
  }

  /**
   * 获取当前 CPU 使用率
   */
  private getCurrentCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const cpus = os.cpus();
      const startMeasure = cpus.map((cpu) => ({
        idle: cpu.times.idle,
        total: Object.values(cpu.times).reduce((acc, time) => acc + time, 0),
      }));

      setTimeout(() => {
        const endMeasure = os.cpus().map((cpu) => ({
          idle: cpu.times.idle,
          total: Object.values(cpu.times).reduce((acc, time) => acc + time, 0),
        }));

        let totalIdle = 0;
        let totalTick = 0;

        for (let i = 0; i < startMeasure.length; i++) {
          const idleDiff = endMeasure[i].idle - startMeasure[i].idle;
          const totalDiff = endMeasure[i].total - startMeasure[i].total;
          totalIdle += idleDiff;
          totalTick += totalDiff;
        }

        const idle = totalIdle / startMeasure.length;
        const total = totalTick / startMeasure.length;
        const usage = 100 - ~~((100 * idle) / total);

        resolve(usage);
      }, 1000);
    });
  }

  /**
   * 检查是否需要发送告警
   */
  private checkForAlert(currentUsage: number): void {
    // 检查当前使用率是否超过阈值
    if (currentUsage < this.config.cpuThreshold) {
      return;
    }

    // 检查历史记录是否足够
    if (this.cpuHistory.length < this.config.consecutiveCount) {
      return;
    }

    // 检查是否连续超过阈值
    const consecutiveHighUsage = this.cpuHistory
      .slice(-this.config.consecutiveCount)
      .every((record) => record.usage >= this.config.cpuThreshold);

    if (!consecutiveHighUsage) {
      return;
    }

    // 检查冷却时间
    const now = Date.now();
    if (now - this.lastAlertTime < this.alertCooldown) {
      return;
    }

    // 发送告警
    this.sendHighCpuAlert();
    this.lastAlertTime = now;
  }

  /**
   * 发送高 CPU 使用率告警
   */
  private sendHighCpuAlert(): void {
    const systemInfo = this.getSystemInfo();
    const avgUsage =
      this.cpuHistory
        .slice(-this.config.consecutiveCount)
        .reduce((sum, record) => sum + record.usage, 0) /
      this.config.consecutiveCount;

    const markdownInfo: WxwMarkdownInfo = {
      type: 'Device',
      title: '<font color="warning">CPU 高负荷告警</font>',
      content: [
        { 过去15min内平均使用率: `${avgUsage.toFixed(2)}%` },
        { 检测时间: new Date().toLocaleString('zh-CN') },
        {
          系统信息: {
            内存使用率: `${systemInfo.memoryUsage.toFixed(2)}%`,
            已运行时间: systemInfo.uptime,
            系统: systemInfo.platform,
            CPU: systemInfo.cpuModel,
            核心数: systemInfo.cpuCount.toString(),
          },
        },
      ],
    };

    this.sendStructuredNotification(markdownInfo);
  }

  /**
   * 获取系统信息
   */
  getSystemInfo(): SystemInfo {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;

    const uptimeSeconds = os.uptime();
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptime = `${days}天 ${hours}小时 ${minutes}分钟`;

    const cpus = os.cpus();

    return {
      platform: `${os.type()} ${os.release()}`,
      cpuModel: cpus[0]?.model || '未知',
      cpuCount: cpus.length,
      totalMemory: this.formatBytes(totalMemory),
      freeMemory: this.formatBytes(freeMemory),
      memoryUsage,
      uptime,
      loadAvg: os.loadavg(),
    };
  }

  // /**
  //  * 获取当前监控配置
  //  */
  // getConfig(): DeviceMonitorConfig {
  //   return { ...this.config };
  // }

  // /**
  //  * 更新监控配置
  //  */
  // updateConfig(newConfig: Partial<DeviceMonitorConfig>): void {
  //   Object.assign(this.config, newConfig);
  //   this.logger.log(`监控配置已更新: ${JSON.stringify(newConfig)}`);

  //   // 如果监控正在运行且间隔时间改变了，需要重启监控
  //   if (this.monitorTimer && newConfig.monitorInterval) {
  //     this.stopMonitoring();
  //     this.startMonitoring();
  //   }
  // }

  // /**
  //  * 获取监控状态
  //  */
  // getMonitorStatus(): {
  //   isRunning: boolean;
  //   config: DeviceMonitorConfig;
  //   lastCpuUsage?: CpuUsage;
  //   systemInfo: SystemInfo;
  // } {
  //   return {
  //     isRunning: this.monitorTimer !== null,
  //     config: this.getConfig(),
  //     lastCpuUsage: this.cpuHistory[this.cpuHistory.length - 1],
  //     systemInfo: this.getSystemInfo(),
  //   };
  // }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * 发送结构化 Markdown 通知消息
   */
  private sendStructuredNotification(markdownInfo: WxwMarkdownInfo): void {
    // this.logger.log(`发送结构化设备监控通知: ${markdownInfo.title}`);

    // 使用 void 操作符忽略 Promise
    void this.pushService.sendMarkdownInfoMessage(markdownInfo, 'monitor');
  }

  //   /**
  //    * 手动检测系统状态并发送报告
  //    */
  //   async sendSystemReport(): Promise<void> {
  //     const systemInfo = this.getSystemInfo();
  //     const currentCpuUsage = await this.getCurrentCpuUsage();

  //     const message = `「Device」系统状态报告
  // > <font color="comment">检测时间：</font>${new Date().toLocaleString('zh-CN')}
  // > <font color="comment">监控状态：</font>${this.monitorTimer ? '运行中' : '已停止'}

  // **CPU 状态**
  // > <font color="comment">当前使用率：</font>${currentCpuUsage.toFixed(2)}%
  // > <font color="comment">CPU 型号：</font>${systemInfo.cpuModel}
  // > <font color="comment">核心数：</font>${systemInfo.cpuCount}

  // **内存状态**
  // > <font color="comment">总内存：</font>${systemInfo.totalMemory}
  // > <font color="comment">可用内存：</font>${systemInfo.freeMemory}
  // > <font color="comment">内存使用率：</font>${systemInfo.memoryUsage.toFixed(2)}%

  // **系统信息**
  // > <font color="comment">系统：</font>${systemInfo.platform}
  // > <font color="comment">运行时间：</font>${systemInfo.uptime}
  // > <font color="comment">负载平均值：</font>${systemInfo.loadAvg.map((load) => load.toFixed(2)).join(', ')}`;

  //     this.sendNotification(message);
  //   }
}
