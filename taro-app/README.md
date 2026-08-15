# 四象限周复盘 · 微信小程序（Taro）

基于 [Taro 3](https://taro.jd.com/)（React 语法）开发，与 `web/` 共享同一套数据模型与业务逻辑（`types`、`utils`、`store` 直接复用），仅做了两处平台适配：

1. **存储层**：`window.localStorage` → Taro 存储（`src/storage.ts`，底层走 `wx.getStorageSync`）
2. **ID 生成**：`crypto.randomUUID` → 安全的无依赖兜底实现
3. **UI 组件层**：原 shadcn/ui（DOM）改写为 Taro 原生组件（`View/Text/Input/...`）
4. **图表**：Web 端的 recharts 在小程序端暂未移植（MVP 用进度条替代），后续可接入小程序图表库

## 目录结构

```
taro-app/
├── config/index.ts          # Taro 构建配置
├── project.config.json      # 微信开发者工具项目配置（appid 需替换成你自己的）
├── src/
│   ├── app.config.ts        # 页面注册 + 底部 tabBar（4 个标签）
│   ├── app.tsx              # 启动时执行"每日顺延革新"
│   ├── storage.ts           # 跨端存储适配层
│   ├── types/task.ts        # 数据模型（与 Web 端一致）
│   ├── utils/               # 日期工具 + 象限/统计逻辑（与 Web 端一致）
│   ├── store/useTaskStore.ts# zustand 状态（业务逻辑与 Web 端一致）
│   └── pages/
│       ├── index/           # 概览
│       ├── quadrant/        # 四象限看板（核心）
│       ├── weekly/          # 周复盘
│       └── life/            # 人生主线（目标 + 项目）
```

## 本地构建与运行

> 需要本机有网络（用于首次 `npm install`）。本仓库的沙箱环境无外网，因此依赖安装在你自己的电脑上执行。

```bash
cd taro-app
npm install
npm run build:weapp      # 构建到 dist/，用微信开发者工具打开 dist/ 预览
# 或开发模式（文件改动自动重建）：
npm run dev:weapp
```

## 上线发布

1. 去 [mp.weixin.qq.com](https://mp.weixin.qq.com) 注册小程序账号（个人版免费）
2. 把 `project.config.json` 里的 `"appid": "touristappid"` 改成你自己的 AppID
3. 微信开发者工具 → 导入项目 → 选择 `taro-app/dist/` 目录
4. 真机预览无误后，上传代码并提交审核（通常 1–3 天）
5. 审核通过即发布，可通过分享卡片裂变获客（各页面已接入 `onShareAppMessage`）
