# The Mock Identity Source. Built from the repository root, because its
# one dependency is pinned in the root package.json and lockfile rather than
# in a second pair of its own that could drift from the first.
FROM node:24.22.3-alpine
WORKDIR /mock-source
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
# `--ignore-scripts` because the root's `prepare` installs git hooks, which
# have no business in an image and whose tool is a devDependency.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY mock-source/server.ts mock-source/mock.json ./
USER node
# Node runs TypeScript itself by stripping the types: nothing to compile.
CMD ["node", "server.ts"]
