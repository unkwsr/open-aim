# Crisp lobby interactions

The test copy's lobby uses native wheel scrolling and static active-tab fills.
Removed the wheel interception/easing loop and the animated highlight element.
Cards stay still on hover and press; images do not zoom and cards/buttons have
no glossy sweep. Border/color feedback takes 100 ms. Page changes use a 120 ms
opacity fade with no stagger; reduced-motion preference removes that fade.
The header is opaque charcoal without backdrop blur, with solid selected filters
and clearer card borders. Layout, red accents and keyboard focus remain.
Shared pause/results/round effects retain their existing styles.

Live checks in `tools/skin-converter/lobby-inspection-results.json` confirm no
custom wheel glide or tab glider, no hovered card/image transform, no card
entrance animation or sheen, auto scrolling, an opaque header with no blur, and
working Settings navigation with a 0.12 s fade. These are UI observations, not
measured gameplay or frame-rate improvements.
