---
name: wechat-interaction
description: Use for Mini Program actions, validation, navigation, disabled/loading behavior, or Assessment interaction changes.
---

# WeChat interaction

Read `docs/architecture/WECHAT_INTERACTION_CONTRACT_V2.md`.

Derive behavior from that Contract; do not create a second interaction spec. Preserve its single-action chain, validation timing, Draft/error/navigation rules. If the change also touches class syntax, `wx.*`, generated JS or shared event propagation, additionally use `wechat-runtime-compat`.

Run only the interaction runtime covering the changed flow plus any directly dependent page/domain check. Broaden only for shared code, failure, or an explicit Contract gate. Keep automated / DevTools / ADB / manual Android evidence distinct.
