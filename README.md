API Memo

# スプレッドシート API リファレンス

すべてのレスポンスは以下の共通フォーマットで返ります。

```json
{ "ok": true,  "data": { ... } }   // 成功
{ "ok": false, "error": "メッセージ" } // 失敗
```

`sheet` パラメータはシート名（文字列）または 0 始まりのインデックス番号（数値・数字文字列）を受け付けます。省略するとアクティブシートが対象になります。

---

## GET エンドポイント

### `read` — シート全体を読む

```
GET ?action=read&sheet=Sheet1
```

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `sheet` | 任意 | シート名 or インデックス（省略=アクティブ） |

**返り値 `data`**

```json
{
  "sheet": "Sheet1",
  "rows": [
    { "名前": "山田", "点数": 95 },
    { "名前": "鈴木", "点数": 80 }
  ],
  "count": 2
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `sheet` | string | 実際に読んだシート名 |
| `rows` | object[] | ヘッダーをキーにしたオブジェクトの配列 |
| `count` | number | データ行数（ヘッダー除く） |

---

### `cell` — 特定セルを読む

```
GET ?action=cell&sheet=Sheet1&cell=B3
```

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `sheet` | 任意 | シート名 or インデックス |
| `cell` | 必須 | A1記法のセル番地 |

**返り値 `data`**

```json
{
  "cell": "B3",
  "value": 42
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `cell` | string | 指定したセル番地 |
| `value` | any | セルの値（数値・文字列・真偽値など） |

---

### `range` — 範囲を読む

```
GET ?action=range&sheet=Sheet1&range=A1:C5
```

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `sheet` | 任意 | シート名 or インデックス |
| `range` | 必須 | A1記法の範囲 |

**返り値 `data`**

```json
{
  "range": "A1:C5",
  "values": [
    ["名前", "点数", "備考"],
    ["山田",  95,   "優秀"],
    ["鈴木",  80,   ""]
  ]
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `range` | string | 指定した範囲 |
| `values` | any[][] | 行×列の2次元配列 |

---

### `find` — キーで行を検索

```
GET ?action=find&sheet=Sheet1&col=メール&value=test@example.com
```

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `sheet` | 任意 | シート名 or インデックス |
| `col` | 必須 | 検索対象の列名（ヘッダー行の値） |
| `value` | 必須 | 検索する値（文字列として比較） |

**返り値 `data`**

```json
{
  "found": [
    { "rowNum": 3, "名前": "山田", "メール": "test@example.com" }
  ],
  "count": 1
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `found` | object[] | マッチした行の配列。各オブジェクトに `rowNum`（シート上の行番号）を含む |
| `count` | number | マッチした件数 |

---

### `sheets` — シート一覧

```
GET ?action=sheets
```

パラメータなし。

**返り値 `data`**

```json
{
  "sheets": [
    { "index": 0, "name": "Sheet1" },
    { "index": 1, "name": "売上" }
  ]
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `sheets` | object[] | `index`（0始まり）と `name` を持つオブジェクトの配列 |

---

### `multiRead` — 複数シートを一括読み取り

```
GET ?action=multiRead&sheets=0,売上,Sheet3
```

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `sheets` | 任意 | カンマ区切りのシート名 or インデックス。省略すると全シートが対象 |

**返り値 `data`**

```json
{
  "results": [
    {
      "sheet": "Sheet1",
      "rows": [ { "名前": "山田" } ],
      "count": 1
    },
    {
      "sheet": "売上",
      "rows": [ { "商品": "りんご", "金額": 300 } ],
      "count": 1
    }
  ]
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `results` | object[] | 各シートの `read` 結果（`sheet` / `rows` / `count`）の配列 |

---

## POST エンドポイント

### `append` — 行を追加

```json
{ "action": "append", "sheet": "Sheet1", "row": { "名前": "山田", "点数": 95 } }
```

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `sheet` | 任意 | シート名 or インデックス |
| `row` | 必須 | 追加する行のオブジェクト（キー=ヘッダー名） |

**返り値 `data`**

```json
{
  "appended": { "名前": "山田", "点数": 95 },
  "newRowNum": 5
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `appended` | object | 追加したデータ（入力値をそのまま返す） |
| `newRowNum` | number | 追加後のシート上の行番号 |

---

### `write` — 特定セルを書き換える

```json
{ "action": "write", "sheet": "Sheet1", "cell": "B3", "value": 42 }
```

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `sheet` | 任意 | シート名 or インデックス |
| `cell` | 必須 | A1記法のセル番地 |
| `value` | 必須 | 書き込む値 |

**返り値 `data`**

```json
{
  "cell": "B3",
  "value": 42
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `cell` | string | 書き込んだセル番地 |
| `value` | any | 書き込んだ値 |

---

### `writeRange` — 範囲をまとめて書き換える

```json
{ "action": "writeRange", "sheet": "Sheet1", "range": "A1:B2", "values": [[1, 2], [3, 4]] }
```

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `sheet` | 任意 | シート名 or インデックス |
| `range` | 必須 | A1記法の範囲 |
| `values` | 必須 | 書き込む行×列の2次元配列 |

**返り値 `data`**

```json
{
  "range": "A1:B2",
  "written": "2行"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `range` | string | 書き込んだ範囲 |
| `written` | string | 書き込んだ行数（例: `"2行"`） |

---

### `update` — キーで行を更新

```json
{ "action": "update", "sheet": "Sheet1", "keyCol": "ID", "keyValue": "001", "updates": { "点数": 100 } }
```

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `sheet` | 任意 | シート名 or インデックス |
| `keyCol` | 必須 | 検索対象の列名 |
| `keyValue` | 必須 | 行を特定する値 |
| `updates` | 必須 | 更新するフィールドと値のオブジェクト |

**返り値 `data`**

```json
{
  "updatedRow": 3,
  "updates": { "点数": 100 }
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `updatedRow` | number | 更新したシート上の行番号 |
| `updates` | object | 更新したフィールドと値 |

---

### `delete` — キーで行を削除

```json
{ "action": "delete", "sheet": "Sheet1", "keyCol": "ID", "keyValue": "001" }
```

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `sheet` | 任意 | シート名 or インデックス |
| `keyCol` | 必須 | 検索対象の列名 |
| `keyValue` | 必須 | 行を特定する値 |

**返り値 `data`**

```json
{
  "deletedRow": 3
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `deletedRow` | number | 削除したシート上の行番号 |

---

### `bulkAppend` — 複数行を一括追加

```json
{ "action": "bulkAppend", "sheet": "Sheet1", "rows": [{ "名前": "A" }, { "名前": "B" }] }
```

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `sheet` | 任意 | シート名 or インデックス |
| `rows` | 必須 | 追加する行オブジェクトの配列 |

**返り値 `data`**

```json
{
  "appended": "2行",
  "startRow": 4
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `appended` | string | 追加した行数（例: `"2行"`） |
| `startRow` | number | 追加開始位置のシート上の行番号 |

---

### `clear` — シートをクリア（ヘッダー残す）

```json
{ "action": "clear", "sheet": "Sheet1" }
```

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `sheet` | 任意 | シート名 or インデックス |

**返り値 `data`**

```json
{
  "cleared": true,
  "sheet": "Sheet1"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `cleared` | boolean | 常に `true` |
| `sheet` | string | クリアしたシート名 |

---

### `multiAppend` — 複数シートに同じ行を一括追加

```json
{ "action": "multiAppend", "sheets": ["売上", "0", "Sheet3"], "row": { "名前": "山田", "点数": 95 } }
```

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `sheets` | 必須 | シート名 or インデックスの配列 |
| `row` | 必須 | 追加する行のオブジェクト |

**返り値 `data`**

```json
{
  "results": [
    { "sheet": "売上",  "newRowNum": 5 },
    { "sheet": "Sheet3", "newRowNum": 3 }
  ]
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `results` | object[] | 各シートの `sheet`（シート名）と `newRowNum`（追加後行番号）の配列 |

---

### `multiFind` — 複数シートを横断検索

```json
{ "action": "multiFind", "sheets": ["1月", "2月"], "col": "担当者", "value": "山田" }
```

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `sheets` | 必須 | シート名 or インデックスの配列 |
| `col` | 必須 | 検索対象の列名 |
| `value` | 必須 | 検索する値 |

**返り値 `data`**

```json
{
  "results": [
    { "sheet": "1月", "found": [ { "rowNum": 2, "担当者": "山田" } ], "count": 1 },
    { "sheet": "2月", "found": [], "count": 0 }
  ],
  "totalCount": 1
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `results` | object[] | 各シートの `sheet` / `found`（マッチ行の配列）/ `count` |
| `totalCount` | number | 全シートのマッチ件数の合計 |

---

### `multiClear` — 複数シートを一括クリア（ヘッダー残す）

```json
{ "action": "multiClear", "sheets": ["売上", "0", "Sheet3"] }
```

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `sheets` | 必須 | シート名 or インデックスの配列 |

**返り値 `data`**

```json
{
  "results": [
    { "sheet": "売上",   "cleared": true },
    { "sheet": "Sheet3", "cleared": true }
  ]
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `results` | object[] | 各シートの `sheet`（シート名）と `cleared`（常に `true`）の配列 |
