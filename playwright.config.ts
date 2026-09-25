import{defineConfig,devices}from'@playwright/test';
export default defineConfig({testDir:'tests/browser',fullyParallel:true,use:{baseURL:process.env.PLAYWRIGHT_BASE_URL||'http://localhost:4173',trace:'retain-on-failure'},projects:[{name:'chromium',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['Pixel 7']}}],reporter:[['list'],['html',{open:'never'}]]});
