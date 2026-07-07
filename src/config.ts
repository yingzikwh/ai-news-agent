// 前端全局配置
export const APP_CONFIG = {
  name: 'AI News Agent',
  nameInitial: 'AI',
  description: '全自动 AI 资讯抓取客户端',
  version: '1.0.0',
  // API 基址：开发环境由 Vite proxy 转发 /api，生产/Electron 由 Express 同源托管，
  // 因此统一使用相对路径，无需区分环境。
  apiBase: '',
};

export default APP_CONFIG;
