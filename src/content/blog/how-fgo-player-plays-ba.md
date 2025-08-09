---
title: 'How a former FGO player plays Blue Archive'
description: 'As a former FGO player, how to use timing tactic, buff optimization, and gacha optimization in Blue Archive.'
pinned: true
pubDate: 'Nov 17 2024'
tags:
  - Game
  - FGO
  - Blue Archive
heroImageId: '6d4828e4-e61f-4c79-4822-3cfef5800f00'
---

<link href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" rel="stylesheet">

Two years ago, I start playing Blue Archive. 

I was a FGO player before, but I deleted my Bilibili account out of dislike for the platform, and since it was the only way to access my FGO China server account, I lost access to the game completely. Starting fresh on the Japanese server would be too difficult to catch up. Besides, since FGO's main value lies in its story, which I can read in either Japanese or English from YouTube, I don't feel the need to continue playing.

After playing Blue Archive for 2 years, I'm confident that I surpass most players in strategy, which stems from from my FGO experience.

## Typical Tactic of FGO Players

All skilled FGO plays must have done these 4 things: **RNG hunting**, **min-maxing the sequence**, **do math before challenging**, **stacking the buffs**. Who hasn't done these things must be a beginner.

RNG hunting doesn't need much explanation, as it's very common. It's seeking perfect card draws or critical hits in FGO, or in similar scenarios in Blue Archive.

Whether it's daily quests, speed-running challenges, maintaining continuous buffs, or solo boss fights - all of these strategies require careful sequencing. In my opinion, the most impressive examples are the [Mash solo run against Arash in Nero celebration](https://www.youtube.com/watch?v=aBZjzCCJ248) and the [13 Command Spells clear vs Kirschtaria]((https://www.youtube.com/watch?v=yIHW-iOGbQ0)) - with the latter being **designed to be impossible** by the developer, yet players found a way.

Though most FGO players don't memorize the complete damage formula, they understand the basics of the four buff categories and their stacking mechanics.

> There are four main buff categories in FGO's damage calculation. 
> Buffs of the same category (like ATK up and DEF down) add together linearly - for example, +10% ATK and -10% enemy DEF equals +20% ATK. 
> Different categories of buffs multiply with each other, leading to diminishing returns when stacking same-type buffs, as 
> 
> $$(1+a)(1+b)=1+a+b+ab>1+a+b$$ 
> 
> This is why combining buffs from different categories is generally more effective than stacking buffs of the same category.

Since FGO lacks an auto-clear system, players must complete daily quests manually, turning these routine tasks into mini speed-running challenges. 
To achieve efficient farming, players need 10 specific servants, with 6 of them being limited 
(Koyanskaya of Light, Altria Caster, Oberon, Merlin, Scáthach-Skadi Ruler, Scáthach-Skadi Caster). 
For new players, the only way to obtain this optimal farming setup is to purchase an account from other players, 
as collecting all these limited servants would be practically impossible.

## Migrate the Tactics into Blue Archive

### Stacking Buffs

Everyone plays Blue Archive knows stacking buffs like mika + ui + ako + kisaki system. But that's far from the maximum.

I use [Schale DB](https://schaledb.com/) to query the values of students.

### Damage Formula in Blue Archive

The damage formula in Blue Archive is far from FGO. There is no buff categories in Blue Archive.

There is no buff categories in Blue Archive just because there is no many chance you can stack more than 4 type of buffs.
Although there are rarely-used students with special systems like Yoshimi (Band) in the Sugar Rush Band system, 
it is very uncommon to stack multiple buffs in a single EX skill.

Like all anime games, all different types of buffs in Blue Archive is multiplied with each other. You can understand these buffs easily:

- ATK up
- Weak (x2) / Effective (x1.5) / Resist (x0.5)
- Crit DMG up
- EX Skill DMG Dealt
- Effectiveness up
- Combat power: from SS (1.3x) to D (0.8x), 0.1 is the step
- Damage Dealt up

Like FGO, there is also stability in Blue Archive. Stability determines how stable the damage is. The range is 

$$
\left[  \frac{Stb}{Stb+1000}+0.2,  \ 1  \right]
$$

Mika's stability is very low at 1376. In Insane or higher difficulty, 
Binah reduces stability by 50%, which means players need more attempts to achieve optimal damage due to the increased damage variance.

Level insufficiency is a hidden damage reduction factor that many players are unaware of. 
When a student's level is lower than the enemy's, damage is reduced by 2% for each level difference, up to a maximum reduction of 60%.

I guess the level insufficiency mechanic becomes particularly relevant when a new raid difficulty is introduced, as there are few other scenarios where students' levels fall below enemy levels. This serves as a special challenge for top players. When a new raid difficulty launches, the boss's level always exceeds the maximum student level, making it extremely difficult, conquerable only by top players. Achieving a two-digit ranking under these conditions provides them with a significant sense of accomplishment.

The reduction rate of DEF is similar to League of Legends:

$$
\frac{\frac{5000}{3}}{\frac{5000}{3} + Def}
$$

When both flat value and percentage-based buffs are present, flat value modifications are always applied first. 
For example, actual DEF = (Base DEF - Flat Defense Piercing) * (1 - Defense Piercing Rate).

Attention that unlike FGO, where you can stack multiple buffs through sequencing tactic, in Blue Archive,
buffs from **identical or similar** skills (such as Himari's EX and Kotama Camp's EX) will be **overridden** when applied multiple times.

### Sequencing Tactic

Sequencing in Blue Archive is much more difficult than in FGO. 

Unlike the turn-based FGO, Blue Archive features a continuous timeline and a skill circular queue. In FGO, you can clear most challenge with 3T burst or ultra long battle. But in Blue Archive, because the time is limited, it is impossible to launch long battle.

The general key for most bosses in Blue Archive is minimum the extra length of skill circular queue, 
because usually, you want to use the dealer's skill more often.

> There are exceptions in final restriction release. 
> In final restriction release, the major damage may be not from EX skill but normal attack.

At first glance, Ui's skill might seem more cost-efficient than Fuuka (New Year)'s, as Ui reduces EX cost twice for 3 cost while Fuuka needs 4 cost (2 cost × 2) for the same effect. However, Fuuka often performs better in practice, especially in common scenarios where you apply two buffs to your dealer - one from a striker student and one from a special student. With Fuuka, you can naturally cycle through supporter skills until your dealer's skill becomes available again. In contrast, when using Ui, you'll be forced to use an additional useless skill to complete the cycle, as using Ui's skill again would override its previous effect like using 3 cost but only reduces once.

## What FGO doesn't Have

FGO is the second most expensive gacha game among all gacha games I know of, only cheaper than Genshin Impact. It is very enough to only spend 4500 JPY in Blue Archive per month.

Because getting new servant is too expensive, competition between players doesn't exist, and it is possible to clear most challenges with serval certain servants. But, in Blue Archive, there is fucking Total Assault.

Someones did cheat in total assault and got banned. I don't know why they take risks with their account. There is absolutely no extra reward from cheating.

### Position

It is rumored that many top players use CV tools or assisted aiming tool in the total assault. That makes sense because position is quite important in Blue Archive.

Obviously, FGO doesn't have position. 

Shamefully, my understanding of positioning mechanics in Blue Archive is basically limited to two scenarios: evading lethal attacks (such as Shiro & Kuro) and manipulating targeting priority (like ensuring students target Goz's real body).

### Defensive or Aggressive

If it just need to deal maximum damage, it will be very simple. As of this writing, there are 139 striker students and 64 special students, resulting in only 30,021,518,016 possible combinations. With computational analysis, it is relatively straightforward to determine the optimal damage-dealing combinations.

Unfortunately, you must ensure your team survival.

Balancing the defense and attack is very difficult sometimes. By using tactical positioning to streamline defense, it is possible to focus more on offensive plays. However, this defensive approach demands precise technique and timing. If you are not very familiar, you probably miss this tactic when configuring the team.

### Multi-team Battles

The only multi-team battles in FGO is the ORT, but it is conquerable without any plan.

In Blue Archive, if you want to gain higher rank in Total Assault, you must learn how to plan a multi-team battle. In multi-team battles, success goes beyond simply organizing teams by combat effectiveness. You must carefully anticipate each boss's attack patterns, as at this difficulty level, any single boss ability can be fatal. Each team composition needs to be strategically planned for their specific turn.

My account development is too low to challenge battles more than 3 teams. I don't have much experience about this.

## Summary

Among historical anime games, Kantai Collection bears the strongest resemblance to Blue Archive. While I'm too young to have experienced Kantai Collection firsthand, the closest game to Blue Archive that I've played is FGO. These games share a common characteristic: despite their relatively weak gameplay mechanics, they captivate players through their compelling characters or storytelling. Blue Archive's storytelling nearly matches FGO's quality, while its character designs are more accessible and appealing to newcomers. In light of Blue Archive surpassing Kantai Collection's presence at Comic Market since 2024, it might have potential to achieve a historic status comparable to the Touhou Project, had Nexon not mishandled their employee relations, which led to the departure of key creative team members.

Due to the severe lack of resources on the Chinese Internet, I used English more than Chinese even Chinese is my native language and I was living in China. Not creating an account on the Japanese server when I first started playing FGO was a blunder, as I was too cowered to learn Japanese at the time (I was 16 years old at that time, so it is forgivable). Therefore, deleting my Bilibili account and starting to play Blue Archive on the Japanese server marked a significant milestone for me. My decision proved to be right: after I had played Blue Archive for a year, when the game finally passed CCP's examination and launched in China, it underwent substantial changes due to ideological and political reasons that made it nearly unrecognizable.

Maybe you have found, my blog's background is imitated from a CG in Blue Archive. [Source](https://youtu.be/tqNWu6QrBGs)

Anyhow, stop dwelling on these perpetual worries and just enjoy the game.

アズサちゃん大好き。