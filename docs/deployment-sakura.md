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

- アップロードは削除同期を使いません。WordPressの `wp-admin`、`wp-content`、`wp-includes`、既存のPHPファイルは削除されません。

## GitHub Secrets

リポジトリの **Settings → Secrets and variables → Actions → New repository secret** で、次の値を登録します。

| Secret | 値 |
| --- | --- |
| `SAKURA_SSH_HOST` | さくらサーバーのホスト名（例: `yh-inc.sakura.ne.jp`） |
| `SAKURA_SSH_PORT` | `22` |
| `SAKURA_SSH_USERNAME` | さくらサーバーのSSH/SFTPユーザー名 |
| `SAKURA_SSH_PASSWORD` | SSH/SFTPパスワード |
| `SAKURA_ASTRO_DEPLOY_PATH` | `/home/yh-inc/www/wp_jiji` |
| `SAKURA_SSH_FINGERPRINT` | 任意。SSHホスト鍵のSHA256フィンガープリント |

パスワードはこのリポジトリやActionsログに書かれません。

## 実行手順

1. GitHubの **Actions** を開く。
2. **Deploy Astro site to Sakura** を選ぶ。
3. **Run workflow** を押し、`deploy` をオンにして実行する。
4. 実行成功後、`https://style.yh-inc.jp/`、記事ページ、`/wp-json/wp/v2/posts`、`/wp-admin/` を確認する。

## ロールバック

WordPressのPHPやデータベースは上書きしません。Astroの公開を戻す場合は、公開フォルダに配置したAstroの `index.html`、`_astro/`、記事・カテゴリーディレクトリを退避または削除し、`DirectoryIndex index.php` に戻します。
