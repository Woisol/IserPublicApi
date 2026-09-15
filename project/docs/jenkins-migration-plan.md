# GitHub Actions 迁移 Jenkins 方案

## 1. 目标与现状

本文用于将 ISer Public API 从 GitHub Actions 迁移到已部署在另一台机器上的 Jenkins。

当前 GitHub Actions 工作流为 `.github/workflows/deploy-iser-public-api.yml`，触发条件是 `main` 分支 push，运行在 self-hosted runner 上，主要步骤如下：

1. Checkout 代码。
2. 使用 pnpm 安装依赖并执行 `pnpm run build`。
3. 将 `dist`、`assets`、`package.json`、`ecosystem.config.js` 复制到 `~/servers/iser-public-api`。
4. 停止 PM2 进程 `ISerPublicApi`，再用 production 环境启动并执行 `pm2 save`。
5. 删除构建机工作区的 `node_modules`。

项目运行约束：

- Node.js `>=20.0.0`，建议 Jenkins 构建节点统一使用 Node.js 22 LTS。
- pnpm 固定为 `8.10.0`，见 `package.json` 的 `packageManager`。
- 生产端口为 `6990`，应用入口为构建后的 `main.js`。
- 生产进程由 PM2 管理，应用名为 `ISerPublicApi`。
- `assets` 是运行时需要的静态资源，不能只发布 `dist`。
- 健康检查接口位于天气应用控制器，迁移后应配置为实际可访问的完整 URL 进行验收。

## 2. 推荐架构

建议采用 Jenkins Controller 与 Jenkins Agent 分离的架构：

```text
GitHub Repository
        |
        | HTTPS Webhook（Jenkins 公网地址）
        v
Jenkins Controller（公网入口，建议反向代理 + HTTPS）
        |
        | SSH / Jenkins Agent 通道
        v
构建 Agent（Node.js 22 + pnpm 8.10.0）
        |
        | SSH，仅允许发布用户访问
        v
应用服务器（PM2，~/servers/iser-public-api，监听 6990）
```

推荐将 Jenkins Controller 只作为调度和凭据管理节点，构建在专用 Agent 上执行。若 Jenkins 所在机器同时满足构建要求，也可以先使用 Controller 执行，但后续应迁移到 Agent。

网络方向应按最小权限配置：

- GitHub -> Jenkins：只开放 Jenkins Webhook 所需的 HTTPS 入口，建议使用反向代理，不直接暴露 Jenkins 内置端口。
- Jenkins -> GitHub：允许拉取仓库（HTTPS PAT 或 SSH deploy key 二选一）。
- Jenkins Agent -> Jenkins Controller：按 Agent 启动方式开放 JNLP/WebSocket/SSH 所需连接。
- Jenkins -> 应用服务器：仅开放 SSH 22 端口，限制为固定 Jenkins 出口 IP 或 VPN 网段。
- 用户 -> 应用服务器：只开放反向代理后的业务端口；不应直接暴露 PM2 或 Jenkins 管理端口。
- 应用服务器 -> 外部服务：允许项目需要的天气、QQ、企业微信及日志服务出口访问。

公网地址用于 GitHub 回调，内网地址优先用于 Jenkins 到构建 Agent、应用服务器的传输。若两台机器不在同一内网，优先使用 VPN/专线；不要为了发布而把 SSH 对公网开放给任意来源。

## 3. Jenkins 端准备

### 3.1 必装能力

在 Jenkins 安装并更新以下插件：

- Pipeline
- Git
- GitHub Branch Source 或 GitHub plugin
- Credentials Binding
- SSH Build Agents（如果使用 SSH Agent）
- Pipeline Utility Steps（可选，用于读取构建元数据）
- Workspace Cleanup（可选）

Jenkins Controller 和 Agent 应满足：

- Java 版本符合当前 Jenkins LTS 要求。
- 构建 Agent 安装 Node.js 22、Git、SSH client、pnpm 8.10.0。
- Agent 工作目录有足够空间；不要在流水线中用 `rm -rf` 清理系统目录。
- Agent 用户有权限读取工作区，但不应使用 root 运行构建。

Agent 初始化示例：

```bash
node --version
corepack enable
corepack prepare pnpm@8.10.0 --activate
pnpm --version
git --version
ssh -V
```

### 3.2 凭据配置

在 Jenkins 的 `Manage Jenkins -> Credentials` 中配置，凭据 ID 使用稳定、无敏感信息的名称：

| 凭据 ID | 类型 | 用途 |
| --- | --- | --- |
| `iser-public-api-github` | GitHub App、PAT 或 SSH key | Checkout 私有仓库 |
| `iser-public-api-deploy-ssh` | SSH Username with private key | Jenkins 发布到应用服务器 |
| `iser-public-api-runtime` | Secret text 或 Secret file | 生产环境变量/配置 |

生产配置建议拆成多个 Secret text 或 Secret file，并在流水线中通过 `withCredentials` 注入。至少包括：

- `AUTHORITY_API_KEY`
- `QQBOT_APP_ID`
- `QQBOT_APP_SECRET`
- `QQBOT_COMMAND_WHITE_LIST`
- `BASE_URL`
- `QWEATHER_LOCATION`
- `QWEATHER_API_KEY`
- `QWEATHER_API_HOST`
- `GAMELOG_BASEURL`
- `GAMELOG_GENSHINLOGSURL`
- `GAMELOG_STARRAILLOGSURL`

`WXWORK_WEBHOOK_URL`、`WEBHOOK_SEND_ADAPTER`、`QQBOT_COMMAND_PREFIX`、`SERVER_PORT` 等非敏感配置可以作为 Jenkins 参数或流水线环境变量，但生产配置最好统一由应用服务器上的受限权限文件管理。

### 3.3 Webhook 与 Job

建议创建 Multibranch Pipeline；如果仓库只有一个长期分支，也可以先创建 Pipeline Job：

1. Job 类型选择 Pipeline 或 Multibranch Pipeline。
2. SCM 指向当前 GitHub 仓库，默认构建 `main`。
3. Pipeline definition 选择 `Jenkinsfile` from SCM。
4. GitHub Webhook 地址使用 `https://<JENKINS_PUBLIC_HOST>/github-webhook/`。
5. GitHub 仓库配置 Webhook，事件至少选择 `Pushes`；若使用 PR 校验，再增加 Pull requests。
6. Job 中启用并发控制，建议 `disableConcurrentBuilds()`，避免两个发布同时覆盖同一个目录。
7. 设置构建保留策略，例如保留最近 30 次构建和最近 30 天构建产物。

Webhook 配置完成后，用一次非生产分支 push 验证 Jenkins 能收到事件，再单独验证 `main` 才会触发部署。

## 4. 流水线实现

建议将 `Jenkinsfile` 放在仓库根目录，纳入代码审查。以下示例保持现有 PM2 发布方式，同时增加测试、原子化发布目录、健康检查和失败回滚。`APP_SERVER`、`DEPLOY_USER`、`DEPLOY_ROOT`、`HEALTHCHECK_URL` 应按实际环境修改；敏感值不要写入文件。

```groovy
pipeline {
  agent { label 'node22-pnpm810' }

  options {
    disableConcurrentBuilds()
    timestamps()
    skipDefaultCheckout(true)
    buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '10'))
  }

  environment {
    APP_NAME = 'ISerPublicApi'
    APP_SERVER = 'app.example.internal'
    DEPLOY_USER = 'iser-deploy'
    DEPLOY_ROOT = '/home/iser-deploy/servers/iser-public-api'
    SERVER_PORT = '6990'
    NODE_ENV = 'production'
    HEALTHCHECK_URL = 'https://<业务域名>/push/weather/health'
    PNPM_HOME = "${env.HOME}/.local/share/pnpm"
    PATH = "${env.PNPM_HOME}:${env.PATH}"
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Verify toolchain') {
      steps {
        sh 'node --version'
        sh 'pnpm --version'
        sh 'test "$(pnpm --version)" = "8.10.0"'
      }
    }

    stage('Test and build') {
      steps {
        sh 'pnpm install --frozen-lockfile'
        sh 'pnpm test -- --runInBand'
        sh 'pnpm run build'
        sh 'test -f dist/main.js'
        sh 'test -d assets'
      }
    }

    stage('Publish') {
      steps {
        sshagent(credentials: ['iser-public-api-deploy-ssh']) {
          sh '''
            set -eu
            RELEASE="$DEPLOY_ROOT/releases/$BUILD_NUMBER"
            ssh "$DEPLOY_USER@$APP_SERVER" "mkdir -p '$RELEASE/logs' '$DEPLOY_ROOT/releases'"
            scp -r dist assets package.json ecosystem.config.js \
              "$DEPLOY_USER@$APP_SERVER:$RELEASE/"
            ssh "$DEPLOY_USER@$APP_SERVER" "ln -sfn '$RELEASE' '$DEPLOY_ROOT/current'"
            ssh "$DEPLOY_USER@$APP_SERVER" "cd '$DEPLOY_ROOT/current' && set -a && . '$DEPLOY_ROOT/.env' && set +a && if pm2 describe '$APP_NAME' >/dev/null 2>&1; then pm2 reload '$APP_NAME' --update-env; else pm2 start ecosystem.config.js --env production; fi"
            ssh "$DEPLOY_USER@$APP_SERVER" "pm2 save"
          '''
        }
      }
    }

    stage('Smoke test') {
      steps {
        sh 'curl --fail --silent --show-error --max-time 10 "$HEALTHCHECK_URL"'
      }
    }
  }

  post {
    always {
      junit testResults: 'junit.xml', allowEmptyResults: true
      deleteDir()
    }
    failure {
      echo '部署或验收失败，请按本文回滚章节处理。'
    }
  }
}
```

说明：

- 现有工作流使用默认 `pnpm install`，迁移后建议使用 `--frozen-lockfile`，确保构建严格复现 `pnpm-lock.yaml`。如果当前 lockfile 无法通过冻结安装，应先在独立变更中修复 lockfile，不要在部署流水线临时更新依赖。
- 当前测试脚本不会自动生成 JUnit XML；`junit.xml` 归档步骤可以先允许为空，后续再接入 Jest JUnit reporter。测试本身仍由 `pnpm test -- --runInBand` 决定流水线成败。
- `pm2 reload` 比先 stop 再 start 更适合降低中断时间；首次部署没有进程时再执行 `pm2 start`。
- 发布目录按构建号保留，`current` 使用软链接指向当前版本，便于回滚。应在应用服务器上配置定期清理旧版本，只保留最近 5 到 10 个成功版本。
- `ecosystem.config.js` 会展开 `process.env`，因此发布命令必须在应用服务器上加载 `$DEPLOY_ROOT/.env` 后再执行 PM2。该文件只保存在应用服务器、权限为 `0600`，不通过 `scp` 从 Jenkins 传输。

## 5. 应用服务器准备

创建专用发布用户，不使用 root：

```bash
sudo useradd --system --create-home --shell /bin/bash iser-deploy
sudo mkdir -p /home/iser-deploy/servers/iser-public-api/releases
sudo chown -R iser-deploy:iser-deploy /home/iser-deploy/servers/iser-public-api
```

应用服务器需安装 Node.js 22、pnpm 8.10.0 和 PM2，并让 PM2 由 `iser-deploy` 用户管理：

```bash
node --version
pnpm --version
pm2 --version
pm2 startup
pm2 save
```

首次切换前确认：

- `iser-deploy` 的 SSH 公钥已写入 `~/.ssh/authorized_keys`，并限制来源 IP、命令权限和端口转发能力。
- `pm2 ls` 中的进程名与 `ecosystem.config.js` 的 `ISerPublicApi` 完全一致。
- 生产环境配置文件不在 Git 仓库中，权限为 `0600`，属主为发布用户或专用运行用户。
- 反向代理已将业务请求转发到 `127.0.0.1:6990`，外部健康检查 URL 能够访问。
- 反向代理已将业务请求转发到 `127.0.0.1:6990`，外部 `https://<业务域名>/push/weather/health` 能够访问。
- `logs` 目录可写，且已配置 logrotate 或 PM2 日志轮转，防止磁盘耗尽。
- 应用服务器能访问项目依赖的外部服务和 `GAMELOG_*` 地址。

## 6. 凭据安全与必须处理事项

当前工作区的 `.env` 含有 API key、QQ App Secret 等敏感值。虽然 `.gitignore` 忽略了 `.env`，但这些值已经出现在本地文件中，迁移前应按已暴露凭据处理：

1. 立即轮换 `AUTHORITY_API_KEY`、`QQBOT_APP_SECRET`、`QWEATHER_API_KEY` 及其他真实密钥。
2. 检查 Git 历史、分支、构建日志和 Jenkins 控制台日志是否曾出现这些值；必要时使用 GitHub secret scanning 和历史清理流程。
3. 只把轮换后的值保存到 Jenkins Credentials 或应用服务器的受限配置文件中。
4. 禁止在 `Jenkinsfile`、Shell 命令参数、构建产物、日志和 `echo` 输出中打印密钥。
5. 禁止通过 `scp .env` 发布；Jenkins 只传输构建产物和非敏感运行文件。
6. 对 Jenkins 开启登录保护、基于角色的权限控制、审计日志和备份；公网入口强制 HTTPS，并限制管理员来源。

## 7. 分阶段迁移步骤

### 阶段 A：准备

1. 记录当前生产版本、PM2 状态、健康检查结果、应用日志和回滚目录。
2. 准备 Jenkins Agent、工具链、GitHub 访问凭据和应用服务器 SSH 凭据。
3. 建立不执行生产发布的验证 Job，验证 Checkout、依赖安装、测试、构建和制品完整性。
4. 对所有生产密钥完成轮换，并在 Jenkins Credentials 中保存。

### 阶段 B：双轨验证

1. 在 Jenkinsfile 中先将发布目标指向预发布目录或预发布主机。
2. 验证 `dist/main.js`、`assets`、`package.json`、`ecosystem.config.js` 均存在。
3. 启动预发布 PM2，检查健康接口、业务回调、静态图片、外部服务调用和日志输出。
4. 连续验证至少 2 到 3 次构建，确认重复构建不会互相覆盖。

### 阶段 C：切换

1. 选择低流量时段，冻结 `main` 的非必要合并。
2. 手动执行一次 Jenkins `main` 构建，记录构建号与 Git SHA。
3. 验证应用、Webhook 回调、静态资源和关键业务接口。
4. 暂停 GitHub Actions workflow，保留文件至少一个发布周期用于追溯，但不要让两套系统同时发布。
5. 观察至少一个完整业务周期，再删除旧的 self-hosted runner 注册和无用 GitHub secrets。

## 8. 回滚 Runbook

优先回滚到上一个经过验收的 release：

```bash
cd /home/iser-deploy/servers/iser-public-api
readlink -f current
ln -sfn releases/<上一个构建号> current
cd current
pm2 reload ISerPublicApi --update-env
pm2 save
curl --fail http://127.0.0.1:6990/push/weather/health
```

回滚后检查 PM2 日志、反向代理日志和外部回调。若新版本已经修改了不可逆的数据或外部协议，必须在切换前另行准备数据回滚方案；本项目当前部署流程本身不包含数据库迁移，因此不能假定所有版本都可以无条件回滚。

若 Jenkins 不可用但线上版本正常，不要直接在生产机执行未经审查的源码构建。可使用最后一个已验收 release 目录恢复服务，并在 Jenkins 修复后重新发布。

## 9. 验收清单

- [ ] GitHub push 能触发目标 Jenkins Job，重复事件不会并发发布。
- [ ] Jenkins 使用正确的 Node.js 版本和 pnpm `8.10.0`。
- [ ] lockfile 冻结安装成功，单元测试成功，构建成功。
- [ ] 发布物包含 `dist`、`assets`、`package.json`、`ecosystem.config.js`。
- [ ] PM2 进程名为 `ISerPublicApi`，状态为 online，监听端口为 `6990`。
- [ ] 健康检查返回成功，静态图片和关键业务接口可用。
- [ ] Jenkins 控制台日志、归档物和通知中没有敏感值。
- [ ] Jenkins 到应用服务器仅使用专用账号和受限 SSH 凭据。
- [ ] 至少完成一次模拟回滚，并确认回滚后健康检查成功。
- [ ] GitHub Actions 已暂停，且切换窗口内没有双重发布。

## 10. 后续改进

迁移稳定后，建议逐步将发布脚本抽到仓库中的 `scripts/deploy.sh`，为测试生成 JUnit 报告，加入镜像或制品仓库，并为应用增加独立且稳定的 `/health` 接口。之后可以再评估从“复制文件 + PM2”迁移到 Docker/Compose 或其他受控发布方式；这属于后续部署形态改造，不应与本次 CI 平台迁移混在一起。
