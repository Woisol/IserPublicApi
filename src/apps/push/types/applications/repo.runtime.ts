// Webhook 事件类型枚举
export enum GitHubWebhookEvent {
  MEMBER = 'member',
  ISSUES = 'issues',
  RELEASE = 'release',
  WORKFLOW_RUN = 'workflow_run',
}
