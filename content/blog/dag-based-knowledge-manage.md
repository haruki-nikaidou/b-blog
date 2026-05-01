---
title: "Knowledge Has a Shape, and That Shape Is a DAG"
description: "Why most things you find hard to learn aren't hard — you're just missing a prerequisite, and lists and trees can't show you which one."
pubDate: "May 02 2026"
heroImageId: "6a47ecf7-d2e8-4dfa-b04a-aa3dbab30000"
tags:
  - Data Structure
  - Education
---

You've probably had this happen with a dictionary. You look up a word — say, _ostensible_ — and the definition uses _purported_. You don't know _purported_ either, so you look that up, and the definition uses _ostensible_. The dictionary has handed you a closed loop. Two words, each defined in terms of the other, and nowhere to start.

This isn't a bad dictionary. It's a normal dictionary. The same thing happens in textbooks, in classrooms, and in conversations with smart people who can't quite explain what they know:

> A: What's a function, in math?
>
> B: It's a rule that maps each input to exactly one output.
>
> A: What's a "rule"? And what's a "map"?
>
> B: A map is... well, it's like a function. A rule is the function itself, basically.
>
> A: ...

It's tempting to call this a communication failure. It isn't. It's a data structure failure. The explanation is going in circles because the knowledge in B's head is shaped like a circle, and you can't teach a circle. There's nowhere to start.

This post is about the data structure that fixes this. It's called a **directed acyclic graph**, or **DAG**. The name sounds intimidating, but each word in it earns its place, and once you see what each one is doing, the idea is hard to unsee.

## What a DAG is, one word at a time

### "Graph": dots and arrows

The simplest version: a graph is dots connected by arrows.

Imagine you're learning to bake bread. There are a few facts you need to put together:

1. Mixing flour and water makes dough.
2. Yeast eats sugar and releases gas.
3. Gas trapped in dough makes it rise.
4. Heat sets the risen dough into bread.

Now draw each fact as a dot, and draw an arrow from A to B whenever you need to understand A before B makes sense. "Yeast eats sugar" points to "gas makes dough rise," because the second sentence assumes you know where the gas came from. "Mixing flour and water" also points to "gas makes dough rise," because you also need to know what dough is.

Two arrows, same target. That's allowed, and it's the whole point.

### "Directed": arrows have a direction

"A is needed for B" is not the same as "B is needed for A." You need to understand addition before you can understand multiplication; you don't need multiplication to understand addition. The arrow goes one way.

Here's the sentence I'd put on a poster: **most things you find hard to learn are hard because you're missing a prerequisite, not because you're not smart enough**.

### "Acyclic": no loops allowed

Acyclic just means: no cycles. No following arrows around and ending up back where you started. If your graph has a cycle, then somewhere in it, A depends on B and B depends on A — which is exactly the dictionary problem. Cycles are forbidden, and that rule is what makes the structure useful for teaching. We'll come back to why in a minute.

So: **directed acyclic graph**. Dots connected by one-way arrows, with no loops. That's the whole thing.

## Why not a list, why not a tree?

Most ways we organize knowledge aren't DAGs. They're simpler shapes that almost work, and the places they fall short are exactly the places learning gets confusing.

The simplest shape is a **list**. Textbook chapters in order. Course weeks 1 through 14. A list says: knowledge is one-dimensional, finish this before that. But knowledge isn't one-dimensional. To understand momentum, you need to understand mass _and_ velocity. There's no honest way to say which one comes first; they're independent prerequisites that both have to be in place.

A list forces you to pick one and pretend the other doesn't exist. That's fine when the reader already knows the hidden one. It's confusing when they don't, and they usually don't, because the whole reason they're reading is to learn.

The next step up is a **tree**. Trees allow hierarchy: a topic has subtopics, which have sub-subtopics. Most school syllabi look like trees. But trees still have a strict rule: each topic has exactly one parent. So where do you put "energy" in a tree of physics? Under "mechanics"? Under "thermodynamics"? Under "chemistry"? It belongs under all three, but a tree only lets you pick one. The moment you pick, you've lied about the connections you didn't choose.

Trees are why so many curricula have that uncanny feeling of _almost_ explaining something. A real prerequisite is sitting somewhere else in the tree, unmentioned, because the hierarchy didn't have a slot for it.

A DAG drops the one-parent rule. A node can have as many parents as it actually has. This sounds like a small change, but it's the difference between a map that matches the territory and a map that's been folded to fit the page.

## Cycles are where bad teaching hides

Now the part that took me longest to appreciate. The "acyclic" rule isn't just a technicality. It's the whole reason this shape is useful for learning.

When you sit down to draw the DAG for something you know well, you will hit cycles. You'll write down "to understand recursion, you need to understand the call stack," and then realize you were planning to explain the call stack using recursion. You'll write "force is mass times acceleration" and then notice that the way you've been thinking about mass is "the thing that resists acceleration when you push on it" — which is acceleration explaining mass explaining acceleration.

Each cycle is a place where your understanding is quietly defining something in terms of itself. In your own head, you can get away with it, because nobody's checking. The DAG is the thing that won't let you get away with it.

The fix is almost always one of two moves:

- **Factor out a shared underlying concept** that both of the cycling nodes depend on. Recursion and the call stack both depend on a more primitive idea: "a function call as a stack frame." Once you add that node, the cycle resolves: the new node points to both, and neither points to the other.
- **Realize the two nodes are actually one node** wearing different clothes. Sometimes the cycle is telling you that you've double-counted a single concept. "Average speed" and "total distance over total time" don't need to be two separate ideas pointing at each other; they're the same idea.

This matters because of something called the **curse of knowledge**: once you understand something well, it becomes very hard to remember what it was like not to understand it. The steps you took to get there become invisible to you. It's why specialists are so often bad teachers, and it's not a character flaw — it's a structural feature of how expertise works. The missing prerequisites are, by definition, the ones you've forgotten you ever needed.

You can't introspect your way out of the curse. But you _can_ catch yourself in cycles, because cycles fail an external check. When your draft DAG loops, the loop is a fingerprint of a place where you've compressed a real prerequisite into "just obvious." Resolving the cycle forces you to dig up whatever you buried.

## Building your own

Practical advice, in rough order.

**Start from the thing you want to teach, not from first principles.** Working forward from axioms is how mathematicians write textbooks; it's a bad way to discover a personal DAG, because you'll exhaustively map regions nobody needed mapped. Pick the destination, then walk backwards.

**Add a node every time you catch yourself saying "assuming you know X."** That assumption is an edge. Write it down. The most useful nodes are the ones you almost didn't notice you were assuming.

**Stop when you hit nodes your audience genuinely already has.** Every DAG has _axioms_ — leaves at the bottom that you're not going to explain, because the reader already knows them. These are different for different readers, which is why "the prerequisite graph for teaching X" isn't one graph; it's one graph per audience. Teaching the same topic to a physicist and to a high schooler is, almost literally, two different DAGs that happen to share a top.

**Keep node descriptions to one sentence.** If you can't fit a node into a sentence, it's two nodes pretending to be one. Splitting them usually reveals an edge you'd been hiding.

**When you find a cycle, factor or merge.** Don't paper over it. The cycle is the most informative thing the graph will ever tell you.

## Teaching from a DAG

Here's the model that changed how I think about teaching.

A learner, at any moment, _is_ a set of nodes — the ones they've already mastered. Call this their **mastered set**. The **teachable frontier** is the set of nodes whose parents are all in the mastered set. These are the nodes the learner is ready for: every prerequisite is in place, so the new concept has somewhere to attach.

Good teaching is picking the next node from the frontier. That's it. Not from the textbook's order, not from the order _you_ learned it in, not from where you left off last week. From this learner's current frontier.

This reframes a lot of teaching frustrations. "This student isn't getting it" almost always means "I'm trying to teach a node whose parents aren't in their mastered set." **That's a diagnosis, not a judgment.** You don't need a different student or a different explanation; you need to back up the graph and find the missing parent. Once it's in place, the original node usually drops in without further effort.

It also explains why there are _multiple_ valid teaching orders for the same subject. Any ordering that respects the arrows is a valid lesson plan. (Graph theorists call this a _topological sort_, and a DAG usually has many of them.) The choice between them is where teaching style and taste live. Some teachers go depth-first, building one branch all the way down before starting the next. Some go breadth-first, building wide foundations before any payoff. Some give an early payoff and backfill the prerequisites afterward. All of these can work. What can never work is an ordering that violates the DAG, no matter how charismatic the teacher: if you teach B before A, and B genuinely needs A, the lesson lands on nothing.

## Maintaining the graph

Your DAG is not a thing you draw once. It's a thing you debug for years.

Every time you successfully explain something, pay attention to which prerequisites you actually leaned on. Those are the real edges, and they're often not the ones you'd have predicted. Every time you fail to explain something, look for a missing parent — a node the learner didn't have, that you'd assumed they did. Add it. Over time, you accumulate a graph that's specific to you, to this subject, and to the kinds of learners you tend to encounter. It will be more useful than any textbook, because textbooks are written for an imagined median reader and yours is debugged against real ones.

The graph is also self-improving in a way lists and trees aren't. A list, when you find a gap, has nowhere obvious to put the new step. A tree, when you find a cross-link, has nowhere to put it without breaking the hierarchy. A DAG just gets a new edge or a new node. The structure absorbs new understanding instead of resisting it.

## Knowledge is a shape

If you ask most people to picture knowledge, they'll picture a pile of facts, or a ladder, or a tree. None of these are right. Knowledge is a DAG, and once you see that shape, you can't unsee it.

The next time someone explains something badly to you, you'll catch yourself drawing the cycles in their explanation — the places where two ideas are leaning on each other with nothing underneath. The next time you explain something well, you'll notice that you quietly walked a DAG in your head, picking nodes off a frontier in an order that happened to match what your listener already knew.

And the next time you find something genuinely hard to learn, you'll have a new question to ask. Not "am I smart enough for this?" but "which parent am I missing?"

That question has an answer. The other one doesn't.
