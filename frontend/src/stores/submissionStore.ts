import { create } from 'zustand';
import { db } from '../utils/db';
import { newId } from '../utils/id';
import type { TreeRecord } from '../types/tree';
import type { RegenShrub } from '../types/regen';
import type { Submission, SubmissionDraft, SubmissionStatus } from '../types/submission';

interface SubmissionState {
  items: Submission[];
  loaded: boolean;
  load: () => Promise<void>;
  /** 调查员送审：冻结当期样地、样木、更新苗与灌木的完整记录为新版本 */
  submit: (draft: SubmissionDraft) => Promise<Submission>;
  /** 审核退回：本期恢复补录 */
  returnBack: (id: string, reviewer: string, comment: string) => Promise<void>;
  /** 审核通过：归档（永久停改） */
  approve: (id: string, reviewer: string, comment: string) => Promise<void>;
  /** 某样地某期次的最新一次送审记录（决定当前是否停改） */
  latest: (plotId: string, round: number) => Submission | undefined;
  byPlot: (plotId: string) => Submission[];
}

export const useSubmissionStore = create<SubmissionState>((set, get) => ({
  items: [],
  loaded: false,
  async load() {
    const rows = await db.submissions.orderBy('submittedAt').reverse().toArray();
    set({ items: rows, loaded: true });
  },
  async submit({ plotId, round, submittedBy, note }) {
    // 直接从库里取最新数据冻结，避免 store 尚未同步
    const plot = await db.plots.get(plotId);
    if (!plot) throw new Error('样地不存在，无法送审');
    const [trees, regens, sameRound] = await Promise.all([
      db.trees.where({ plotId, round }).toArray(),
      db.regens.where({ plotId, round }).toArray(),
      db.submissions.where({ plotId, round }).toArray(),
    ]);

    const latest = [...sameRound].sort((a, b) => b.version - a.version)[0];
    if (latest && (latest.status === 'pending' || latest.status === 'approved')) {
      throw new Error(`第 ${round} 期当前${latest.status === 'pending' ? '正在审核中' : '已归档'}，不能再次送审`);
    }

    const now = Date.now();
    const record: Submission = {
      id: newId('sub'),
      plotId,
      plotNo: plot.plotNo,
      round,
      version: (latest?.version ?? 0) + 1,
      status: 'pending',
      note: note.trim(),
      submittedBy: submittedBy.trim(),
      submittedAt: now,
      snapshot: {
        plot: structuredClone(plot),
        trees: structuredClone(trees) as TreeRecord[],
        regens: structuredClone(regens) as RegenShrub[],
      },
      reviews: [
        {
          id: newId('rev'),
          action: 'submit',
          actor: submittedBy.trim() || '调查员',
          comment: note.trim() || '提交本期调查记录，请审核。',
          at: now,
        },
      ],
    };
    await db.submissions.put(record);
    set({ items: [record, ...get().items] });
    return record;
  },
  async returnBack(id, reviewer, comment) {
    if (!comment.trim()) throw new Error('退回时必须填写问题意见，调查员将据此补录');
    await reviewInState(id, 'returned', reviewer, comment);
  },
  async approve(id, reviewer, comment) {
    await reviewInState(id, 'approved', reviewer, comment);
  },
  latest(plotId, round) {
    return get()
      .items.filter((it) => it.plotId === plotId && it.round === round)
      .sort((a, b) => b.version - a.version)[0];
  },
  byPlot(plotId) {
    return get()
      .items.filter((it) => it.plotId === plotId)
      .sort((a, b) => b.submittedAt - a.submittedAt || b.version - a.version);
  },
}));

/** 给待审核送审单追加审核意见并更新状态（退回/通过共用） */
async function reviewInState(
  id: string,
  status: SubmissionStatus,
  reviewer: string,
  comment: string,
): Promise<void> {
  const target = useSubmissionStore.getState().items.find((it) => it.id === id);
  if (!target) throw new Error('送审记录不存在');
  if (target.status !== 'pending') throw new Error('只有待审核的记录可以处理');
  const patch: Partial<Submission> = {
    status,
    reviews: [
      ...target.reviews,
      {
        id: newId('rev'),
        action: status === 'approved' ? 'approve' : 'return',
        actor: reviewer.trim() || '审核人',
        comment: comment.trim(),
        at: Date.now(),
      },
    ],
  };
  await db.submissions.update(id, patch);
  useSubmissionStore.setState({
    items: useSubmissionStore.getState().items.map((it) => (it.id === id ? ({ ...it, ...patch } as Submission) : it)),
  });
}
