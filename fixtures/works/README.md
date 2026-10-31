# 製作実績PoCの素材

このディレクトリのSVGは、このPoCのために基本図形で新規作成したオリジナルの模式図です。第三者の写真・図面・ロゴ・実在顧客の資料を使用していません。PNGは同名のSVGを、このプロジェクトに導入済みの`sharp`で変換したものです。

実物写真、加工精度の証拠、製造に使用できる図面ではありません。掲載時は「架空製作例・模式図」と表示してください。文章もすべて架空です。

再生成する場合：

```sh
bun -e 'import sharp from "sharp"; for (const name of ["positioning-jig", "conveyor-part", "inspection-bracket"]) await sharp(`fixtures/works/${name}.svg`).png().toFile(`fixtures/works/${name}.png`);'
```

`content.json`の`$asset`は、このリポジトリのデモ登録スクリプト専用のローカル参照です。EmDashのseed構文ではありません。`bun scripts/phase2-works.ts demo`が標準メディアAPIで画像を登録し、画像オブジェクトに置換して標準コンテンツAPIへ渡します。

seedには環境ごとに異なるメディアIDやローカルファイル参照を埋め込みません。新規DBではseedでモデルを構築後、デモ登録を実行してください。
