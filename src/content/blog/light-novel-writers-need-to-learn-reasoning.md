---
title: 'Light Novel Writers Need to Learn Reasoning'
description: ''
tags: 
  - Literature
  - Light Novel
  - Anime
pubDate: 'Aug 11 2025'
heroImageId: 'b6391612-24f0-45c1-0cfa-599dc4b01800'
notCompleted: true
---

<link href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" rel="stylesheet">

As I develop a light novel review website and English-speaking anime community (as Rust full-stack practice), I developed a six-tier ranking system from S (masterpiece) to F (unpublishable) to establish objective criteria for evaluating light novels. Each tier reflects specific, measurable standards rather than personal preference.

For example, 「涼宮ハルヒ」ranks A-tier instead of S-tier due to accessibility issues—its complex narrative structure creates unnecessary barriers for readers. Meanwhile, 「はぐれ勇者の鬼畜美学」falls to D-tier because its uncritical portrayal of patriarchal dynamics alienates significant portions of its audience.

Through systematic analysis using these criteria, a clear pattern emerged: newer light novels consistently demonstrate weaker logical reasoning and decision-making compared to established classics. This isn't nostalgia bias—it's a measurable decline in fundamental storytelling competencies that demands attention.

## Mathematical Deficiency

Light novel authors frequently make quantitative errors that betray their lack of mathematical reasoning. Consider this concrete example from a work I analyzed in detail.

### The Osananajimi Mathematical Model

Human perception of time follows a logarithmic rather than linear pattern. We experience time slowly in childhood, with each passing year feeling increasingly brief as we age. This psychological phenomenon can be modeled mathematically.

**Core assumptions:**

1. Meaningful time perception begins around age 4
2. The significance of new experiences depends on their rate relative to accumulated life experience
3. Knowledge acquisition bandwidth remains constant at 1 (for simplification)

This yields the fundamental relationship:

$$
\Delta f = \frac{\Delta t}{t}
$$

Where $f$ represents subjective time and $t$ represents chronological time.

Taking the derivative produces a simple ordinary differential equation:

$$
df = \frac{dt}{t}
$$

Integration gives us:

$$
f(t) = \ln t + C
$$

For variable bandwidth $x(t)$, the generalized solution becomes:

$$
f(t) = x(t) \ln t - \int x'(t) \ln t dt
$$

Since $x(t) = 1$ maintains dimensional consistency and provides an elegant baseline, I term this the **Osananajimi Mathematical Model**—useful for analyzing the psychological weight of childhood friendship separations.

### Case Study: A Seven-Year Separation Problem

In 「転校先の清楚可憐な美少女が、昔男子と思って一緒に遊んだ幼馴染だった件」(ranked with B tier), the protagonists separate at age 10 and reunite at 17—a seven-year gap the author treats as dramatically significant.

Let's calculate the actual subjective duration:

$$
\Delta f = \ln (17 - 3) - \ln (10 - 3) = \ln 14 - \ln 7 = \ln 2 \approx 0.693
$$

To contextualize this value, consider what separation period would produce equivalent subjective impact if it began at age 17:

$$
\ln(x-3) - \ln(17-3) = \ln 2
$$

Solving for $x$:

$$
x = 2 \times (17 - 3) + 3 = 31
$$

The seven-year childhood separation carries the same psychological weight as a fourteen-year adult separation (ages 17-31). This reveals the author's fundamental misunderstanding of temporal psychology.

### The Author's Perspective Error

The likely explanation: the author, presumably over 40, applied his own temporal perception to child characters. From an adult's perspective, seven years feels substantial. But mathematically, we can reverse-engineer what separation period would match the author's intended emotional impact.

If we assume the author based the story on his subjective experience of a 33-40 age separation, we can solve:

$$
\ln (17 - 3) - \ln(x - 3) = \ln(40 - 3) - \ln(33 - 3)
$$

This yields:

$$
x = \frac{531}{37} \approx 14.35
$$

**Conclusion:** A three-year separation (ages 14-17, reuniting at 17) would create the emotional resonance the author intended. This demonstrates how mathematical modeling exposes logical inconsistencies that undermine narrative believability.

> **Note:** This analysis requires familiarity with the specific plot details. No English translation exists for this work currently, so readers interested in verification would need to access the original Japanese version.

