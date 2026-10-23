"""Write the performance-patched three.js bundle into mods/ (the site file stays untouched).

three.js draws every transparent, double-sided material in two passes (back faces,
then front faces) and flags material.needsUpdate before each pass, which makes the
renderer rebuild that material's shader parameters twice per object per frame. Maps
have hundreds of such surfaces (glass, decals, puddles, debris), so a map like Haven
spent most of each frame there (~240 rebuilds per frame, ~100 FPS on an RTX 5060).
The patch draws them in one pass (both sides at once), like forceSinglePass does.

Every frame three.js also rebuilds each object's matrix from position/rotation/scale
and then every world matrix below it, even for the thousands of map pieces that never
move. The second patch skips that when the values are unchanged since the last
rebuild (objects with a pivot always rebuild); moving objects, bones and cameras
still update every frame.

    python -I tools/perf_patch.py
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(HERE, "..", "site")
MODS = os.path.join(HERE, "..", "app", "mods")
# The same bundle is served under both paths (lobby and studio).
BUNDLES = [os.path.join("next", "js", "BiMsX6Xn.js"), os.path.join("_assets", "r20261021-1", "next", "js", "BiMsX6Xn.js")]
PATCHES = [
    (b"K.transparent===!0&&K.side===Fn&&K.forceSinglePass===!1?",
     b"K.transparent===!0&&K.side===Fn&&K.forceSinglePass===!1&&!1?"),
    (b"updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);const e=this.pivot;",
     b"updateMatrix(){const aP=this.position,aQ=this.quaternion,aS=this.scale,"
     b"aC=this.__aimM||(this.__aimM=new Float64Array(10).fill(NaN));"
     b"if(this.pivot===null&&aC[0]===aP.x&&aC[1]===aP.y&&aC[2]===aP.z&&aC[3]===aQ._x&&aC[4]===aQ._y"
     b"&&aC[5]===aQ._z&&aC[6]===aQ._w&&aC[7]===aS.x&&aC[8]===aS.y&&aC[9]===aS.z)return;"
     b"aC[0]=aP.x,aC[1]=aP.y,aC[2]=aP.z,aC[3]=aQ._x,aC[4]=aQ._y,aC[5]=aQ._z,aC[6]=aQ._w,aC[7]=aS.x,aC[8]=aS.y,aC[9]=aS.z;"
     b"this.matrix.compose(this.position,this.quaternion,this.scale);const e=this.pivot;"),
]

for rel in BUNDLES:
    data = open(os.path.join(SITE, rel), "rb").read()
    for old, new in PATCHES:
        if data.count(old) != 1:
            raise SystemExit(f"{rel}: expected exactly one match for {old[:40]!r}")
        data = data.replace(old, new)
    out = os.path.join(MODS, rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "wb") as f:
        f.write(data)
    print("patched", out)
