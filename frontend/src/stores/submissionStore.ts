import { create } from 'zustand';
import { db } from '../utils/db';
import { newId } from '../utils/id';
import {
  isRoundFrozen,
  latestSubmission,
  type ReviewAction,
  type SubmissionRecord,
  type SubmissionSnapshot,
  type SubmissionStatus,
} from '../types/submission';
import type { Plot } from '../types/plot';

interface SubmissionState {
  items: SubmissionRecord[];
  loaded: boolean;
  load: () => Promise<void>;
  /** 取某样地某期次的最新送审记录 */
  latest: (plotId: string, round: number) => SubmissionRecord | undefined;
  /** 某期次是否处于停改状态（待审核 / 已归档） */
  frozen: (plotId: string, round: number) => boolean;
  /** 调查员送审：固化当期样地、样木、更新苗与灌木，创建新版本并冻结当期 */
  submit: (input: {
    plot: Plot;
    round: number;
    submitter: string;
    note: string;
  }) => Promise<SubmissionRecord>;
  /** 审核人写意见：退回补录（解冻）或通过归档（永久停改） */
  review: (
    id: string,
    decision: 'return' | 'approve',
    reviewer: string,
    comment: string,
  ) => Promise<void>;
  /** 样地下的全部送审记录（按版本降序） */
  byPlot: (plotId: string) => SubmissionRecord[];
}

export const useSubmissionStore = create<SubmissionState>((set, get) => ({
  items: [],
  loaded: false,

  async load() {
    const rows = await db.submissions.toArray();
    rows.sort((a, b) => b.submittedAt - a.submittedAt);
    set({ items: rows, loaded: true });
  },

  latest(plotId, round) {
    return latestSubmission(get().items, plotId, round);
  },

  frozen(plotId, round) {
    return isRoundFrozen(get().items, plotId, round);
  },

  async submit({ plot, round, submitter, note }) {
    const current = get().latest(plot.id, round);
    if (current && (current.status === 'submitted' || current.status === 'approved')) {
      throw new Error(
        current.status === 'submitted'
          ? `第 ${round} 期正在审核中，不能重复送审`
          : `第 ${round} 期已通过归档，不能再次送审`,
      );
    }

    // 在同一事务内读取当期数据并固化快照，避免送审瞬间数据变动
    const snapshot = await db.transaction('r', db.trees, db.regens, async (): Promise<SubmissionSnapshot> => {
      const [trees, regens] = await Promise.all([
        db.trees.where('plotId').equals(plot.id).toArray(),
        db.regens.where('plotId').equals(plot.id).toArray(),
      ]);
      const roundTrees = trees
        .filter((t) => t.round === round)
        .sort((a, b) => a.treeNo.localeCompare(b.treeNo, 'zh-Hans-CN', { numeric: true }));
      // 只归档更新苗与灌木，草本样方不在送审范围
      const roundRegens = regens.filter((r) => r.round === round && r.layer !== '草本');
      return {
        plot: structuredClone(plot),
        trees: structuredClone(roundTrees),
        regens: structuredClone(roundRegens),
      };
    });

    const now = Date.now();
    const action: ReviewAction = { action: 'submit', at: now, actor: submitter.trim(), comment: note.trim() };
    const record: SubmissionRecord = {
      id: newId('sub'),
      plotId: plot.id,
      round,
      version: (current?.version ?? 0) + 1,
      status: 'submitted',
      submitter: submitter.trim(),
      submitNote: note.trim(),
      submittedAt: now,
      history: [action],
      snapshot,
    };
    await db.submissions.put(record);
    set({ items: [record, ...get().items] });
    return record;
  },

  async review(id, decision, reviewer, comment) {
    const target = get().items.find((it) => it.id === id);
    if (!target) throw new Error('送审记录不存在');
    if (target.status !== 'submitted') throw new Error('该记录已审核，不能重复操作');

    const now = Date.now();
    const status: SubmissionStatus = decision === 'return' ? 'returned' : 'approved';
    const action: ReviewAction = { action: decision, at: now, actor: reviewer.trim(), comment: comment.trim() };
    const patch: Partial<SubmissionRecord> = {
      status,
      reviewer: reviewer.trim(),
      reviewComment: comment.trim(),
      reviewedAt: now,
      history: [...target.history, action],
    };
    await db.submissions.update(id, patch);
    set({
      items: get().items.map((it) => (it.id === id ? ({ ...it, ...patch } as SubmissionRecord) : it)),
    });
  },

  byPlot(plotId) {
    return get()
      .items.filter((it) => it.plotId === plotId)
      .sort((a, b) => b.submittedAt - a.submittedAt);
  },
}));
