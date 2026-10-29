# Offline drill Favorites — 2026-10-28

The native Favorites store required an online account/token, then called a
favorites API that the test copy's static server does not implement (writes are
rejected). Heart clicks could open sign-in or roll back instead of persisting.

The native store now saves favorite codes to localStorage under
aim-offline-favorites-v1 in this test profile. Native reactive heart states and
the existing Favorites tab consume the same computed lists. Adding/removing
works without an account, and initialization/reloading reads stored choices.
Each toggle merges the latest stored list and deduplicates namespaced codes.
No login, account settings, backend endpoint or online message is introduced.

Both BLcEqh__.js routes are overridden under app/mods. Reproduce the narrow
store patch with node tools/skin-converter/extend-local-favorites.cjs. Source
captures remain intact. Existing engine/audio/video builders do not rewrite
this module. Player data remains under the test copy's test-data directory.

test-sunset-favorites.cjs uses an isolated Electron profile and the actual native
WorkshopView heart and FavoritesView. Add, un-favorite, re-favorite, removing one
of two entries, no-account behavior and persistence after page reload pass.
The fixture also checks Sunset artwork routing. Result:
tools/skin-converter/sunset-favorites-results.json. Real player favorites were
not edited by the fixture. Cross-device/account synchronization is not provided.
