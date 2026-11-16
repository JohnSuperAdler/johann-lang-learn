# 韓語／葡萄牙語學習

個人用的語言學習網頁：韓語與巴西葡萄牙語，從字母、單字到文法，含語音播放、單元考試、課後複習與每日複習。可安裝到手機主畫面並離線使用。

- 技術：Vite、Svelte 5、TypeScript；學習紀錄存在瀏覽器的 IndexedDB，不會上傳。
- 教材：`public/content/`（JSON）。教材由 AI 撰寫，未經母語者校對。
- 語音：使用裝置內建的語音合成（ko-KR、pt-BR）。

## 開發

```
npm install
npm run dev        # 開發伺服器
npm run validate   # 檢查教材格式
npm run check      # 型別檢查
npm test           # 測試
npm run build      # 建置到 dist/
npm run preview    # 以 localhost:4173 預覽建置結果（可測離線與安裝）
```

## 部署

推送到 `main` 後，`.github/workflows/deploy.yml` 會自動檢查、測試、建置並部署到 GitHub Pages。
儲存庫需先在 Settings → Pages 把 Source 設為「GitHub Actions」。
