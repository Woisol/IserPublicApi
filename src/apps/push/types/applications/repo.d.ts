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

export interface GitHubCommit {
  id: string;
  tree_id: string;
  message: string;
  timestamp: string;
  author: {
    name: string;
    email: string;
  };
  committer: {
    name: string;
    email: string;
  };
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
  node_id: string;
  name: string;
  path: string;
  state: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  badge_url: string;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  node_id: string;
  check_suite_id: number;
  check_suite_node_id: string;
  head_branch: string;
  head_sha: string;
  path: string;
  display_title: string;
  run_number: number;
  run_attempt: number;
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
  jobs_url: string;
  logs_url: string;
  check_suite_url: string;
  artifacts_url: string;
  cancel_url: string;
  rerun_url: string;
  previous_attempt_url?: string;
  workflow_url: string;
  created_at: string;
  updated_at: string;
  run_started_at: string;
  event: string;
  actor: GitHubUser;
  head_commit: GitHubCommit;
  repository: GitHubRepository;
  head_repository: GitHubRepository | null;
  pull_requests: Array<{
    id: number;
    number: number;
    url: string;
    head: {
      ref: string;
      sha: string;
      repo: GitHubRepository;
    };
    base: {
      ref: string;
      sha: string;
      repo: GitHubRepository;
    };
  }>;
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
