# Live2D 渲染：pixi-live2d-display + .moc3

Live2D 角色使用 pixi-live2d-display（基于 PIXI.js + Live2D Cubism Core）渲染 .moc3 格式模型。项目内置一个开源默认模型，用户可在设置中更换为自己的 .moc3 模型。

选择 pixi-live2d-display 而非官方 Cubism SDK for Web，因为它是 Web 端 Live2D 的事实标准，社区资源丰富，且无需处理官方 SDK 的商业授权问题。MVP 阶段只做静态表情 + 说话时嘴部动效，不做表情/动作联动。
