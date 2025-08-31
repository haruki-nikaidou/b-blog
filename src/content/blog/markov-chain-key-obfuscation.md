---
title: 'A Markov Chain Based Key Obfuscation Algorithm'
description: ''
pubDate: 'Sep 1 2025'
tags:
  - Math
  - Reverse Engineering
  - Rust
heroImageId: '1ccd914c-455c-4eee-8bde-b28aae802100'
notCompleted: true
---

The purpose is to hide an AES-512 or other key in the static build. This is useful when it is impossible to implement
online software license verifying.

The idea of this algorithm is to use Markov chain to half-randomly generate the key until it matches the hash.

## Markov Chain Model of Random Key Generation

Think of "success" at position $i$ as the generator outputs the $i$ -th correct byte of the key.

Let $p_i \in (0,1]$ be the probability that, when you have matched the first $i$ bytes, the next output is the $(i+1)$
-th correct byte.

A simple and analyzable transition role is reset-on-mismatch:

- From state $i$ < $n$ ($n$ is the length of the key), with probably $p_i$ go to $i+1$, with probability $i-p_1$ go
  to $0$.
- From state $n$, stay at $n$.

> It is possible to replace "go to 0" with a KMP-style fallback to a shorter matched prefix, but is makes the process
> unpredictably faster.

## Expected Runtime

Let $E_i$ be the expected number of draws to reach state $n$ from the state $i$.

With the reset-on-mismatch rule, the linear system:

$$
E_i = 1+p_i E_{i+1} + (1-p_i) E_0, \qquad E_n = 0
$$

solves in closed form for the initial expectation $E_0$.

$$
E_0 = \frac{\displaystyle \sum_{k=0}^{n-1}\prod_{j=0}^{k-1} p_j }{\displaystyle \prod_{j=0}^{n-1}p_j }
$$

When all $p_i = p$:

$$
E_0 = \frac{1-p^n}{(1-p)p^n}
$$

As $p\rightarrow 1$, $E_0 \rightarrow n$; as $p<1$ is fixed and $n$ grows.

## Make it polynomial instead of exponential

You can make $E_0$ grow like any desired polynomial order by increasing the per-step success probability as you
progress. A very handy schedule is:

$$
p_i = \left( \frac{i+s}{i+s+1} \right)^\alpha, \qquad s\geq 1, \alpha \geq 1
$$

Then the products simplify:

- Prefix product $\prod_{j=0}^{k-1} p_j = \left(\frac{s}{s+k} \right)^\alpha$
- Full product $\prod_{j=0}^{n-1} p_j= \left(\frac{s}{s+n} \right)^\alpha$

Plugging these into the closed form gives

$$
\begin{align*}
E_0 &= \frac{\displaystyle \sum_{k=0}^{n-1} \left(\frac{s}{s+k} \right)^\alpha}{\displaystyle\left(\frac{s}{s+n} \right)^\alpha} \\
&=\left( \frac{s+n}{s} \right)^\alpha \sum_{k=0}^{n-1}\left(\frac{s}{s+k} \right)^\alpha \\
&=(s+n)^\alpha \sum_{k=0}^{n-1}\frac{1}{(s+k)^\alpha} \\
&=(s+n)^\alpha\sum_{k=0}^{n-1}(s+k)^{-\alpha}
\end{align*}
$$

Notice the finite sum is a partial sum of the Hurwitz zeta:

$$
\zeta(\alpha, s) = \sum_{m=0}^{\infty} (m+s)^{-\alpha} \qquad (\alpha >1,\ s>0)
$$

Hence

$$
\sum_{k=0}^{n-1}(s+k)^{-\alpha} = \zeta(\alpha,s)-\zeta(\alpha, s+n)
$$

Therefore

$$
E_0 = (s+n)^\alpha \left[\zeta(\alpha,s) - \zeta(\alpha, s+n) \right]
$$

Now we get a $E_0 = \zeta(\alpha)\Theta(n^\alpha)$ form where $\zeta(\alpha)$ is the Riemann zeta function.

### The offset $s$

The offset $s$ smooth the early steps (keeps $p_0$ from being too small). Because $p_0 = \left(\displaystyle\frac{s}{s+1}\right)^\alpha$, increasing $s$ raises that floor without changing the asymptotic order.

### The Proof of Large $n$ asymptotics.

As $q\rightarrow \infty$,

$$
\zeta(\alpha,q) = \frac{q^{1-\alpha}}{\alpha - 1} + \frac{q^{-\alpha}}{2} ^ O(q^{-\alpha-1})
$$

Set the $q=s+n$ and plug into the exact formula:

$$
E_0 = (s+n)^\alpha\zeta(\alpha,s) - \frac{s+n}{\alpha-1} - \frac{1}{2} + O((s+n)^{-1})
$$

So the leading term is 

$$
E_0 \sim \zeta(\alpha,s)(s+n)^\alpha \qquad (n\rightarrow\infty)
$$

### Edge cases

If $\alpha=2$, $\zeta(2) = \pi^2/6$ and $E_0 = (n+1)^2\left[ \pi^2/6 - \zeta(2, n+1) \right] = \frac{\pi^2}{6} (n+1)^2 - \Theta(n)$

If $\alpha=1$: zeta diverges, the exact formula reduces to

$$
E_0 = (s+n)\sum_{k=0}^{n-1}\frac{1}{s+k} = (s+n)(H_{s+n-1} - H_{s-1}) \sim (s+n) \log \frac{s+n}{s}
$$

i.e., $\Theta(n\log n)$