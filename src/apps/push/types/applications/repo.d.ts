// GitHub Webhook 事件类型定义

// 基础类型
export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  type: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string;
  owner: GitHubUser;
}

// Webhook 基础结构
export interface GitHubWebhookBase {
  action?: string;
  repository: GitHubRepository;
  sender: GitHubUser;
}

// 1. 协作者相关事件 (member)
export interface MemberWebhookPayload extends GitHubWebhookBase {
  action: 'added' | 'removed' | 'edited';
  member: GitHubUser;
  changes?: {
    permission?: {
      from: string;
      to: string;
    };
  };
}

// 2. Issue 相关事件
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  user: GitHubUser;
  assignees: GitHubUser[];
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface IssuesWebhookPayload extends GitHubWebhookBase {
  action:
    | 'opened'
    | 'closed'
    | 'edited'
    | 'reopened'
    | 'assigned'
    | 'unassigned'
    | 'labeled'
    | 'unlabeled';
  issue: GitHubIssue;
  changes?: {
    title?: { from: string };
    body?: { from: string };
  };
  assignee?: GitHubUser;
  label?: {
    id: number;
    name: string;
    color: string;
  };
}

// 3. Release 相关事件
export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  html_url: string;
  author: GitHubUser;
  assets: Array<{
    id: number;
    name: string;
    size: number;
    download_count: number;
    browser_download_url: string;
  }>;
}

export interface ReleaseWebhookPayload extends GitHubWebhookBase {
  action:
    | 'published'
    | 'unpublished'
    | 'created'
    | 'edited'
    | 'deleted'
    | 'prereleased'
    | 'released';
  release: GitHubRelease;
  changes?: {
    body?: { from: string };
    name?: { from: string };
  };
}

// 4. Workflow 运行事件 (workflow_run)
export interface GitHubWorkflow {
  id: number;
  name: string;
  path: string;
  state: string;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion:
    | 'success'
    | 'failure'
    | 'neutral'
    | 'cancelled'
    | 'skipped'
    | 'timed_out'
    | 'action_required'
    | null;
  workflow_id: number;
  url: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  run_attempt: number;
  run_started_at: string;
  event: string;
  actor: GitHubUser;
}

export interface WorkflowRunWebhookPayload extends GitHubWebhookBase {
  action: 'completed' | 'requested' | 'in_progress';
  workflow_run: GitHubWorkflowRun;
  workflow: GitHubWorkflow;
}

// 联合类型
export type GitHubWebhookPayload =
  | MemberWebhookPayload
  | IssuesWebhookPayload
  | ReleaseWebhookPayload
  | WorkflowRunWebhookPayload;

// 处理结果接口
export interface WebhookProcessResult {
  success: boolean;
  message: string;
  event: GitHubWebhookEvent;
  action?: string;
  data?: any;
}

// 原有类型保留
export type RepoNotificationType = 'success' | 'failure';
export interface RepoNotificationParams {
  type: RepoNotificationType;
}
