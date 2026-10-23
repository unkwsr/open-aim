# Scenario format

Each file in `scenarios/` is one drill:

```json
{
  "item":  { … how it appears in the lobby list … },
  "scene": { … what the game loads when you press play … }
}
```

## `item`

| Field | Example | Meaning |
| --- | --- | --- |
| `name` | `"Micro tiles"` | Title in the lobby. Must be unique. |
| `description` | `"Tiny balls on a tight 5×5 grid…"` | One or two sentences: what it trains. |
| `type` | `"basic"` | `basic` (arena drills), `flash` (anti-flash) or `hold` (angle holding, peek duels) |
| `mapId` | `"ascent"` or `null` | Map the drill runs on. `null` means the empty arena. |
| `shareCode` | `"d43f842fb33e4d46"` | Unique ID, 16 lowercase hex characters (see below) |
| `sceneKey` | `"set-d43f842fb33e4d46"` | Always `set-` + `shareCode` |
| `sort` | `100` | Position in the lobby list (lower comes first) |
| `featured`, `status`, `playCount`, `parSeconds`, `docBytes`, `createTime`, `updateTime` | | Copy them from an existing scenario |

## `scene`

The same fields as `item` (name, description, shareCode, sceneKey…), plus:

| Field | Meaning |
| --- | --- |
| `doc` | The scenario itself, as a JSON string: environment, blocks (walls, floor), player spawn, enemies, rules |
| `schemaVersion` | Version of the `doc` format. Currently `2`. |
| `blockCount` | Number of blocks in `doc` |
| `authorNickname`, `authorUid` | Who made it. Use your GitHub name. |

The easiest way to get a valid `doc` is to copy a similar scenario and change it.

## Making a shareCode

The `shareCode` must be unique. Generate one from the scenario's name:

```bash
node -e "console.log(require('crypto').createHash('sha1').update('aimlocal-set:' + process.argv[1]).digest('hex').slice(0, 16))" "My new drill"
```

## Checking

```bash
node scripts/build-scenarios.mjs --check
```

This checks every file: valid JSON, required fields, matching codes, no duplicate names.
The same check runs automatically on every pull request.
