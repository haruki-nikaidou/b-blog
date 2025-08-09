---
title: 'Modern gRPC Integration for Frontend Applications: A Complete Guide'
description: 'Modern gRPC implementation for frontend applications: Connect SSR frameworks (SvelteKit, Next.js) to backend services with type-safe, performant communication using Connect, Buf, and Effect.'
pubDate: 'Jul 26 2025'
tags:
  - Distributed System
  - Web Development
heroImageId: '1fb93ab9-0a7a-4fe2-de62-2e8dc955b900'
---

For large-scale projects, gRPC has emerged as the preferred method for connecting services and components, effectively replacing traditional RESTful APIs. It offers superior size efficiency and lower deserialization costs while providing excellent support across multiple programming languages and frameworks.

Since gRPC is built on HTTP/2 and Protocol Buffers (protobuf) are actively maintained by Google, gRPC often becomes the only viable choice for serverless frontends deployed on edge computing platforms that need to communicate with backend servers—particularly for I/O-bound applications.

However, when searching for "grpc nodejs," you'll mostly find outdated tutorials that still use `var` declarations or `require()` statements. These legacy approaches often fail to work in modern non-Node.js runtimes like Bun or Vercel. After extensive research, I've discovered the current best practices for implementing gRPC in serverless frontend applications.


## Architecture Overview

![Architecture](https://imagedelivery.net/6gszw1iux5BH0bnwjXECTQ/9d7e1236-972a-4844-af62-72091325f400/public)

The server-side rendered (SSR) frontend uses SvelteKit. To ensure type safety and optimize validation performance, I've chosen [oRPC](https://orpc.unnoq.com/) for the API layer and [Superforms](https://superforms.rocks/) for form actions. For comprehensive error handling, I use [effect](https://effect.website/) to manage all I/O operations.

The backend server is implemented in Rust (because it should be in Rust, obviously). For the gRPC framework, `tonic` is the natural choice as it's currently the best option available.

The gRPC communication occurs between the SSR frontend and the backend server (represented by the pink arrows in the diagram).

## Set Up gRPC

### Configuring the Linter

First, I recommend using [biome](https://biomejs.dev/) instead of ESLint as your linter. It significantly outperforms both Prettier and ESLint in terms of speed.

> **Note for NixOS users:** Install Biome through Nix rather than npm, or it won't function properly.
 
```shell
pnpm add -D -E @biomejs/biome
pnpm exec biome init # or `biome init` on NixOS
```

Then config `package.json`

```json
{
  "scripts": {
    "lint": "biome lint --write",
    "format": "biome format --write"
  }
}
```

Remember to install the appropriate editor extension. WebStorm, VS Code, and Zed all have Biome extensions available. While I'm unsure about Neovim plugin availability, who uses Neovim for JavaScript development anyway?

### Setting Up the Code Generator

**The recommended libraries for grpc are [Connect](https://connectrpc.com/) and [Buf](https://buf.build/docs/)** 

For detailed information, refer to their [documentation](https://connectrpc.com/docs/web/getting-started). Focus on the "Connect for Web" section rather than "Connect for Node.js"—the latter is designed for building web servers with Node.js, which doesn't align with our requirements.

First, install essential packages:

```shell
pnpm i -D @connectrpc/connect @connectrpc/connect-web \
  @bufbuild/protobuf @bufbuild/protoc-gen-es
```

Next, create the code generation configuration files:

```yaml
# buf.yaml

# For details on buf.yaml configuration, visit https://buf.build/docs/configuration/v2/buf-yaml
version: v2
modules:
  - path: proto
lint:
  use:
    - STANDARD
breaking:
  use:
    - FILE
```

The `buf.yaml` should be placed in the project's root directory. It configures compilation options and include paths:

- `- path: proto` specifies that protobuf files are located in `/proto`, making `/proto` the include path.

```yaml
# buf.gen.yaml

version: v2
inputs:
  - directory: proto
plugins:
  - local: protoc-gen-es
    opt: target=ts
    out: proto-gen
```

The `buf.gen.yaml` file should also be in your root directory and configures the code generator:

- `- directory: proto` indicates that protobuf files are in `/proto`.
- `- out: progo-gen` specifies that generated code will be placed in `/proto-gen`.

After configuration, add the code generation command to your `package.json`:

```json
{
  "script": {
    "proto:gen": "buf generate"
  }
}
```

### Wrap with Effect

I've already created a wrapper for this integration, so you don't need to implement it manually.

[Effect Wrapper Implementation](https://gist.github.com/haruki-nikaidou/63c5f99345680c539c51b08da88e9ea0)

**Important note:** This code is designed for general use. If you're using SvelteKit, replace `process.env.GRPC_URL` with

```typescript
import { env } from '$env/dynamic/private';

// ...
const baseUrl = env.GRPC_URL;
// ...
```

After implementing the wrapper, you can create gRPC clients that return `Effect` instances:

```ts
export const accountClient = createEffectClient(AccountManage);
export const authClient = createEffectClient(AuthService);
```

## Conclusion

This modern approach to gRPC integration provides a robust, type-safe foundation for frontend applications that need to communicate with backend services. By leveraging Connect, Buf, and Effect, you can build scalable applications that benefit from gRPC's performance advantages while maintaining excellent developer experience and code quality.