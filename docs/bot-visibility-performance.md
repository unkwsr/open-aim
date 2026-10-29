# Bot wall visibility: old cache removed, new conservative proof

The old timer-based wall-visibility cache was removed at the user's request after observed pop-in when peeking. It remains removed. Custom map culling also remains removed.

Historical controlled measurements remain in tools/skin-converter/bot-render-baseline.json and bot-visibility-test-results.json; they describe the removed experiment, not the current build.

At the user's later explicit request for smarter entity culling, a separate
conservative replacement was implemented. See bot-triangle-visibility.md. A
previous occluder candidate may be reused, but its geometric proof must succeed
again against the current camera and bot bounds on every frame. There is no
stale hidden verdict. Unknown/uncertain always renders. Simulation, hitboxes,
native frustum bounds, animations and map rendering remain unchanged.
