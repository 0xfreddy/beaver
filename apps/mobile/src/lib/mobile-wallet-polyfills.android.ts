import { Buffer } from 'buffer';

// web3.js and SPL Token expect Buffer before their modules are evaluated.
globalThis.Buffer = globalThis.Buffer ?? Buffer;
