# AID Admin — AI 漫剧 · AI 电影 · AI 漫画运营管理端

<p>
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/React-18-61DAFB.svg" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.5-3178C6.svg" alt="TypeScript">
  <img src="https://img.shields.io/badge/Ant%20Design-5-0170FE.svg" alt="Ant Design">
  <img src="https://img.shields.io/badge/Vite-5-646CFF.svg" alt="Vite">
</p>

<h2 align="center">🌐 官方入口</h2>
<p align="center">
  <a href="https://www.aidstudio.com.cn/"><strong>官方运营站：https://www.aidstudio.com.cn/</strong></a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="https://gzxxaitdb.feishu.cn/docx/LZ5zdesEgo1z4Mxc7OWc7zTHnJc"><strong>📘 部署与使用教程</strong></a><br>
  在线体验 AID，了解 AI 漫剧、AI 电影、AI 漫画三大创作方向及官方运营服务。
</p>

AID 开源 AI 漫剧、AI 电影、AI 漫画创作平台的运营管理端：提供 AI 模型与供应商管理、官方 API 统一网关、用户/订单/计费管理、内容运营、系统升级等后台能力。

## AID 平台介绍

AID 是一套面向 **AI 漫剧、AI 电影、AI 漫画** 的开源内容创作平台。它把创作过程拆成连续的业务链路：剧本创作、分集管理、角色/道具/场景资产、分镜拆解、图片生成、图生视频、配音合成和成片管理。创作者不需要在多个模型平台之间来回切换，也不需要手动维护大量素材与生成记录，平台会以项目为中心组织全部内容资产。

整个平台由三部分组成：`aid-server` 提供 Java 服务端、数据库、任务调度、计费和升级能力；`aid-web` 提供用户创作工作台；`aid-admin` 则是运营管理端，也就是本仓库。三端配合后，可以形成一套可私有化部署、可接入多模型、可运营计费、可在线升级的 AI 内容创作系统。

对运营人员来说，AID Admin 是平台的控制台。你可以在这里维护 AI 供应商密钥、模型能力、价格 SKU、并发限制、用户资料、充值订单、内容审核、首页运营内容和系统升级策略。对于准备二次开发的团队，它也提供了清晰的配置入口，让模型扩展、业务开关和平台运营不必写死在代码里。

## 三大核心创作方向

AID 将不同内容形态分别组织为清晰的创作方向。运营人员可以针对每个方向配置模型能力、生成价格、并发限制、内容审核和任务监控策略。

### AI 漫剧

面向连载化、分集化和角色驱动的动态内容生产。后台可以管理分集与分镜内容、图生视频、首尾帧视频、多镜头片段、角色配音、TTS 音频、视频时长与清晰度能力，以及相应的任务状态和计费规则。适合运营竖屏漫剧、AI 短剧、漫改短视频、剧情账号和连续更新的 IP 内容。

### AI 电影

面向更强调电影叙事、镜头语言和视觉统一的影像创作。后台可以维护电影化创作所需的文本、图片、视频与语音模型，配置分辨率、比例、时长、参考图、并发和价格能力，并统一查看多镜头生成任务与成片素材。适合运营 AI 短片、概念预告片、品牌故事片和电影化剧情内容。

### AI 漫画

面向以静态画面承载故事的连续视觉创作。后台可以管理角色、道具、场景、分镜图、参考图、内容审核、首页展示、图片模型能力和生成价格，让创作者稳定产出条漫、页漫、故事漫画、绘本、广告分镜和 IP 角色内容。

本仓库适合关注这些工作的开发者：

- 配置和运营 AI 漫剧、AI 电影、AI 漫画三类创作业务
- 管理多家 AI 厂商、多种模型、多种生成能力和计费规则
- 维护用户、订单、余额流水、内容审核和后台权限
- 通过页面检查版本、安装升级器、发起在线升级与回退

## 交流与反馈

部署、模型配置、二次开发或创作流程接入遇到问题，可以前往服务端仓库 [aid-server](https://gitee.com/gzxx-2025/aid-server) README 顶部扫码加入交流群，也欢迎提交 Issue。

## 仓库矩阵

| 端 | 说明 | Gitee | GitHub |
|----|------|-------|--------|
| aid-server | Java 服务端（统一发布入口） | [gitee](https://gitee.com/gzxx-2025/aid-server) | [github](https://github.com/gzxx-2025/aid-server) |
| aid-admin | 运营管理端（本仓库） | [gitee](https://gitee.com/gzxx-2025/aid-admin) | [github](https://github.com/gzxx-2025/aid-admin) |
| aid-web | 用户创作端 | [gitee](https://gitee.com/gzxx-2025/aid-web) | [github](https://github.com/gzxx-2025/aid-web) |

## 官方资产包

服务端同版本发布页提供 `aid-official-assets_<版本>.tar.gz`，用于补齐首次部署时的平台官方展示与创作示例素材，包括角色、场景、道具、光影、景别/焦距、姿态、表情、特效、分镜示例、智能体与供应商图标、语音头像与 MP3 试听、首页图片及演示视频。

资产包只包含 `aid_init` 初始化库实际引用的官方文件，不包含用户生成内容、账号、密钥或日志。包内原样保留 `files/aid/...` 对象键，可导入本地存储、阿里云 OSS 或腾讯云 COS；导入后在本管理端配置对应的存储模式和访问域名即可，无需批量修改初始化 SQL。下载与完整导入说明见 [aid-server Releases](https://github.com/gzxx-2025/aid-server/releases)，国内用户也可从 [Gitee 版本入口](https://gitee.com/gzxx-2025/aid-server/releases) 查看对应版本。

## 主要功能

- AI 能力中心：模型/供应商管理、模型能力配置（分辨率/时长/参考图上限）、计费 SKU、模型健康监控、官方 API 统一网关（含例外模型）
- 运营管理：用户资料、充值套餐、支付订单、余额流水、邀请关系、内容审核、首页 Banner、公告与 FAQ
- 系统管理：组织权限、菜单、字典、定时任务、全局业务配置（动态热生效）
- 项目升级：版本检查、一键升级、升级器管理、版本回退、升级源配置

## 技术栈

React 18 · TypeScript 5 · Ant Design 5 · Vite 5 · React Router v6 · Zustand · Axios · Less

## 快速开始

```bash
npm install
npm run dev          # 开发（端口 5173，代理到本地后端 8080）
npm run build        # 生产构建（产物 dist/）
npm run typecheck    # 类型检查
npm run lint         # 代码检查
```

开发代理与接口前缀由 `.env.development` 控制：

- `VITE_APP_BASE_API=/dev-api`（开发）/ `/prod-api`（生产）
- `VITE_BACKEND_HOST=http://127.0.0.1:8080`（真实后端地址，仅开发代理使用）

## 与后端对接

- Token 存储于 Cookie（`Admin-Token`），请求头 `Authorization: Bearer <token>`
- 响应体统一 `{ code, msg, data }`，`code=401` 自动弹出重新登录
- 生产环境由 Nginx 将 `/prod-api/` 反代到后端 8080（配置示例见服务端仓库的《上线部署指南》）

## 目录结构

```text
src/
├── api/           业务 API（按模块分目录，TypeScript 类型化）
├── components/    通用组件（CrudPage / DictTag / ImageUpload ...）
├── hooks/         useAuth / useDict / useTheme
├── layouts/       整体布局（侧边栏含系统版本状态入口）
├── router/        常量路由 + 后端动态路由
├── store/         Zustand 全局状态
├── utils/         request 封装 / 鉴权 / 校验
└── views/         页面（aid 业务 / aidconfig 配置 / system 系统管理）
```

## 构建部署

`npm run build` 产物为纯静态文件（默认根路径 `/` 构建，与常规 Nginx 静态托管一致；需要子路径部署时修改 `.env.production` 的 `VITE_APP_CONTEXT_PATH` 后重新构建），由 Nginx 托管并将 `/prod-api/` 反代到服务端。完整部署流程与在线升级方式见服务端仓库 [aid-server](https://gitee.com/gzxx-2025/aid-server) 的 `deploy/README.md`（统一管理脚本 `aid.sh` 一键部署，管理端产物随统一发布包分发、独立端口托管，无需单独部署）。

**整套系统的服务器配置要求**（部署脚本自动校验）：

| 部署内容 | 最低配置 | 推荐配置 |
|---------|---------|---------|
| Docker 全栈（不启用 RocketMQ） | 2核 4G / 40G 磁盘 | 4核 8G / 100G+ 磁盘 |
| Docker 全栈 + RocketMQ | 4核 6G / 40G 磁盘 | 6核 12G / 100G+ 磁盘 |

推算依据与手动部署要求见服务端仓库部署指南「配置要求」一节。

## 开源协议

本项目基于 [MIT License](LICENSE) 开源，版权归光子讯息(杭州)科技有限公司所有。

后台管理框架部分基于 [RuoYi-Vue](https://gitee.com/y_project/RuoYi-Vue)（MIT License）二次开发，特此致谢。
