# Lesson 29

React Compiler (`vite` `react({ compiler: true })`) can strip `useSyncExternalStore` / state whose value is only `void`’d or used in a dead ternary — the subscribed value must flow into the returned UI (e.g. fallback expression), or late `setThumbUrl` will not re-render spread frames.
