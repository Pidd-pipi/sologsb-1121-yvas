import { useSubmissionStore } from '../stores/submissionStore';
import { isSubmissionFrozen, type Submission } from '../types/submission';

export interface RoundFreeze {
  /** 该期次最新一次送审记录（可能为 undefined：从未送审） */
  latest: Submission | undefined;
  /** 是否停改（最新记录待审核或已归档） */
  frozen: boolean;
}

/**
 * 某样地某期次的停改状态：
 * - 最新送审「待审核 / 已归档」→ frozen，当期记录不可改
 * - 「已退回」或从未送审 → 可继续补录；再次送审只新增版本，旧记录保留
 */
export function useRoundFreeze(plotId: string | undefined, round: number): RoundFreeze {
  const latest = useSubmissionStore((s) =>
    plotId ? s.items.filter((it) => it.plotId === plotId && it.round === round).sort((a, b) => b.version - a.version)[0] : undefined,
  );
  return { latest, frozen: isSubmissionFrozen(latest) };
}
