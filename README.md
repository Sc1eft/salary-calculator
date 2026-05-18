# 💰 赚钱计时器 — 实时收入追踪 PWA

每一秒的努力都看得见。输入月薪，实时计算每秒收入，追踪工时、加班、休息，让时间价值一目了然。

## ✨ 功能

- **实时收入计算** — 输入月薪，每秒更新已赚金额，支持正常/加班双费率，收入构成可视化进度条
- **工时追踪** — 工作、加班、休息三计时器，进度条直观展示，活跃计时器呼吸动效
- **智能加班** — 超过设定工时自动按倍率计算加班收入，支持工作日/周末不同倍率
- **消费换算** — 添加想买的物品，查看「今天赚了 X 杯奶茶」的趣味换算
- **心愿单** — 设定大额目标，追踪距离实现还有多远，支持图片参考
- **月进度环** — SVG 环形图展示本月收入占月薪比例
- **统计洞察** — Chart.js 收入趋势图（含骨架屏加载）、日均/最高/出勤天数统计
- **成就系统** — 全勤、加班王、万元户等 12 个成就徽章，弹窗通知非侵入提醒
- **下班报告** — 下班弹窗展示收入/工时明细，带金币爆炸动画
- **日历历史** — 日历视图查看每日工作记录，支持导航翻月
- **分享传播** — 生成精美 Canvas 收入卡片，一键分享到微信/朋友圈，含收入百分位排名
- **数据管理** — CSV/JSON 导出导入，本地持久化存储，Firebase 云同步（可选）
- **深色模式** — 自动跟随系统，也可手动切换
- **PWA 离线** — Service Worker 缓存，可安装到桌面离线使用
- **中英文切换** — 支持简体中文 / English 界面
- **社保税务计算** — 社保/公积金/个税估算，英文环境自动简化

## 🚀 快速开始

### 直接使用
用浏览器打开 `index.html` 即可，无需构建工具。

### 本地开发
```bash
# 任意 HTTP 服务器均可
python -m http.server 8080
# 或
npx http-server -p 8080
```

访问 `http://localhost:8080`。

## 🗺️ 使用流程

1. 设置月薪 → 自动计算每秒费率
2. 点击「🚀 上班」开始计时
3. 工时每秒累加，收入实时刷新
4. 可选「☕ 休息」暂停计时
5. 点击「🔚 下班」生成今日报告
6. 查看统计、成就、日历，分享到朋友圈

## 🏛️ 技术栈

- **纯前端** — 单 HTML 文件（~5600 行），无框架依赖
- **Chart.js 4.4.7** — 收入趋势图表
- **Canvas 2D API** — 分享卡片生成（600×900 px）
- **Web Share API** — 移动端原生分享面板
- **Firebase Auth + Firestore** — Google/Apple 登录与云同步（可选）
- **localStorage** — 本地数据持久化
- **CSS 自定义属性** — 亮色/暗色双主题
- **PWA** — manifest.json + Service Worker 离线支持

## ☁️ 云同步（可选）

登录后可在不同设备间同步工作记录。需要配置 Firebase 项目：

1. 前往 [Firebase Console](https://console.firebase.google.com/) 创建项目
2. 启用 **Authentication** → **Google**、**Apple** 和 **Email/Password** 登录方式
3. 创建 **Cloud Firestore** 数据库（选择测试模式）
4. 在项目设置 → 通用 → 你的应用 → Web 应用中获取配置
5. 打开 `index.html`，搜索 `FIREBASE_CONFIG`，替换为你的配置

```javascript
const FIREBASE_CONFIG = {
  apiKey: "你的API_KEY",
  authDomain: "你的项目.firebaseapp.com",
  projectId: "你的项目ID",
  storageBucket: "你的项目.appspot.com",
  messagingSenderId: "你的发送者ID",
  appId: "你的应用ID"
};
```

推荐 Firestore 安全规则：
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/data/{document} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

未配置 Firebase 时，应用完全离线可用，数据仅存储在本地 localStorage。

## 📧 邮箱登录（Email/Password）

微信和 QQ 登录需要开发者账号资质认证（营业执照），因此改用 **邮箱密码登录**，由 Firebase Auth 原生支持，无需额外服务端。

### 开启邮箱登录

1. 前往 [Firebase Console](https://console.firebase.google.com/) → Authentication → Sign-in method
2. 启用 **Email/Password** 提供商
3. 保存即可

用户在登录界面的邮箱表单中可以直接 **登录** 或 **注册** 新账号。

## 📦 项目结构

```
salary-calculator/
├── index.html       # 全部 HTML/CSS/JS（单文件 SPA，~5600 行）
├── manifest.json    # PWA 配置
├── sw.js            # Service Worker
├── icon.svg         # PWA 图标（金色 ¥）
├── firebase.json    # Firebase 项目配置
├── functions/       # （可选的微信/QQ OAuth Cloud Functions，需营业执照）
└── README.md        # 本文件
```

## 👤 作者

[Sclefe](https://github.com/Sc1eft)

## 📄 许可

MIT
