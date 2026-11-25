// Preloaded with `node --import`: any fetch means a harness bug.
globalThis.fetch = () => { throw new Error('network used') }
