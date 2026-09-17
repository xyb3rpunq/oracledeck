// index.js — satu pintu masuk untuk seluruh mesin ORACLEDECK.
// Dipakai identik oleh uji di Node dan oleh halaman di peramban.

export * as Relation from './core/relation.js?v=b04806ea2d';
export * as Algebra from './core/algebra.js?v=b04806ea2d';
export * as Sql from './core/sql.js?v=b04806ea2d';
export * as FD from './core/fd.js?v=b04806ea2d';

export * as Fragment from './ddb/fragment.js?v=b04806ea2d';
export * as Allocate from './ddb/allocate.js?v=b04806ea2d';
export * as Localize from './ddb/localize.js?v=b04806ea2d';
export * as Decompose from './ddb/decompose.js?v=b04806ea2d';
export * as Transparency from './ddb/transparency.js?v=b04806ea2d';
export * as JoinStrat from './ddb/joinstrat.js?v=b04806ea2d';
export * as TwoPhase from './ddb/twophase.js?v=b04806ea2d';
export * as Concurrency from './ddb/concurrency.js?v=b04806ea2d';
export * as Deadlock from './ddb/deadlock.js?v=b04806ea2d';
export * as Availability from './ddb/availability.js?v=b04806ea2d';
export * as Erd from './ddb/erd.js?v=b04806ea2d';

export * as Oracle from './oracle/emit.js?v=b04806ea2d';
export * as Data from './data/datasets.js?v=b04806ea2d';

export const VERSI = '1.0.0';
export const NAMA = 'ORACLEDECK';
