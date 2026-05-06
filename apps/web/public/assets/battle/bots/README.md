# Battle Bot Rive Assets

Place temporary or final `.riv` files here and configure each bot in Admin → Battle → Bot Profiles.

Expected runtime contract:

- `riveSrc`: `/assets/battle/bots/<file>.riv`
- `riveArtboard`: `__default__` unless the exact artboard name is verified
- `riveStateMachine`: `__none__` unless the exact state machine name and input names are verified

Do not guess artboard/state machine names. The learner battle UI treats `__default__` and
`__none__` as safe auto-load metadata so a third-party `.riv` can render without crashing the
arena. Only set a real state machine when the file is known to expose all expected inputs:

- state machine inputs/triggers:
  - `battle_idle`
  - `battle_matched`
  - `battle_countdown`
  - `battle_thinking`
  - `battle_correct`
  - `battle_wrong`
  - `battle_win`
  - `battle_lose`
  - `battle_draw`
  - `battle_abandoned`

Keep source/license/provenance in the bot profile fields. `.riv` files are treated as binary by
`.gitattributes`.
