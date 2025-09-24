# 使用官方 Node.js 22 镜像作为基础镜像
FROM node:22-alpine AS base

# 安装 pnpm
RUN npm install -g pnpm@8.10.0

# 设置工作目录
WORKDIR /app

# 复制包管理文件
COPY package.json pnpm-lock.yaml ./

# ================
# 依赖安装阶段
# ================
FROM base AS deps

# 安装所有依赖
ENV HUSKY=0
RUN pnpm install

# ================
# 构建阶段
# ================
FROM base AS builder

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules

# 复制源代码和配置文件
COPY . .

# 构建应用
RUN pnpm run build

# ================
# 运行阶段
# ================
FROM node:22-alpine AS runner

# 创建非root用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# 设置工作目录
WORKDIR /app

# 复制构建产物
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

# 如果项目中有静态文件或其他需要的文件，可以在这里复制
# COPY --from=builder --chown=nestjs:nodejs /app/public ./public

# 切换到非root用户
USER nestjs

# 暴露端口（默认3000，可通过环境变量 SERVER_PORT 修改）
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production

# 启动应用
CMD ["node", "dist/main.js"]