"""Build training-set.json: 25 extra scenarios shown in the lobby next to the official ones.

  * Fundamentals (empty arena): micro-adjustment, Pasu-style "Drift" dynamic clicking, tracking.
  * Anti-flash (real maps): enemies flash, then swing; built on the saved anti-flash scenes
    (their routes and flash points), with smokes and player abilities removed.
  * Peek duels (real maps): bots jiggle-peek and shoot back from saved route angles,
    a random set of spots each round.

main.js adds the entries to the official training list it serves and serves their scene
files, so they play like official scenarios (results and training history).

    python -I tools/make_training_set.py
"""
import hashlib
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SCENES = os.path.join(HERE, "..", "site", "prod-api", "api", "v1", "public", "val", "aimlab", "scenes")
OUT = os.path.join(HERE, "..", "app", "training-set.json")
STAMP = "2026-10-21 12:00:00"
PLAYER_Z = 10
EYE = 1.6


def load(scene_id):
    with open(os.path.join(SCENES, scene_id), encoding="utf-8") as f:
        doc = json.load(f)["data"]["doc"]
    return json.loads(doc) if isinstance(doc, str) else doc


def code(name):
    return hashlib.sha1(("aimlocal-set:" + name).encode()).hexdigest()[:16]


ARENA_ENV = {"skyColor": "#111820", "fogNear": 14, "fogFar": 33, "ambientIntensity": 1.55, "keyLightIntensity": 2.2, "lightingVersion": 2, "fogEnabled": False}
FLOOR = {"id": "ground", "shape": "plane", "position": {"x": 0, "y": 0, "z": 0}, "rotationY": 0, "size": {"x": 100, "y": 0.4, "z": 100}, "color": "#cfd2d4", "collidable": True}


def wall(z, width=18, height=8):
    """Dark backdrop behind wall drills so targets stand out (and bullets stop)."""
    return {"id": "backdrop", "shape": "box", "position": {"x": 0, "y": height / 2, "z": z - 1.5}, "rotationY": 0,
            "size": {"x": width, "y": height, "z": 0.4}, "color": "#26303b", "collidable": True}


def ball(radius, color="#ff4655", behaviors=()):
    return {"id": "actor-1", "name": "Ball", "body": {"shape": "sphere", "headSize": 1, "bodyWidth": 0, "bodyHeight": 0, "radius": radius},
            "color": color, "behaviors": list(behaviors), "hitSlow": True}


def bot(behaviors=(), weapon=None, head=1.0, look="bot"):
    body = {"shape": "humanoid", "headSize": head, "bodyWidth": 0.44, "bodyHeight": 0, "look": look}
    if weapon:
        body["weapon"] = weapon
    return {"id": "actor-1", "name": "Bot", "body": body, "color": "#ff4655", "behaviors": list(behaviors), "hitSlow": True}


def sway(ax, ay, hz):
    return {"kind": "sway", "amplitude": {"x": ax, "y": ay}, "frequency": hz, "unit": "hz"}


def shooter(difficulty="easy", reaction=(0.45, 0.6), aim_error=4):
    return {"kind": "shooter", "difficulty": difficulty, "reaction": list(reaction), "cadence": "weapon", "aimErrorDeg": aim_error,
            "maxRangeM": 60, "engage": "stop", "resumeDelay": [0.4, 0.8]}


def area(distance, w, h, at_once, delay=(0.0, 0.15), y=2.2):
    return {"id": "spawner-1", "name": "Area", "kind": "area", "actorTemplateId": "actor-1", "position": {"x": 0, "y": y, "z": PLAYER_Z - distance},
            "size": {"x": w, "y": h, "z": 0.5}, "maxAlive": at_once, "spawnDelay": list(delay)}


def wall_cells(distance, at_once, w=9, h=3.2, cols=6, rows=3, y=2.9):
    """Random free cell of an invisible grid covering the wall. Spreads new targets over the
    whole wall (a random area keeps them near its centre)."""
    return {"id": "grid", "name": "Wall", "kind": "grid", "actorTemplateId": "actor-1", "position": {"x": 0, "y": y, "z": PLAYER_Z - distance},
            "size": {"x": w, "y": h, "z": 0}, "columns": cols, "rows": rows, "maxAlive": at_once, "spawnDelay": [0.0, 0.1]}


def arena(name, actors, spawners, rules, blocks=()):
    return {"schemaVersion": 2, "meta": {"id": "set-" + code(name), "name": name, "seed": int(code(name)[:7], 16), "createdAt": 0},
            "environment": dict(ARENA_ENV), "blocks": [dict(FLOOR), *blocks], "playerSpawn": {"position": {"x": 0, "y": 0, "z": PLAYER_Z}, "yaw": 0},
            "spawners": spawners, "actors": actors, "rules": rules}


CLICK = {"duration": 60, "scoring": "clicking", "weapon": "vandal", "playerMovable": False, "fireMode": "single", "perfectAccuracy": True, "buyMenu": False}
TRACK = {"duration": 60, "scoring": "tracking", "weapon": "vandal", "playerMovable": False, "fireMode": "hold", "perfectAccuracy": True,
         "targetsInvincible": True, "buyMenu": False}

entries = []  # (listing item fields, doc)


def add(name, kind, map_id, desc, doc):
    entries.append(({"name": name, "type": kind, "mapId": map_id, "description": desc}, doc))


# ---------- Fundamentals: micro-adjustment ----------
add("Micro tiles", "basic", None,
    "Tiny balls on a tight 5×5 grid, 3 up at once. Every next target is only a small correction away: train precise micro-adjustments, not big flicks.",
    arena("Micro tiles", [ball(0.1)],
          [{"id": "grid", "name": "Grid", "kind": "grid", "actorTemplateId": "actor-1", "position": {"x": 0, "y": EYE, "z": PLAYER_Z - 10},
            "size": {"x": 2.25, "y": 2.25, "z": 0}, "columns": 5, "rows": 5, "maxAlive": 3, "spawnDelay": [0, 0]}],
          CLICK, [wall(PLAYER_Z - 10, 8, 5)]))
add("Micro flicks", "basic", None,
    "Two small balls at a time inside a narrow box straight ahead. Short, exact flicks: land the first shot instead of correcting after it.",
    arena("Micro flicks", [ball(0.12)], [area(12, 2.4, 1.4, 2, (0.0, 0.1), y=EYE)], CLICK, [wall(PLAYER_Z - 12, 8, 5)]))
add("Micro track", "basic", None,
    "One tiny ball drifting slowly and unpredictably. Keep the crosshair glued to it with small, smooth mouse corrections.",
    arena("Micro track", [ball(0.14, "#2fe0c8", [sway(0.45, 0.3, 0.3)])], [area(10, 0.5, 0.4, 1, (0.0, 0.0), y=EYE)],
          TRACK, [wall(PLAYER_Z - 10, 8, 5)]))
add("Head-level micro", "basic", None,
    "A tight row of bots with small heads; new ones keep popping up next to each other. Stay at head height and make only tiny corrections between heads.",
    arena("Head-level micro",
          [bot([], head=0.8)],
          [{"id": f"spawner-{i + 1}", "name": f"Spot {i + 1}", "kind": "fixed", "actorTemplateId": "actor-1", "faceTarget": True, "groundSnap": True,
            "position": {"x": round(-2.7 + 0.9 * i, 2), "y": 0, "z": PLAYER_Z - 15}, "size": {"x": 0, "y": 0, "z": 0}, "maxAlive": 1, "spawnDelay": [0.5, 2.0]}
           for i in range(7)],
          {**CLICK, "fireMode": "single"}))
add("Micro shrink", "basic", None,
    "Small targets appear close together and shrink away within about a second. Fast, precise micro-flicks under time pressure; misses count against you.",
    arena("Micro shrink", [ball(0.2, "#ffd54a", [{"kind": "decay", "lifetime": 1.2, "growTime": 0.08, "minScale": 0.4}])],
          [area(11, 3.0, 1.8, 2, (0.05, 0.2), y=EYE)], CLICK, [wall(PLAYER_Z - 11, 8, 5)]))

# ---------- Fundamentals: Pasu-style "Drift" dynamic clicking ----------
DRIFT = [
    ("Drift Click", 0.32, (1.2, 0.7, 0.35), 4, "Four balls drift around a wall at a steady pace. Click them one by one: track briefly, then click. The standard dynamic-clicking drill."),
    ("Drift Small", 0.22, (1.2, 0.7, 0.35), 4, "Drift Click with smaller balls. Same movement, less room for error."),
    ("Drift Micro", 0.13, (0.7, 0.45, 0.25), 3, "Tiny, slowly drifting balls. Very small, very controlled corrections."),
    ("Drift Fast", 0.3, (1.8, 1.0, 0.6), 4, "Faster and wider drift. Read the direction and lead your clicks."),
]
for name, radius, (ax, ay, hz), count, desc in DRIFT:
    add(name, "basic", None, desc,
        arena(name, [ball(radius, "#ff4655", [sway(ax, ay, hz)])], [wall_cells(12, count)], CLICK, [wall(PLAYER_Z - 12)]))
add("Drift Track", "basic", None,
    "The drift wall as a tracking drill: hold fire and keep the crosshair on the balls. Scored on time on target; targets can't die.",
    arena("Drift Track", [ball(0.32, "#2fe0c8", [sway(1.4, 0.8, 0.4)])], [wall_cells(12, 2)], TRACK, [wall(PLAYER_Z - 12)]))
add("Drift Reload", "basic", None,
    "Drift Click with a Sheriff and real magazines and reloads. Every miss costs time, so hit first.",
    arena("Drift Reload", [ball(0.3, "#ff4655", [sway(1.2, 0.7, 0.35)])], [wall_cells(12, 4)],
          {**CLICK, "weapon": "sheriff", "limitedAmmo": True}, [wall(PLAYER_Z - 12)]))

# ---------- Fundamentals: tracking ----------
add("Stop-and-go strafer", "basic", None,
    "A bot strafing like a real player: short runs, sharp counter-strafe stops, direction changes. Stay on it through the stops. Time on target.",
    arena("Stop-and-go strafer",
          [bot([{"kind": "strafe", "speed": [5.4, 5.4], "dwell": [0.08, 0.45], "travel": [0.8, 3.5], "counterStrafe": True}])],
          [area(14, 3, 0, 1, (0.2, 0.4), y=0) | {"faceTarget": True, "groundSnap": True}], TRACK))
add("Jumping strafer", "basic", None,
    "A strafing bot that also jumps every second or two. Follow both the side-to-side and the up-and-down. Time on target.",
    arena("Jumping strafer",
          [bot([{"kind": "strafe", "speed": [5.4, 5.4], "dwell": [0.1, 0.5], "travel": [1.0, 3.0], "counterStrafe": True},
                {"kind": "jump", "interval": [1.0, 2.2], "height": 0.8}])],
          [area(14, 3, 0, 1, (0.2, 0.4), y=0) | {"faceTarget": True, "groundSnap": True}], TRACK))


# ---------- Anti-flash (real maps) ----------
def anti_flash(src_id, name, desc, add_shooters=False, duration=60):
    doc = load(src_id)
    doc["meta"] = {"id": "set-" + code(name), "name": name, "seed": int(code(name)[:7], 16), "createdAt": 0}
    doc.pop("props", None)  # enemy flashes only: no smokes or lockdowns
    rules = doc["rules"]
    rules.pop("jett", None)  # no player abilities
    rules["duration"] = duration
    rules["playerMovable"] = True
    rules["playerDeath"] = "endRound"
    rules["healOnKill"] = True
    if add_shooters:
        for actor in doc["actors"]:
            if actor["body"].get("shape") == "humanoid" and not any(b["kind"] == "shooter" for b in actor["behaviors"]):
                actor["body"].setdefault("weapon", "vandal")
                actor["behaviors"].append(shooter())
    add(name, "flash", doc["environment"]["map"], desc, doc)


anti_flash("fffe4c7a55060737", "Ascent B Main: flash and swing",
           "Hold B Main. Enemies throw a flash before they swing: turn away from the flash, then turn back and win the duel.", add_shooters=True)
anti_flash("d5a8557a5d9537e3", "Ascent dock: flashes from every side",
           "KAY/O, Reyna and Phoenix flashes into the dock while bots cross. Bots shoot back: dodge the flash, then hit first.", add_shooters=True)
anti_flash("fa9a78d3f67b0a2d", "Ascent: hold against five (flashes)",
           "Five enemies push your position, the flashers go first. Survive the round.", duration=30)
anti_flash("953d044436a0cc37", "Haven A Long: hold vs flashes",
           "Hold A Long while Phoenix and Reyna flash for the swing. Bots shoot back.")
anti_flash("95db7dec27f4fb1c", "Haven A site: retake vs flashes",
           "Retake A site; enemies flash before they swing. Bots shoot back.", add_shooters=True)
anti_flash("cb2431243b5643fd", "Split A Main: hold vs flashes",
           "Hold A Main against Reyna and Phoenix flash-peeks. Bots shoot back.", add_shooters=True)


# ---------- Peek duels (real maps) ----------
def peek_duel(src_id, name, desc, pick):
    doc = load(src_id)
    doc["meta"] = {"id": "set-" + code(name), "name": name, "seed": int(code(name)[:7], 16), "createdAt": 0}
    doc.pop("props", None)
    doc.pop("dispatchers", None)
    doc["actors"] = [bot([{"kind": "strafe", "speed": [5.4, 5.4], "dwell": [0.3, 1.0], "travel": [0.6, 1.6], "counterStrafe": True},
                          shooter("hard", (0.35, 0.5), 3)], weapon="vandal")]
    doc["spawners"] = [{**s, "actorTemplateId": "actor-1", "maxAlive": 1, "faceTarget": True, "groundSnap": True, "spawnDelay": [0.3, 1.2]}
                       for s in doc["spawners"]]
    ids = [s["id"] for s in doc["spawners"]]
    doc["rules"] = {"duration": 90, "scoring": "clicking", "weapon": "vandal", "playerMovable": True, "fireMode": "hold",
                    "playerDeath": "endRound", "healOnKill": True, "spawnerPick": {"pool": ids, "count": min(pick, len(ids) - 1)}}
    add(name, "hold", doc["environment"]["map"], desc, doc)


PEEK_DESC = "Bots jiggle-peek from real angles on this route and shoot back hard. A different set of spots every round; dying ends the round."
peek_duel("19c5ea522465b282", "Ascent B retake: peekers", PEEK_DESC, 10)
peek_duel("1260bffea8d85b5d", "Split B Heaven retake: peekers", PEEK_DESC, 10)
peek_duel("0d98806d4c5493c2", "Haven Garage push: peekers", PEEK_DESC, 12)
peek_duel("35e58d677b59c90e", "Lotus B attack: peekers", PEEK_DESC, 9)
peek_duel("0663496eae588ad2", "Bind A Showers: peekers", PEEK_DESC, 10)
peek_duel("4813a4333b9e69c9", "Corrode Mid to A: peekers", PEEK_DESC, 12)

# ---------- write ----------
items, scenes = [], {}
for i, (fields, doc) in enumerate(entries):
    share = code(fields["name"])
    text = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
    items.append({"createTime": STAMP, "description": fields["description"], "docBytes": len(text.encode()), "featured": False,
                  "mapId": fields["mapId"], "name": fields["name"], "parSeconds": None, "playCount": 0,
                  "sceneKey": "set-" + share, "shareCode": share, "sort": 100 + i, "status": 1, "type": fields["type"], "updateTime": STAMP})
    scenes[share] = {"authorNickname": "open-aim", "authorUid": "local", "blockCount": len(doc["blocks"]), "createTime": STAMP,
                     "description": fields["description"], "docBytes": len(text.encode()), "name": fields["name"], "playCount": 0,
                     "sceneHash": share, "sceneKey": "set-" + share, "schemaVersion": 2, "shareCode": share, "updateTime": STAMP, "doc": text}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump({"items": items, "scenes": scenes}, f, ensure_ascii=False, indent=1)
print(f"{len(items)} scenarios ->", OUT)
for it in items:
    print(f"  {it['type']:6} {str(it['mapId']):8} {it['shareCode']}  {it['name']}")
