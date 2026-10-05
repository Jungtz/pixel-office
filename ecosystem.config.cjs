// pm2 正式環境啟動檔：只跑後端（同時 serve dist/ 靜態 + /api）。
// 用 node --import tsx/esm 直接跑 server.ts，避開 Windows 上 pm2 把 NPX.CMD 當 JS 解析的問題。
// PORT / BASE_PATH 由 .env 提供（.env 需在 npm run build 前設好 BASE_PATH）。
module.exports = {
  apps: [
    {
      name: 'pixel-office',
      script: 'server.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx/esm',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
