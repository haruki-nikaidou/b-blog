---
title: "Knowledge Has a Shape, and That Shape Is a DAG"
description: ""
pubDate: "May 02 2026"
draft: true
heroImageId: "6a47ecf7-d2e8-4dfa-b04a-aa3dbab30000"
tags:
  - Data Structure
  - Education
---

You may have conversation like this:

> A: Hey, what does _Lagrangian_ means in _Lagrangian mechanics_?
>
> B: The idea of _Lagrangian mechanics_ and _Lagrangian_ is let the _action functional_ remain at a stationary point.
>
> A: So what is _action functional_ and why it should remain at a stationary point.
>
> B: It's value derived from _Lagrangian_. And that's called _stationary action principle_.
>
> A: ...
>
> B: ...
>
> A: Okay I'm too stupid to understand Lagrangian mechanics.

It's tempting to call this a communication failure. It isn't. It's a data structure failure. The explanation of _Lagrangian_ and _action functional_ is going in circles because the thing in your head is going in circles. And you have no way to teach a circle, because there's nowhere to start.

This post is about the data structure that fixes this. It's called a directed acyclic graph, or DAG. But I'm going to put off using that name for a while because the name does most of its work after you've already seen the idea.

## How it is "directed", "acyclic" and is a "graph"

### Direction means depend

Imagine you're teaching someone to bake bread, the recipe may be like this

1. Mixing flour and water makes dough.
2. Yeast eats sugar and release gas.
3. Gas trapped in dough makes it rise
4. Heat sets the dough into bread

How you can draw arrows. An arrow from A to B means **you need A before makes sense**.

"Yeast eats sugar" points to "gas makes dough rise," because the latter assumes the former. "Mixing flour and water" also points to "gas makes dough rise," because you need to know what dough is. Two arrows, same target. That's allowed, and it's the whole point.

Arrows have direction. "A is needed for B" is not the same as "B is needed for A".

Here's the sentence I'd put on a poster: most things you find hard to learn are just because you are missing dependiency.

### Why not a list, why not a tree

Here's where this matters more than it might seem.

Most ways we organize knowledge are **lists**. Textbooks have chapters in order. Courses have weeks 1 through 14. Tutorials go step by step. A list says: knowledge is one-dimensional, finish this before that. But knowledge isn't one-dimensional. Lagrangian is kinetic minus potential energy, and there is honest way to say which one comes first. They're independent prerequisites that both have to be in place.

A list forces you to pick one and pretend the other doesn't exist, which is fine when the reader already knows the hidden one and confusing when they don't.

The next step up is a **tree**. Trees allow hierarchy: a topic has subtopics, which have sub-subtopics. Most syllabi look like trees. But trees still let each node have only one parent. Where do you put "Coriolis force" in a tree of mechanics? Under "classical mechanics"? Under "virtual work"? You have to pick, and the moment you pick, you've lied about the dependency you didn't choose.

Trees are why so many curricula have that uncanny feeling of almost explaining something. A real prerequisite is sitting somewhere else in the tree, unmentioned, because the hierarchy didn't have a slot for it.

A graph drops the one-parent rule. A node can have as many parents as it actually has. This sounds like a small change but it's the difference between a map that matches the territory and a map that's been folded to fit the page.

### The cycle-breaking is the pedagogy

Now the part that took me longest to appreciate.

When you sit down to draw the DAG for something you know well, you will hit cycles. You'll write down "to understand Lagrangian, you need to understand action because of d'Alembert's principle", and then realize that the way you derive action is from Lagrangian. You'll find that "monad" and "functor" point at each other in your head. You'll find that two concepts you thought were separate are secretly the same one viewed from different angles.

Each cycle is a place where your understanding is circular, where you're quietly defining something in terms of itself and getting away with it because nobody's checking. Mainwhile, the DAG checks. The DAG is the thing that won't let you get away with it.

The fix is almost always one of two moves:

- **Factor out a shared underlying concept** that both of the cycling nodes depend on. Recursion and the call stack both depend on the more primitive idea of "a function call as a frame." Once you add that node, the cycle resolves: the new node points to both, and neither points to the other.
- **Realize the two nodes are actually one node** wearing different clothes. Sometimes the cycle is telling you that you've double-counted a single concept, like the action functional and Lagrangian.

And this is where the curse of knowledge comes in. The curse of knowledge is the well-documented difficulty experts have imagining what it's like not to know what they know. Once you are familiar enough, you make the your knowledge **bootstrapping** for shortcut, then the steps you took to get there become invisible to you. It's why specialists are so often bad teachers, and it's not a character flaw; it's a structural feature of how expertise works.

> In computer science, bootstrapping is the technique for producing a self-compiling compiler – that is, a compiler (or assembler) written in the source programming language that it intends to compile.
>
> From [Wikipedia](https://en.wikipedia.org/wiki/Bootstrapping_(compilers))

The DAG is a tool for working around the curse. You can't introspect your way out of it by definition. The missing prerequisites are the ones you've forgotten you ever needed. But you can catch yourself in cycles, because cycles fail an external check. When your draft DAG loops, the loop is a fingerprint of a place where you've compressed a real prerequisite into "just obvious." Resolving the cycle forces you to dig up whatever you buried.

## How to use it

### Build one from sketch

Practical advice, in rough order:

1. Start from the thing you want to **teach**, not from first principles. Working forward from axioms is how mathematicians write textbooks; it's a bad way to discover a personal DAG, because you'll exhaustively map regions nobody needed mapped. Pick the destination, then walk backwards.
2. Add a node every time you catch yourself saying **"assuming you know X."** That assumption is an edge. Write it down. The most useful nodes are the ones you almost didn't notice you were assuming.
3. Stop when you hit nodes your audience genuinely already has. Every DAG has axioms, leaves at the bottom that you're not going to explain because the reader already knows them. These are different for different readers, which is why "the prerequisite graph for teaching X" isn't one graph; it's a graph per audience. Teaching the same topic to a physicist and to a high schooler is, almost literally, two different DAGs that happen to share a top.
4. Keep node descriptions to one sentence. If you can't fit a node into a sentence, it's two nodes pretending to be one. Splitting them usually reveals an edge you'd been hiding.
5. When you find a cycle, factor or merge. Don't paper over it. The cycle is the most informative thing the graph will ever tell you.

### For educators

Here's the model that changed how I think about teaching.

A learner, at any moment, is a set of nodes, the ones they've mastered. Call this their mastered set. The **teachable frontier** is the set of nodes whose parents are all in the mastered set. These are the nodes the learner is ready for: every prerequisite is in place, so the new concept has somewhere to attach.

Good teaching is picking the next node from the frontier. That's it. You don't pick from the textbook's order, or from the order you learned it in, or from where you left off last week. It's on you who pick from this learner's current frontier.

This reframes a lot of teaching frustrations. "This student isn't getting it" almost always means "I'm trying to teach a node whose parents aren't in their mastered set." **That's a diagnosis, not a judgment.** You don't need a different student or a different explanation; you need to back up the graph and find the missing parent. Once it's in place, the original node usually drops in without further effort.

It also explains why there are *multiple* valid teaching orders for the same subject. Any ordering that respects the arrows is a valid lesson plan; the graph theorists call this a topological sort, and a DAG typically has many of them. The choice between them is where teaching style and taste live. Some teachers go depth-first, some go breadth-first, some build wide foundations before any payoff, some give an early payoff and backfill. All of these can work. What can never work is an ordering that violates the DAG, no matter how charismatic the teacher: if you teach B before A and B genuinely needs A, the lesson lands on nothing.

### Maintaining the graph

Your DAG is not a thing you draw once. It's a thing you debug for years.

Every time you successfully explain something, pay attention to which prerequisites you actually leaned on. Those are the real edges, and they're often not the ones you'd have predicted. Every time you fail to explain something, look for a missing parent, a node the learner didn't have, that you'd assumed they did. Add it. Over time, you accumulate a graph that's specific to you, to this subject, and to the kinds of learners you tend to encounter. It will be more useful than any textbook, because textbooks are written for an imagined median reader and yours is debugged against real ones.

The graph is also self-improving in a way lists and trees aren't. A list, when you find a gap, has nowhere obvious to put the new step. A tree, when you find a cross-link, has nowhere to put it without breaking the hierarchy. A DAG just gets a new edge or a new node. The structure absorbs new understanding instead of resisting it.

## Knowledge is a shape

Most people, if you ask them to picture knowledge, picture a pile of facts, or a ladder, or a tree. None of these are right. Knowledge is a DAG, and once you see that shape, you can't unsee it.

The next time someone explains something badly to you, you'll catch yourself drawing the cycles in their explanation: the places where two ideas are leaning on each other with nothing underneath. The next time you explain something well, you'll notice you've quietly walked a DAG in your head, picking nodes off a frontier in an order that happened to match what your listener already knew.

And the next time you find something genuinely hard to learn, you'll have a new question to ask: not "am I smart enough for this?" but "which parent am I missing?" That question has an answer. The other one doesn't.
