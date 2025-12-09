# 3D Model Generation TODO

画像から3Dモデルを生成する進捗管理

**フォーマット: GLB (頂点カラー付きメッシュ)**

## bacon (ベーコン) ✅
- [x] Object_1
- [x] Object_2
- [x] Object_3
- [x] Object_4
- [x] Object_5
- [x] Object_6
- [x] Object_7
- [x] Object_8
- [x] Object_9
- [x] Object_10
- [x] Object_11
- [x] Object_12

## beef (牛肉) ✅
- [x] Object_1
- [x] Object_2
- [x] Object_3
- [x] Object_4
- [x] Object_5
- [x] Object_6
- [x] Object_7
- [x] Object_8
- [x] Object_9

## chicken (鶏肉) ✅
- [x] Object_1
- [x] Object_2
- [x] Object_3
- [x] Object_4
- [x] Object_5
- [x] Object_6
- [x] Object_7
- [x] Object_8
- [x] Object_9
- [x] Object_10
- [x] Object_11
- [x] Object_12
- [x] Object_13
- [x] Object_14
- [x] Object_15
- [x] Object_16
- [x] Object_17
- [x] Object_18
- [x] Object_19
- [x] Object_20

## egg (卵) ✅
- [x] Object_1
- [x] Object_2
- [x] Object_3
- [x] Object_4
- [x] Object_5
- [x] Object_6

## fish (魚) ✅
- [x] Object_1
- [x] Object_2
- [x] Object_3
- [x] Object_4
- [x] Object_5
- [x] Object_6
- [x] Object_7
- [x] Object_8
- [x] Object_9
- [x] Object_10
- [x] Object_11
- [x] Object_12
- [x] Object_13
- [x] Object_14

## kai (貝) ✅
- [x] Object_1
- [x] Object_2
- [x] Object_3
- [x] Object_4
- [x] Object_5
- [x] Object_6
- [x] Object_7
- [x] Object_8
- [x] Object_9

## mushroom (キノコ) ✅
- [x] Object_1
- [x] Object_2
- [x] Object_3
- [x] Object_4
- [x] Object_5
- [x] Object_6

## nerimono (練り物) ✅
- [x] Object_1
- [x] Object_2
- [x] Object_3
- [x] Object_4
- [x] Object_5
- [x] Object_6
- [x] Object_7
- [x] Object_8

## others (その他) ✅
- [x] Object_1
- [x] Object_2
- [x] Object_3

## pork (豚肉) ✅
- [x] Object_1
- [x] Object_2

## stick (串) ✅
- [x] Object_1
- [x] Object_2
- [x] Object_3
- [x] Object_4
- [x] Object_5
- [x] Object_6
- [x] Object_7
- [x] Object_9
- [x] Object_10

## sweet (スイーツ) ✅
- [x] Object_1
- [x] Object_2
- [x] Object_3
- [x] Object_4
- [x] Object_5
- [x] Object_6
- [x] Object_7
- [x] Object_8
- [x] Object_9
- [x] Object_10
- [x] Object_11
- [x] Object_12

## vegetable (野菜) ✅
- [x] Object_1
- [x] Object_2
- [x] Object_3
- [x] Object_4
- [x] Object_5
- [x] Object_6
- [x] Object_7
- [x] Object_8
- [x] Object_9
- [x] Object_10
- [x] Object_11
- [x] Object_12
- [x] Object_13
- [x] Object_14
- [x] Object_15
- [x] Object_16
- [x] Object_17
- [x] Object_18
- [x] Object_19

---

## 統計

| カテゴリ | オブジェクト数 | 状態 |
|---------|--------------|------|
| bacon | 12 | ✅ 完了 |
| beef | 9 | ✅ 完了 |
| chicken | 20 | ✅ 完了 |
| egg | 6 | ✅ 完了 |
| fish | 14 | ✅ 完了 |
| kai | 9 | ✅ 完了 |
| mushroom | 6 | ✅ 完了 |
| nerimono | 8 | ✅ 完了 |
| others | 3 | ✅ 完了 |
| pork | 2 | ✅ 完了 |
| stick | 9 | ✅ 完了 |
| sweet | 12 | ✅ 完了 |
| vegetable | 19 | ✅ 完了 |
| **合計** | **129** | **✅ 全完了** |

---

## 使い方
- `[x]` でチェックを付けると生成完了
- チェックを外すとやり直し対象
- 再生成コマンド例：
  ```powershell
  python backend/batch_generate.py --input images/bacon --output models/bacon --format glb
  ```
