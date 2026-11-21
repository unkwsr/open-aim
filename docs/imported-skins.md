# Imported skins

Most skins in the Collection were put in by hand, one at a time, with their materials, sounds and effects. An **imported skin** is one taken from the game files in bulk: its model, its colour atlas and its animations, and nothing set by hand. That is how a whole catalogue (615 skins over 18 weapons) can be offered at once.

This repository carries five per weapon (90 skins, about 360 MB), picked from what the community asked for and the best-known lines, and the Frenzy's own first-person model, which was missing. A line the repository already has by hand for a weapon is not repeated.

| Weapon | Skins |
| --- | --- |
| Ghost | Reaver Ghost, Phaseguard Ghost, Sovereign Ghost, Kuronami Ghost, Ruination Ghost |
| Sheriff | Reaver Sheriff, Ion Sheriff, Kuronami Sheriff, Popmonz Sheriff, Sentinels of Light Sheriff |
| Vandal | Reaver Vandal, Elderflame Vandal, Prime Vandal, Solarstride Vandal, Blackthorn Vandal |
| Phantom | Primordium Phantom, Oni Phantom, Reaver Phantom, Sovereign Phantom, Ion Phantom |
| Guardian | Reaver Guardian, Sovereign Guardian, Solarstride Guardian, Blackthorn Guardian, Oni Guardian |
| Operator | Elderflame Operator, Reaver Operator, Ion Operator, Origin Operator, Glitchpop Operator |
| Classic | Prime Classic, Glitchpop Classic, RGX 11z Pro Classic, Forsaken Classic, Blackthorn Classic |
| Frenzy | Elderflame Frenzy, Oni Frenzy, Glitchpop Frenzy, Prime//2.0 Frenzy, RGX 11z Pro Frenzy |
| Shorty | Oni Shorty, Primordium Shorty, Gaia's Vengeance Shorty, Sentinels of Light Shorty, Prelude to Chaos Shorty |
| Spectre | Reaver Spectre, Prime Spectre, Ion Spectre, Kuronami Spectre, RGX 11z Pro Spectre |
| Stinger | Sovereign Stinger, RGX 11z Pro Stinger, Prelude to Chaos Stinger, Popmonz Stinger, Lycan's Bane Stinger |
| Bulldog | Glitchpop Bulldog, Oni Bulldog, Araxys Bulldog, Phaseguard Bulldog, Radiant Entertainment System Bulldog |
| Bucky | Oni Bucky, Ion Bucky, Magepunk Bucky, Prime//2.0 Bucky, Origin Bucky |
| Judge | Elderflame Judge, Glitchpop Judge, Sovereign Judge, Mystbloom Judge, Imperium Judge |
| Ares | Oni Ares, Ion Ares, Sentinels of Light Ares, Singularity Ares, Gaia's Vengeance Ares |
| Odin | Reaver Odin, Glitchpop Odin, Prime//2.0 Odin, Sovereign Odin, Xenohunter Odin |
| Marshal | Sovereign Marshal, Kuronami Marshal, Blackthorn Marshal, Magepunk Marshal, Gaia's Vengeance Marshal |
| Outlaw | Mystbloom Outlaw, Araxys Outlaw, RGX 11z Pro Outlaw, Phaseguard Outlaw, Keys to Elysium Outlaw |

The full set is about 2.3 GB, too much for the repository. It is a separate download with the same folders as `app/site/`: unpack it over `app/site/` and the Collection lists everything in it.

## What a skin is made of

A skin's files are named `<line>-<weapon>` after the game's working name for the line, which is often not the name in the store: `soulstealer2-ghost` is the Reaver Ghost, `dragon-vandal` the Elderflame Vandal. The name shown in the Collection is the store name, read from the game files and kept in the list below.

| File | What |
| --- | --- |
| `aim-viewmodel/<skin>.json`, `.bin` | the first-person model and its animations |
| `aim-viewmodel/<skin>-color.png` | the colour atlas (2048x2048) |
| `aim-viewmodel/<skin>.equip.json`, `.equip.bin` | the equip animation, for the skins that have their own |
| `aim-ui/collection/<weapon>--<skin>.webp` | the still the Collection shows (`tools/collection-stills.mjs`) |
| `media/skin-fire/<skin>.ogg` | the firing sound, for the skins that have their own in the game |

Two lists say what is installed:

- `aim-ui/collection/imported.json`: `{ "<weapon>": [{ "id": "<skin>", "name": "<shown name>" }] }`. The Collection adds these to the weapon's tab, and gives a tab to a weapon that had none (Frenzy, Classic, Shorty, Bulldog, Bucky, Judge, Ares, Odin, Spectre, Stinger, Marshal, Outlaw).
- `media/skin-fire/index.json`: `{ "<skin>": <volume> }` for the skins with a firing sound of their own. The others fire with the weapon's sound.

The download brings both lists complete, so unpacking it replaces the two files here.

## How it is wired

- `app/collection.js` reads `imported.json` when the app starts and adds the skins to its tabs.
- `app/local-customization.js` keeps a saved skin named `<line>-<weapon>` even though it is on none of its own lists, then drops it (back to the default) once `imported.json` has loaded if the skin is not in it. A skin that is no longer installed therefore never reaches a round. It also plays the skin's firing sound, after the skins whose sounds are set by hand.
- `tools/patch-imported-skins.cjs` makes the three changes the compiled game needs (marker `imported-skins-v1`, safe to run again): the model loader loads `<skin>.json` for a weapon whose saved skin is named that way, the equip-preview loader does the same for the Frenzy, and the key that says which model a weapon is showing counts the skin of the weapons that had none before.

## Limits

- Colour only: no normal or roughness maps, no glow, no effects, no variants, no kill banner or finisher. Skins put in by hand look better; these look like the skin under flat light.
- The firing sound is one mix per skin, made from the game's layers by name; the balance between the layers is a guess.
- 82 of the 615 have no equip animation of their own and use the weapon's.

## Checked

In a hidden copy of the app on this branch, driven through its debugging port:

- The Collection: each of the 90 skins has its tile on its weapon's tab with its still and its store name, and its model, atlas and sound files are served. Twelve weapons got a tab; the 19 tabs wrap onto a second row in a 1280 or 1024 px window.
- Equip saves a skin; after a reload it is still equipped, and three saved skins named like imported ones but not on the list were put back to the default.
- A round with the Elderflame Vandal, and one with the Reaver Vandal: the model shows in first person.
- No page errors from this change.

Not checked: the other 88 skins in a round, the firing sounds by ear, and the full set on this version of the game (it was built and used on 1.4.0).
