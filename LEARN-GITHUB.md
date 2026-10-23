# Learn GitHub with open-aim

A hands-on guide to git and GitHub, using this project as the example. Every step works on
your own PC first. Nothing goes online until you choose to push, and you can keep the
repository **private** so only you can see it.

## 1. The words you'll see

| Word | What it means here |
| --- | --- |
| **Repository (repo)** | This `open-aim` folder plus its full history |
| **Commit** | A saved snapshot of the files, with a message like `feat: add Drift fast` |
| **Branch** | A separate line of work. `main` is the official one; you try ideas on other branches |
| **Push / pull** | Send your commits to GitHub / bring commits from GitHub to your PC |
| **Issue** | A bug report or idea, with a comment thread (see `.github/ISSUE_TEMPLATE/`) |
| **Pull request (PR)** | "Please merge my branch into `main`", with review comments and checks |
| **Fork** | Someone's own copy of your repo on GitHub, where they make changes to send back as a PR |
| **`.gitignore`** | The list of files git never tracks. Here: game files, logs, `node_modules` |
| **Actions (CI)** | Checks GitHub runs on every PR. Here: `.github/workflows/check.yml` |

## 2. Install git

Open PowerShell and run:

```bash
winget install --id Git.Git -e
```

Close and reopen PowerShell, then tell git who you are (this name appears on your commits):

```bash
git config --global user.name "unkwsr"
```

```bash
git config --global user.email "you@example.com"
```

## 3. Your first commit (all local)

```bash
cd C:\Users\hate\Desktop\Hello\open-aim
```

```bash
git init -b main
```

```bash
git status
```

`git status` lists the files git sees. Notice that `site/` and `app/training-set.json` are
**not** listed: that's `.gitignore` working.

```bash
git add .
```

```bash
git commit -m "Initial commit: open-aim 1.0.0"
```

```bash
git log --oneline
```

You now have a repository with one commit. It exists only on your PC.

## 4. Try a change on a branch

```bash
git switch -c add-my-drill
```

Edit something, for example the description in `scenarios/micro-tiles.json`, then:

```bash
git diff
```

```bash
node scripts/build-scenarios.mjs --check
```

```bash
git commit -am "feat(scenarios): clearer Micro tiles description"
```

```bash
git switch main
```

```bash
git merge add-my-drill
```

That's the whole cycle contributors follow: branch, change, check, commit, merge.
On GitHub, the merge happens through a pull request instead.

## 5. Put it on GitHub (private)

1. Create a free account at github.com.
2. Click **New repository**, name it `open-aim`, choose **Private**, and don't add a README
   (you already have one).
3. GitHub shows the commands to connect it. They look like this:

```bash
git remote add origin https://github.com/YOUR-NAME/open-aim.git
```

```bash
git push -u origin main
```

Open the repo page. You'll see the files, the README rendered on the front page, and the
**Issues**, **Pull requests** and **Actions** tabs, just like a real open-source project. Only you
can see it while it's private.

## 6. Things to try on GitHub

- **Open an issue** with the Bug report or Scenario idea template, and see the form it makes.
- **Add labels** such as `good first issue`, `scenario`, `map`, `bug`.
- **Push a branch and open a pull request**, then watch the **Check** workflow run.
  Break a scenario file on purpose (delete a comma) and see the check fail.
- **Edit a file in the browser** with the pencil icon, and commit it to a new branch.
- **Make a release:** follow [docs/releasing.md](docs/releasing.md).
- **Turn on the website:** Settings → Pages → Branch `main`, folder `/docs`. GitHub serves
  `docs/index.html` as the project's one-page site. (Pages on a private repo needs a paid
  plan; on a public repo it's free.)
- **Turn on Discussions:** Settings → Features → Discussions. Then create the categories
  **Show your drill** and **Ideas**. The forms in `.github/DISCUSSION_TEMPLATE/` attach to them
  by name.

## 7. Golden rules

- Commit small and often, with clear messages.
- Never commit game files, backups, passwords or tokens. If git lists something you don't
  expect, add it to `.gitignore` before `git add`.
- `git status` before every commit. It's free and catches mistakes.
- A private repo can be made public later in **Settings**, but anything ever pushed stays in
  the history. Keep game files out from the very first commit.
