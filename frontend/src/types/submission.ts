import type { Plot } from './plot';
import type { TreeRecord } from './tree';
import type { RegenShrub } from './regen';

/** 送审单状态：待审核 →（退回补录）/（通过归档） */
export type SubmissionStatus = 'pending' | 'returned' | 'approved';

/** 留档动作：送审、退回、通过 */
export type ReviewAction = 'submit' | 'return' | 'approve';

/** 一次送审/审核动作（意见留档） */
export interface SubmissionReview {
  id: string;
  action: ReviewAction;
  /** 操作人（调查员 / 审核人） */
  actor: string;
  /** 意见说明（退回时必填） */
  comment: string;
  at: number;
}

/** 送审时冻结的数据快照：样地、当期样木、当期更新苗与灌木（含草本样方） */
export interface SubmissionSnapshot {
  plot: Plot;
  trees: TreeRecord[];
  regens: RegenShrub[];
}

/** 样地某期次的一次送审记录（同期次多次送审按 version 递增，旧记录不删除） */
export interface Submission {
  id: string;
  plotId: string;
  /** 冗余样地号，便于列表展示 */
  plotNo: string;
  /** 送审期次 */
  round: number;
  /** 同期次第几次送审（版本号，从 1 起） */
  version: number;
  status: SubmissionStatus;
  /** 送审说明 */
  note: string;
  submittedBy: string;
  submittedAt: number;
  /** 送审时点的完整记录快照 */
  snapshot: SubmissionSnapshot;
  /** 送审、退回、通过的完整意见流水（按时间顺序） */
  reviews: SubmissionReview[];
}

export type SubmissionDraft = Pick<Submission, 'plotId' | 'round' | 'submittedBy' | 'note'>;

export const SUBMISSION_STATUS_META: Record<
  SubmissionStatus,
  { label: string; color: 'processing' | 'error' | 'success' }
> = {
  pending: { label: '待审核', color: 'processing' },
  returned: { label: '已退回', color: 'error' },
  approved: { label: '已归档', color: 'success' },
};

export const REVIEW_ACTION_META: Record<ReviewAction, { label: string; color: string }> = {
  submit: { label: '送审', color: '#1677ff' },
  return: { label: '退回', color: '#cf1322' },
  approve: { label: '通过归档', color: '#389e0d' },
};

/** 最新一次送审是否处于停改状态（待审核或已归档均不可改） */
export function isSubmissionFrozen(submission: Submission | undefined): boolean {
  return !!submission && (submission.status === 'pending' || submission.status === 'approved');
}
