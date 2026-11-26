# GitHub Pages deployment / 网页部署

The Pages landing page links to the current big-screen flight demo first and keeps the original Solo / Duo HTML available. It does not publish the archived demos, tests, or project notes. If the flight demo adds a local runtime asset, add it to `scripts/build-pages.sh`.

1. A repo admin selects **Settings → Pages → Build and deployment → Source → GitHub Actions**. No secrets are needed. See [GitHub’s Pages setup guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
2. Merge the deployment PR into `main`. If Pages was enabled after the merge or the first run failed, run **Actions → Deploy game to GitHub Pages → Run workflow** on `main`.
3. Open the URL from the successful deploy job. The expected project URL is https://sd5913.github.io/GIVE-ME-YOUR-FRIES/. Play once with the keyboard, then allow the webcam in a top-level browser tab to test full-body tracking. The model loads from external hosts, so tracking needs an internet connection. The original Solo / Duo game remains a separate link.

Pull requests run tests and upload a downloadable `game-pages-preview` artifact without publishing. For a local preview, from the repository root:

```sh
bash scripts/build-pages.sh /tmp/fries-preview
python3 -m http.server 8000 --directory /tmp/fries-preview
```

Open http://localhost:8000/. Use a new output directory for each build or remove the old preview yourself before rebuilding.

仓库管理员把 **Settings → Pages → Source** 设为 **GitHub Actions**。合并后可在 **Actions** 中打开成功部署的链接。首页优先展示第一人称全身体感试玩，也保留原版单人／双人游戏。摄像头需要授权和网络；如果暂时无法使用摄像头，可以先用键盘试玩。
