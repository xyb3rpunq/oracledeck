// index.js — satu pintu masuk untuk seluruh mesin ORACLEDECK.
// Dipakai identik oleh uji di Node dan oleh halaman di peramban.

export * as Relation from './core/relation.js?v=849b085103';
export * as Algebra from './core/algebra.js?v=849b085103';
export * as Sql from './core/sql.js?v=849b085103';
export * as FD from './core/fd.js?v=849b085103';

export * as Fragment from './ddb/fragment.js?v=849b085103';
export * as Allocate from './ddb/allocate.js?v=849b085103';
export * as Localize from './ddb/localize.js?v=849b085103';
export * as Decompose from './ddb/decompose.js?v=849b085103';
export * as Transparency from './ddb/transparency.js?v=849b085103';
export * as JoinStrat from './ddb/joinstrat.js?v=849b085103';
export * as TwoPhase from './ddb/twophase.js?v=849b085103';
export * as Concurrency from './ddb/concurrency.js?v=849b085103';
export * as Deadlock from './ddb/deadlock.js?v=849b085103';
export * as Availability from './ddb/availability.js?v=849b085103';
export * as Erd from './ddb/erd.js?v=849b085103';

export * as Oracle from './oracle/emit.js?v=849b085103';
export * as Data from './data/datasets.js?v=849b085103';

export const VERSI = '1.0.0';
export const NAMA = 'ORACLEDECK';
