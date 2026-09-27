import { Tag } from 'antd';

export interface RoundTagProps {
  round: number;
  /** 往期手动锁定（仅展示） */
  locked?: boolean;
  /** 当期因送审停改（待审核 / 已归档） */
  frozen?: boolean;
  /** 停改原因角标文案，默认按状态推导 */
  frozenText?: string;
}

/** 复查期次角标，被样地台账、复查比对页消费 */
export default function RoundTag({ round, locked = false, frozen = false, frozenText }: RoundTagProps) {
  const suffix = frozen ? frozenText ?? ' · 送审停改' : locked ? ' · 已锁定' : '';
  return (
    <Tag
      color={frozen ? 'volcano' : round > 1 ? 'geekblue' : 'default'}
      data-testid={`round-tag-${round}`}
    >
      第 {round} 期{suffix}
    </Tag>
  );
}
