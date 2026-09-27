import { Alert, Input, Modal, Segmented, Space, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useSubmissionStore } from '../../stores/submissionStore';
import { snapshotCounts, type SubmissionRecord } from '../../types/submission';
import { usePlotStore } from '../../stores/plotStore';

const REVIEWER_KEY = 'gbforestplot:last-reviewer';

export interface ReviewDecisionModalProps {
  open: boolean;
  record?: SubmissionRecord;
  onClose: () => void;
  onReviewed?: (record: SubmissionRecord, decision: 'return' | 'approve') => void;
}

/** 审核弹窗：审核人写意见，退回补录或通过归档 */
export default function ReviewDecisionModal({ open, record, onClose, onReviewed }: ReviewDecisionModalProps) {
  const plots = usePlotStore((s) => s.items);
  const review = useSubmissionStore((s) => s.review);
  const [decision, setDecision] = useState<'return' | 'approve'>('return');
  const [reviewer, setReviewer] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDecision('return');
    setComment('');
    setError('');
    setReviewer(window.localStorage.getItem(REVIEWER_KEY) ?? '');
  }, [open, record?.id]);

  if (!record) return null;
  const plot = plots.find((p) => p.id === record.plotId);
  const counts = snapshotCounts(record.snapshot);

  const handleOk = async () => {
    if (!reviewer.trim()) {
      setError('请填写审核人');
      return;
    }
    if (decision === 'return' && !comment.trim()) {
      setError('退回补录必须写明问题，调查员才能按意见补录');
      return;
    }
    try {
      setSaving(true);
      await review(record.id, decision, reviewer, comment);
      window.localStorage.setItem(REVIEWER_KEY, reviewer.trim());
      onReviewed?.(record, decision);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '审核操作失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`审核 · ${plot?.plotNo ?? record.plotId} 第 ${record.round} 期 v${record.version}`}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={saving}
      okText={decision === 'return' ? '退回补录' : '通过归档'}
      okButtonProps={{ danger: decision === 'return', type: decision === 'return' ? 'primary' : 'primary' }}
      cancelText="取消"
      width={600}
      destroyOnClose
    >
      <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
        {error ? <Alert type="error" showIcon message={error} /> : null}
        <Alert
          type="info"
          showIcon
          message={`送审版本固化资料：样木 ${counts.trees} 株 · 更新苗 ${counts.regenSeedlings} 组 · 灌木 ${counts.shrubs} 组`}
          description={`送审人：${record.submitter}；送审时间：${new Date(record.submittedAt).toLocaleString('zh-CN')}；说明：${record.submitNote || '（无）'}`}
        />
        <Segmented
          value={decision}
          onChange={(v) => setDecision(v as 'return' | 'approve')}
          options={[
            { value: 'return', label: '退回继续补录（解冻当期）' },
            { value: 'approve', label: '通过归档（永久只读）' },
          ]}
        />
        {decision === 'return' ? (
          <Typography.Text type="secondary">
            <Tag color="red">退回</Tag>
            退回后调查员可继续修改第 {record.round} 期资料，并重新送审生成 v{record.version + 1}；本版记录与意见保留不删。
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">
            <Tag color="green">通过</Tag>
            归档后第 {record.round} 期资料永久停改，可在审核台账中随时回看各版本快照。
          </Typography.Text>
        )}
        <Input
          placeholder="审核人姓名（本地记忆，下次自动带出）"
          value={reviewer}
          onChange={(e) => setReviewer(e.target.value)}
        />
        <Input.TextArea
          rows={4}
          placeholder={decision === 'return' ? '审核意见：请写明需要补录/修改的问题（必填）' : '审核意见（通过时可简述或留空）'}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </Space>
    </Modal>
  );
}
