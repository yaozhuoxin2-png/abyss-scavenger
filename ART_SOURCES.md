# 美术来源与许可

## 在线参考素材

- `Pixel art top down dungeon tileset and rpg character with animations`
  - 作者：profpatonildo
  - 来源：https://opengameart.org/content/pixel-art-top-down-dungeon-tileset-and-rpg-character-with-animations
  - 许可：CC0 / Public Domain
  - 用途：用于确认俯视地牢的图块比例、角色锚点与四帧行走节奏。

## 本项目素材

`hero-sprites-v4.png` 与 `enemy-sprites-v4.png` 是为《深渊拾荒者》v3.1 新生成并整合的原创游戏素材。它们不再使用圆盘底座、六边形头像裁切或棋子式轮廓。

## v7.0 原创动作图集

- `hero-sword-v7.png`、`hero-bow-v7.png`、`hero-staff-v7.png`：分别将长剑、猎弓、法杖直接整合进角色身体动作，包含八方向以及待机、移动、攻击、受击、击倒/死亡和处决姿态。
- `enemies-core-v7.png`、`enemies-arcane-v7.png`：覆盖近战、远程、重型、幽魂、施法、刺客与召唤型敌人的八方向完整身体轮廓。
- `bosses-morph-v7.png`：六位首领按阶段改变身体结构的变形图集。
- 生成模式：原创暗黑哥特俯视角像素游戏图集；使用黑铁、旧金、骨白与各首领主题色，透明背景，避免棋子底座、头像裁切、持续闪烁及与现有商业游戏角色相似的设计。

## v8.0 素材驱动 VFX

- `vfx-sword-slash-atlas-v8.png`：为剑士“断岳回锋”原创生成的八帧手绘剑光图集，采用月白核心、冰蓝电离边和克制的紫色残影，透明背景。
- `vfx-sword-sparks-atlas-v8.png`：原创生成的八帧命中碎光与薄雾 Flipbook，透明背景，不使用持续闪烁。
- `vfx-sword-flow-v8.png`：原创生成的灰度定向流动源图。
- `vfx-sword-normal-v8.png`、`vfx-sword-distortion-v8.png`：由流动源图通过 `tools/build_vfx_maps.py` 本地派生的法线图与双通道扭曲图。
- 生成模式：OpenAI 内置图像生成工具；全部为本项目新生成素材，没有复制其他游戏的角色、图标或特效资源。

## v8.1 法师 · 素材驱动 VFX

- `vfx-staff-eclipse-atlas-v8.png`：为法师“蚀星飞梭”原创生成的八帧晶体星核图集。它从蓄能种子、环绕棱晶到飞行彗尾与受控星爆连续演变，不使用通用火球或圆形光环。
- `vfx-staff-collapse-atlas-v8.png`：为“星界坍缩”原创生成的八帧星座囚笼图集。六枚不规则星核先以细冰晶连线成型，随后折入棱镜坍缩并留下碎晶余韵。
- `vfx-staff-flow-v8.png`：原创灰度星尘流动源图；`vfx-staff-normal-v8.png` 与 `vfx-staff-distortion-v8.png` 由同一源图经 `tools/build_vfx_maps.py` 本地派生。
- 生成模式：OpenAI 内置图像生成工具。所有素材均为本项目原创，未复制或模拟任何商业游戏的受版权保护特效素材。
