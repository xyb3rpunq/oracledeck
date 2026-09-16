// index.js — satu pintu masuk untuk seluruh mesin ORACLEDECK.
// Dipakai identik oleh uji di Node dan oleh halaman di peramban.

export * as Relation from './core/relation.js';
export * as Algebra from './core/algebra.js';
export * as Sql from './core/sql.js';
export * as FD from './core/fd.js';

export * as Fragment from './ddb/fragment.js';
export * as Allocate from './ddb/allocate.js';
export * as Localize from './ddb/localize.js';
export * as Decompose from './ddb/decompose.js';
export * as Transparency from './ddb/transparency.js';
export * as JoinStrat from './ddb/joinstrat.js';
export * as TwoPhase from './ddb/twophase.js';
export * as Concurrency from './ddb/concurrency.js';
export * as Deadlock from './ddb/deadlock.js';
export * as Availability from './ddb/availability.js';
export * as Erd from './ddb/erd.js';

export * as Oracle from './oracle/emit.js';
export * as Data from './data/datasets.js';

export const VERSI = '1.0.0';
export const NAMA = 'ORACLEDECK';
