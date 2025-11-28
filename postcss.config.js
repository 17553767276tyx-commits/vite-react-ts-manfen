export default {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  }
  ```
  
  ---
  
  ### 🚑 紧急自救（如果还是不行）
  
  如果你做完上面所有步骤，界面还是乱的。请在 StackBlitz 下方的 **Terminal (终端)** 里输入这行命令并回车：
  
  ```bash
  npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init -p