# Example scenarios

Drills to copy, learn from and share. Files here aren't in the app's lobby. Only
`scenarios/` is.

| File | What it is |
| --- | --- |
| `starter-drill.json` | The smallest useful drill: small targets on a grid in an empty arena. Start here. |

## Make it yours

1. Copy `starter-drill.json` into `scenarios/` and give it a new file name, like `scenarios/wide-flicks.json`.
2. Change `name` and `description` in both `item` and `scene`.
3. Make a new `shareCode` from the name (see [docs/scenario-format.md](../docs/scenario-format.md#making-a-sharecode))
   and update `shareCode`, `sceneKey` and `sceneHash`.
4. Set `authorNickname` to your GitHub name.
5. Check it:

```bash
node scripts/build-scenarios.mjs --check
```

## Sharing a drill without a pull request

Post the file in the **Show your drill** category of Discussions. Others can drop it into
their own `scenarios/` folder and play it. Popular drills get added to the app.
