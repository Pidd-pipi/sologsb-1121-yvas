import { Tag } from 'antd';
import { SUBMISSION_STATUS_META, type SubmissionRecord } from '../../types/submission';

export interface ReviewTagProps {
  /** 该期次最新一条送审记录；没有则不渲染 */
  record?: SubmissionRecord;
  /** 是否显示版本号，默认显示 */
  showVersion?: boolean;
}

/** 期次送审状态角标：待审核 / 已退回 / 已归档，附版本号 */
export default function ReviewTag({ record, showVersion = true }: ReviewTagProps) {
  if (!record) return null;
  const meta = SUBMISSION_STATUS_META[record.status];
  return (
    <Tag color={meta.color} data-testid={`review-tag-${record.round}-${record.status}`}>
      {meta.label}
      {showVersion ? ` · v${record.version}` : ''}
    </Tag>
  );
}
