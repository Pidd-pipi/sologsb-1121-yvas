import type { Plot } from './plot';
import type { TreeRecord } from './tree';
import type { RegenShrub } from './regen';

/** 送审状态：待审核 / 已退回 / 已通过归档 */
export type SubmissionStatus = 'submitted' | 'returned' | 'approved';

/** 留档动作类型：送审 / 退回 / 通过 */
export type ReviewActionType = 'submit' | 'return' | 'approve';

export const SUBMISSION_STATUS_META: Record<SubmissionStatus, { label: string; color: string }> = {
  submitted: { label: '待审核', color: 'processing' },
  returned: { label: '已退回', color: 'error' },
  approved: { label: '已归档', color: 'success' },
};

export const REVIEW_ACTION_META: Record<ReviewActionType, { label: string; color: string }> = {
  submit: { label: '送审', color: 'blue' },
  return: { label: '退回补录', color: 'red' },
  approve: { label: '通过归档', color: 'green' },
};

/** 单次送审/审核动作，全部进入时间线留档 */
export interface ReviewAction {
  action: ReviewActionType;
  at: number;
  /** 操作人（调查员或审核人，手填并本地记忆） */
  actor: string;
  /** 送审说明或审核意见 */
  comment: string;
}

/** 送审时固化的当期资料：样地、样木、更新苗与灌木 */
export interface SubmissionSnapshot {
  plot: Plot;
  trees: TreeRecord[];
  regens: RegenShrub[];
}

/**
 * 送审记录：同一样地同一期次每送审一次产生一条（version 递增）。
 * 退回后重新送审会新增新版本，旧记录保留不删。
 */
export interface SubmissionRecord {
  id: string;
  plotId: string;
  /** 送审期次 */
  round: number;
  /** 同一样地同一期次内的版本号，从 1 开始 */
  version: number;
  status: SubmissionStatus;
  submitter: string;
  submitNote: string;
  submittedAt: number;
  /** 最近一次审核人 */
  reviewer?: string;
  /** 最近一次审核意见 */
  reviewComment?: string;
  reviewedAt?: number;
  /** 每次送审、退回、通过的完整留档 */
  history: ReviewAction[];
  snapshot: SubmissionSnapshot;
}

/** 同一样地同一期次的最新一条送审记录（版本号最大） */
export function latestSubmission(
  records: SubmissionRecord[],
  plotId: string,
  round: number,
): SubmissionRecord | undefined {
  return records
    .filter((r) => r.plotId === plotId && r.round === round)
    .sort((a, b) => b.version - a.version)[0];
}

/** 该状态下当期是否停改：待审核与已归档都不可改，只有退回后可继续补录 */
export function isFrozenStatus(status: SubmissionStatus | undefined): boolean {
  return status === 'submitted' || status === 'approved';
}

/** 某样地某期次当前是否停改 */
export function isRoundFrozen(records: SubmissionRecord[], plotId: string, round: number): boolean {
  return isFrozenStatus(latestSubmission(records, plotId, round)?.status);
}

/** 快照内分项计数，供台账与审核页展示 */
export function snapshotCounts(snapshot: SubmissionSnapshot): {
  trees: number;
  regenSeedlings: number;
  shrubs: number;
} {
  return {
    trees: snapshot.trees.length,
    regenSeedlings: snapshot.regens.filter((r) => r.layer === '更新苗').length,
    shrubs: snapshot.regens.filter((r) => r.layer === '灌木').length,
  };
}
