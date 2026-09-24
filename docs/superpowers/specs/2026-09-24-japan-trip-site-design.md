# 日本快樂玩：手機行程網站設計規格

日期：2026-09-24
來源行程：https://hackmd.io/@VQyUCJokRdapMGOlnEbmDg/SyinLOXUGg
旅程：2026/09/30 桃園 → 成田，2026/10/05 成田 → 桃園。住宿 KOKO HOTEL 上野駅前（全程）。

## 1. 目標

- 一個手機直式優先的網站，同行者用手機瀏覽器打開網址即可使用，看的人不需登入。
- 包含 HackMD 上所有景點與餐廳，每天依地理位置重排成不走回頭路的順序。
- 每個景點標註最近車站與路線，每一段路可一鍵開 Google Maps 大眾運輸導航。
- 每天有地圖顯示編號圖釘與路線。
- 可新增、編輯、刪除景點，所有人看到同一份資料（即時同步）。
- 託管在 GitHub Pages，資料存 Firebase Firestore 免費方案。

## 2. 非目標（YAGNI）

- 不做使用者帳號系統；只有一組共用 PIN 碼作編輯門檻。
- 不做自動路線最佳化；新增景點時由使用者指定插入位置。
- 不做即時電車時刻查詢；交由 Google Maps 導航按鈕。
- 不做多趟旅程管理；固定一趟旅程。

## 3. 技術架構

純靜態網頁，不需建置工具。

| 檔案 | 用途 |
|---|---|
| `index.html` | 單頁結構，載入 Leaflet 與 Firebase（CDN） |
| `style.css` | 手機直式樣式，含深色模式 |
| `app.js` | 狀態、渲染、同步、新增編輯邏輯 |
| `data/itinerary.json` | 原始行程種子資料（含座標、車站、交通指引） |
| `firebase-config.js` | Firebase 設定、`tripId`、PIN。Firebase web config 本來就是公開值，可直接放在 repo；提供 `firebase-config.example.js` 範本 |
| `SETUP.md` | Firebase 與 GitHub Pages 設定步驟（給使用者） |
| `firestore.rules` | Firestore 安全規則 |

外部依賴（皆 CDN，免金鑰）：

- Leaflet 1.9 + OpenStreetMap 圖磚：地圖與圖釘。
- Firebase JS SDK v10（modular，經 CDN ESM）：Firestore 讀寫與即時監聽。
- Nominatim（OpenStreetMap 地理編碼 API）：新增景點時依名稱搜尋座標。使用時帶 `accept-language=zh-TW,ja` 並限制在東京範圍（viewbox）。

## 4. 資料模型

Firestore 路徑：`trips/{tripId}/spots/{spotId}`。`tripId` 為一組隨機 20 字元字串，寫在 `firebase-config.js`。

Spot 文件欄位：

| 欄位 | 型別 | 說明 |
|---|---|---|
| `day` | string | `"2026-09-30"` … `"2026-10-05"` |
| `order` | number | 當天排序，使用 1000、2000… 間隔以便插入 |
| `name` | string | 顯示名稱（中文為主，可附日文） |
| `category` | string | `sight` / `food` / `shop` / `transit` / `hotel` |
| `timeHint` | string | 可空。例：「午餐」「14:00 場次」 |
| `lat`, `lng` | number | 座標 |
| `station` | string | 可空。例：「銀座線 淺草站 1 號出口」 |
| `legFromPrev` | string | 可空。到此站的交通指引，例：「步行 6 分」「TX 淺草→秋葉原 約 5 分」 |
| `note` | string | 可空。備註 |
| `mapsUrl` | string | 可空。原始 Google Maps 連結 |
| `source` | string | `seed`（原始）或 `user`（新增） |
| `updatedAt` | timestamp | 伺服器時間 |

另有 `trips/{tripId}` 文件，欄位 `seeded: true` 表示種子已寫入，避免重複匯入。

固定資訊（航班、飯店、集合時間）不存 Firestore，直接寫在 `itinerary.json` 的 `meta` 區塊並顯示於頁首。

## 5. 資料流程

1. 頁面載入：先讀 `localStorage` 快取立即渲染（離線可看）。
2. 連上 Firestore，`onSnapshot` 監聽 `spots` 集合；每次變動重新渲染並更新快取。
3. 若 `trips/{tripId}` 不存在或 `seeded != true`：從 `itinerary.json` 批次寫入所有景點，並設 `seeded: true`。多人同時首開時以 transaction 保護只寫一次。
4. 新增 / 編輯 / 刪除：直接寫 Firestore，由監聽回流更新畫面。離線時 Firestore SDK 會排隊，恢復連線後送出。

## 6. 畫面設計（手機直式，寬 360–430px 為主）

### 6.1 頁首（隨頁面捲動；只有日期分頁列固定在頂端）

- 標題「日本快樂玩」。
- 一行摘要：飯店名稱（點擊開 Google Maps）、去程 9/30 09:00–13:25、回程 10/5 20:40–23:20、7:00 桃機二航集合。
- 日期分頁列：6 個 chip（9/30 … 10/5），橫向可捲動，預設選「今天」若在旅程中，否則選第一天。

### 6.2 每日時間軸

- 日期標題與主題（例：「10/1 淺草、秋葉原、晴空塔」）。
- 景點卡片依 `order` 排列。卡片內容：
  - 左側圓形編號（與地圖圖釘一致）。
  - 名稱、分類標籤（色塊）、`timeHint`。
  - 車站列（圖示 + `station`）。
  - `note`（可折疊）。
  - 「新增」小標示（`source == user`）。
  - 兩個按鈕：「開地圖」（開 `mapsUrl`，無則以座標開 Google Maps 地點）；「從上一站導航」（Google Maps directions，`travelmode=transit`，origin 為上一站座標，destination 為本站座標。第一站的 origin 為飯店）。
  - 「⋯」選單：編輯、刪除（刪除需二次確認）。
- 卡片之間顯示 `legFromPrev` 小字（有值才顯示）。

### 6.3 地圖

- 每日時間軸下方一塊高 55vh 的 Leaflet 地圖，可全螢幕。
- 顯示當天所有景點的編號圖釘與依序連線（polyline，僅示意順序，非實際路徑）。
- 點圖釘：捲動到對應卡片並短暫高亮。
- 切換日期時 `fitBounds` 到當天範圍。

### 6.4 新增 / 編輯表單（底部彈出 sheet）

欄位：名稱（必填）、座標來源、分類、時段、車站、交通指引、備註、插入位置。

座標來源二選一：

- 「搜尋」：輸入名稱後按搜尋，呼叫 Nominatim，列出前 5 筆結果供選擇。
- 「貼 Google Maps 連結」：解析 `@lat,lng` 或 `!3d..!4d..` 或 `query=lat,lng`；短連結（maps.app.goo.gl）無法在瀏覽器解析，顯示提示請改用搜尋或在 Google Maps 長按取得座標。

插入位置：下拉選單「放在 ○○ 之後」（含「當天第一站」）。`order` 取前後兩者中點；若無間隔則重排當天。

### 6.5 PIN 碼

- 首次按「+」、編輯或刪除時要求輸入 PIN。與 `firebase-config.js` 內的 PIN 比對，正確則存 `localStorage.pinOk = true`，此後不再詢問。
- 說明：此為防誤觸與防陌生人的輕量門檻，Firestore 規則另以 `tripId` 隱蔽性保護（見第 8 節）。

### 6.6 視覺

- 直式單欄，底部安全區留白，字級不小於 15px。
- 分類色：景點藍、餐廳橘、購物綠、交通灰、住宿紫。
- 支援深色模式（`prefers-color-scheme`）。
- 不用框架；CSS 自訂變數。

## 7. 種子行程（重排後）

每個景點於實作階段解析 Google Maps 連結取得座標；短連結以 HTTP 重導向取得完整網址。取不到者以 Nominatim 或已知地址查詢。

### 9/30（三）上野入住與晚餐

1. 成田機場 → Skyliner → 京成上野（transit，已購票）
2. KOKO HOTEL 上野駅前：放行李（hotel）
3. 上野之森櫻花台 4F 觀景（sight）— JR 上野站 不忍口旁
4. 阿美橫町（shop）— 步行 3 分
5. OS Drug 上野店（shop）
6. 二木の菓子 第一営業所（shop）
7. 唐吉軻德 上野店（shop）
8. とんかつ山家 御徒町店（food，晚餐）— JR 御徒町站

### 10/1（四）淺草、秋葉原、晴空塔

1. 雷門（sight）— 上野 銀座線 → 淺草 約 5 分
2. 淺草炸肉餅（food）
3. 淺草 花月堂 本店（food，波蘿麵包）
4. 淺草寺（sight）
5. 壽壽喜園 淺草本店（food，抹茶冰）
6. Animate Akihabara（shop）— つくばエクスプレス 淺草 → 秋葉原 約 5 分
7. 東京晴空塔（sight）— JR 秋葉原 → 錦糸町 → 半藏門線 → 押上 約 20 分
8. 文字燒 だるま（food，晚餐）
9. 回上野：押上 都營淺草線 → 淺草 → 銀座線 → 上野

### 10/2（五）池袋、吉伊卡哇樂園、新宿

1. 焼肉あぶる 池袋店（food，午餐）— JR 山手線 上野 → 池袋 約 17 分
2. 吉伊卡哇樂園（sight，14:00 場次）
3. 藍瓶咖啡 池袋店（food）
4. LUMINE Shinjuku 1（shop）— JR 山手線 池袋 → 新宿 約 9 分
5. KIDDYLAND Shinjuku（shop）
6. 四文錢 新宿東口店（food，晚餐）
7. 回上野：JR 山手線 新宿 → 上野 約 25 分

### 10/3（六）下北澤、澀谷、原宿

1. 46ma（food，午餐）— 上野 山手線 → 澀谷 → 井之頭線 → 下北澤 約 45 分
2. Shelter Shimokitazawa（sight，孤獨搖滾）
3. Marché 下北澤（sight，孤獨搖滾）
4. Tower Records 澀谷店（shop）— 井之頭線 下北澤 → 澀谷 約 5 分
5. SWEET PALACE Crepes 竹下通（food）— JR 山手線 澀谷 → 原宿 1 站
6. @cosme TOKYO 原宿旗艦店（shop）
7. 阿夫利 原宿（food，晚餐）
8. 回上野：JR 山手線 原宿 → 上野 約 30 分

### 10/4（日）東京鐵塔、港區

1. 東京鐵塔（sight）— 上野 日比谷線 → 神谷町 約 25 分

### 10/5（一）回程

1. 地瓜球（food）
2. 京成上野 → Skyliner → 成田機場（transit，建議 17:00 前出發，20:40 起飛）

## 8. Firestore 安全規則

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trips/{tripId} {
      allow read, write: if true;
      match /spots/{spotId} {
        allow read, write: if true;
      }
    }
  }
}
```

安全性說明：資料庫對知道 `tripId` 的人開放讀寫；`tripId` 與 PIN 出現在網頁原始碼與 GitHub repo 中（GitHub Pages 免費方案需公開 repo）。因此這只是防誤觸與防隨機掃描，不是防有心人的機制。對旅遊行程足夠，已向使用者說明。

## 9. 錯誤處理

- 設定未填：進入「本機模式」，黃色提示說明新增只存在這支手機、不會同步；新增編輯刪除皆可用，存 localStorage。設定好 Firebase 後改讀雲端資料。
- Firebase 連線失敗：黃色提示「連線失敗」，仍以快取顯示行程；有 db 物件時新增按鈕可用，寫入由 SDK 離線排隊。
- 連線流程：先掛 `onSnapshot` 監聽，種子寫入在背景執行，避免離線時卡在連線中。
- Nominatim 無結果或逾時：表單顯示「找不到，請改貼連結」。
- 貼入的連結解析不到座標：顯示原因與如何在 Google Maps 取得座標。
- 刪除前二次確認；種子景點刪除後可從「⋯」選單「還原原始行程」（重新匯入缺少的 seed 景點，不覆蓋使用者修改）。

## 10. 測試

- 資料層純函式（連結解析、order 中點計算、Nominatim 結果轉換）以 Node 內建 `node:test` 測試，放 `tests/`。
- 手動驗證清單（寫進 `SETUP.md`）：手機 Chrome 與 Safari 打開、切換日期、圖釘與卡片對應、導航按鈕開啟 Google Maps 為大眾運輸模式、兩支手機新增後互相看到、離線重開仍能看。

## 11. 交付給使用者的步驟（寫入 SETUP.md）

1. Firebase Console 建專案 → 建 Firestore（production mode）→ 貼上 `firestore.rules` → 專案設定取得 web app config。
2. 複製 `firebase-config.example.js` 為 `firebase-config.js`，貼入 config、設定 PIN、產生 `tripId`。
3. GitHub 建 repo → 上傳全部檔案（含 `firebase-config.js`）→ Settings → Pages → Branch main → 取得網址。
4. 手機打開網址，第一次載入會自動匯入原始行程。
