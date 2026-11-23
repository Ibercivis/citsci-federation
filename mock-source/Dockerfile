# The Mock Identity Source. Built from the repository root, because its
# one dependency is pinned in the root package.json and lockfile rather than
# in a second pair of its own that could drift from the first.
FROM node:26.13.1-alpine
WORKDIR /mock-source
# Node stopped shipping Corepack with the runtime after 24, so it is installed
# here. It reads `packageManager` from the root package.json, which stays the
# only place pnpm's version is written; `npm install -g pnpm@<version>` would
# write it a second time.
RUN npm install --global corepack@latest && corepack enable
COPY package.json pnpm-lock.yaml ./
# `--ignore-scripts` because the root's `prepare` installs git hooks, which
# have no business in an image and whose tool is a devDependency.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY mock-source/server.ts mock-source/newcomers.ts mock-source/mock.json ./
USER node
# Node runs TypeScript itself by stripping the types: nothing to compile.
CMD ["node", "server.ts"]
