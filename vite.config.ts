import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // DeepSeek 官方文档建议 baseURL 不带 /v1 后缀：
      // 客户端请求 /deepseek/v1/chat/completions，这里剥掉 /deepseek 前缀转发
      '/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/deepseek/, ''),
      },
    },
  },
})
