# さくらサーバーへの手動デプロイ

このリポジトリは、GitHub ActionsでAstroをビルドし、生成した `dist/` の内容だけをさくらサーバーへ上書き配置できます。

> **重要**: このワークフローは自動デプロイしません。GitHub Actions画面で手動実行し、`deploy` を `true` にしたときだけ実行されます。

## 事前条件

- WordPress本体は `/home/yh-inc/www/wp_jiji/` に残します。
- `wp_jiji/.htaccess` には、静的 `index.html` を優先するため次の設定を追加します。

  ```apache
  <IfModule mod_dir.c>
    DirectoryIndex index.html index.php
  </IfModule>
  ```

- FTPデプロイの対象は `dist/` だけです。WordPressの `wp-admin`、`wp-content`、`wp-includes`、既存のPHPファイルは対象外です。
- 初回にサーバー上のファイルを一括削除する設定（`dangerous-clean-slate`）は無効にしています。

## GitHub Secret

リポジトリの **Settings → Secrets and variables → Actions → New repository secret** で、次を登録します。

| Secret | 値 |
| --- | --- |
| `SAKURA_HOST` | `yh-inc.sakura.ne.jp` |\n| `SAKURA_USERNAME` | `yh-inc` |\n| `SAKURA_PASSWORD` | さくらサーバーのFTPパスワード |\n| `SAKURA_ASTRO_DEPLOY_PATH` | `/home/yh-inc/www/wp_jiji/` |

FTPホスト、ユーザー名、配置先はワークフロー内に固定しています。

| 項目 | 値 |
| --- | --- |
| FTPサーバー | `ftp://yh-inc.sakura.ne.jp` |
| ユーザー名 | `yh-inc` |
| 配置先 | `/home/yh-inc/www/wp_jiji/` |

パスワードはGitHubのリポジトリやActionsログに書かれません。

> FTPは通信を暗号化しない方式です。現在のさくらサーバー接続に合わせて使用しますが、将来はFTPSまたはSSH鍵方式へ移行することを推奨します。

## 実行手順

1. GitHubの **Actions** を開く。
2. **Deploy Astro site to Sakura** を選ぶ。
3. **Run workflow** を押し、`deploy` をオンにして実行する。
4. 実行成功後、`https://style.yh-inc.jp/`、記事ページ、`/wp-json/wp/v2/posts`、`/wp-admin/` を確認する。

## ロールバック

WordPressのPHPやデータベースは上書きしません。Astroの公開を戻す場合は、公開フォルダに配置したAstroの `index.html`、`_astro/`、記事・カテゴリーディレクトリを退避または削除し、`DirectoryIndex index.php` に戻します。
