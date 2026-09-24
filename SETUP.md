# 設定步驟（約 15 分鐘）

網站不設定 Firebase 也能打開看行程，新增的內容會存在該支手機（本機模式）。
要讓同行的人共用一份、即時同步，請完成 A、B 兩段。

## A. 建立 Firebase 專案（存放大家共用的景點資料）

1. 用 Google 帳號開 https://console.firebase.google.com → 「建立專案」→ 名稱隨意（例如 japan-trip）→ Google Analytics 可關閉 → 建立。
2. 左側「建構」→「Firestore Database」→「建立資料庫」→ 位置選 `asia-northeast1`（東京）→ 選「以正式版模式啟動」→ 啟用。
3. 進入 Firestore 的「規則」分頁，把內容全部換成本專案 `firestore.rules` 的內容 → 「發布」。
4. 回到專案總覽，點「</>」（新增網頁應用程式）→ 暱稱隨意 → 不勾選 Hosting → 註冊 → 會看到一段 `const firebaseConfig = { apiKey: "...", ... }`，把大括號裡的六個值複製下來。
5. 打開本專案的 `firebase-config.js`，把六個值貼進對應欄位；`TRIP_ID` 填一串隨機英數（例如 `k8z2m4q9v1x7c3b6n5p0`）；`EDIT_PIN` 填你要的 PIN（例如 `2026`）。存檔。

## B. 放上 GitHub Pages（讓大家用網址打開）

1. 到 https://github.com → 右上「+」→「New repository」→ 名稱例如 `japan-trip` → Public → Create。
2. 把本專案資料夾的所有檔案上傳（網頁上「uploading an existing file」拖曳整個資料夾內容即可；或用 git push）。`firebase-config.js` 要一起上傳。`docs/` 與 `tests/` 可不上傳。
3. Repo 的「Settings」→ 左側「Pages」→ Source 選「Deploy from a branch」→ Branch 選 `main`、資料夾 `/ (root)` → Save。
4. 約 1 分鐘後同頁會顯示網址 `https://<你的帳號>.github.io/japan-trip/`，用手機打開即可。把網址與 PIN 傳給同行的人。
5. 手機上可用瀏覽器的「加入主畫面」，之後像 App 一樣點開。

## C. 之後要改東西

- 現場新增或修改景點：直接在網站上按「＋」或卡片的「⋯」，輸入一次 PIN 即可，所有人同步。
- 新增景點時取得位置的三種方法（擇一）：
  1. **貼地址（最準）**：在 Google Maps 點該店 → 複製地址（例如「〒110-0005 東京都台東区上野４丁目９−８」）→ 貼到「地址」欄 → 按「搜尋座標」。網站會自動去掉郵遞區號、轉半形，用日本國土地理院的地址資料定位。
  2. **用名稱搜尋**：只填名稱按「搜尋座標」，用 OpenStreetMap 找，知名景點可以，小店常找不到。
  3. **貼完整連結**：Google Maps 網頁版網址列的完整網址（含 `@35.7…,139.7…`）貼到連結欄 → 「從連結取座標」。手機 App「分享」給的短網址（maps.app.goo.gl）沒有座標，只能當「開地圖」用，位置請改用方法 1。
- 改原始行程文字（例如交通指引）：改 `data/itinerary.json` 後重新上傳。已經寫進 Firebase 的資料不會自動更新；要套用新內容，可在卡片「⋯」→「還原原始行程」補回缺少的項目，或在 Firebase Console 刪掉 `trips/<TRIP_ID>` 文件後重新打開網站（會重新匯入）。
- 本機模式下新增的內容存在瀏覽器裡；設定好 Firebase 後第一次打開會改讀雲端資料，本機新增的內容不會自動搬過去，需重新輸入。

## D. 手動測試清單

- [ ] 手機 Safari 與 Chrome 打開網址，頁首、分頁、卡片顯示正常，無橫向捲動。
- [ ] 切換六個日期，地圖自動縮放到當天範圍，圖釘編號與卡片編號一致，點圖釘卡片會高亮。
- [ ] 「開地圖」開啟 Google Maps 到正確地點；「從上一站導航」開啟 Google Maps 且為大眾運輸模式。
- [ ] 按「＋」→ 輸入 PIN → 搜尋座標 → 儲存，卡片出現「新增」標籤，另一支手機幾秒內看到。
- [ ] 編輯與刪除後另一支手機同步。
- [ ] 開飛航模式重新打開網站，仍能看到行程；恢復網路後狀態列消失。

## E. 安全性說明

資料庫對知道 `TRIP_ID` 的人開放讀寫，`TRIP_ID` 與 PIN 都在公開的 repo 裡看得到。這只是防誤觸與防隨機掃描，不是防有心人的機制，對旅遊行程來說足夠。旅程結束後可到 Firebase Console 把專案刪除。
