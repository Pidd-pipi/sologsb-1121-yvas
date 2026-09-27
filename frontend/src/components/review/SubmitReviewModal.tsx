import { useEffect, useMemo, useState } from 'react';
import { Alert, Input, Modal, Select, Space, Tag, Typography } from 'antd';
import { usePlotStore } from '../../stores/plotStore';
import { useTreeStore } from '../../stores/treeStore';
import { useRegenStore } from '../../stores/regenStore';
import { useSubmissionStore } from '../../stores/submissionStore';
import {
  REVIEW_ACTION_META,
  SUBMISSION_STATUS_META,
  type SubmissionRecord,
} from '../../types/submission';

const SUBMITTER_KEY = 'gbforestplot:last-submitter';

export interface SubmitReviewModalProps {
  open: boolean;
  /** 从样地卡片进入时预选样地；台账顶部「送审」入口可不传，由调查员自选 */
  presetPlotId?: string;
  onClose: () => void;
  onSubmitted?: (record: SubmissionRecord) => void;
}

/** 送审弹窗：选样地与期次，核对当期样地/样木/更新苗/灌木后送出，提交即冻结当期 */
export default function SubmitReviewModal({ open, presetPlotId, onClose, onSubmitted }: SubmitReviewModalProps) {
  const plots = usePlotStore((s) => s.items);
  const trees = useTreeStore((s) => s.items);
  const regens = useRegenStore((s) => s.items);
  const submit = useSubmissionStore((s) => s.submit);
  const latest = useSubmissionStore((s) => s.latest);

  const [plotId, setPlotId] = useState(presetPlotId ?? '');
  const [round, setRound] = useState<number | undefined>(undefined);
  const [submitter, setSubmitter] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // 每次打开重置为预选样地，并恢复上次填写的调查员
  useEffect(() => {
    if (!open) return;
    setPlotId(presetPlotId ?? plots[0]?.id ?? '');
    setRound(undefined);
    setNote('');
    setError('');
    setSubmitter(window.localStorage.getItem(SUBMITTER_KEY) ?? '');
  }, [open, presetPlotId, plots]);

  const plot = plots.find((p) => p.id === plotId);

  const roundOptions = useMemo(() => {
    if (!plotId) return [];
    const values = new Set<number>();
    trees.forEach((t) => t.plotId === plotId && values.add(t.round));
    regens.forEach((r) => r.plotId === plotId && values.add(r.round));
    const target = plots.find((p) => p.id === plotId);
    if (target) values.add(target.surveyRound);
    return Array.from(values).sort((a, b) => a - b);
  }, [plotId, plots, trees, regens]);

  useEffect(() => {
    if (round === undefined && roundOptions.length > 0) {
      setRound(roundOptions[roundOptions.length - 1]);
    }
  }, [roundOptions, round]);

  const current = plotId && round !== undefined ? latest(plotId, round) : undefined;
  const blocked = current?.status === 'submitted' || current?.status === 'approved';

  const liveCounts = useMemo(() => {
    if (!plotId || round === undefined) return { trees: 0, regenSeedlings: 0, shrubs: 0 };
    const roundTrees = trees.filter((t) => t.plotId === plotId && t.round === round);
    const roundRegens = regens.filter((r) => r.plotId === plotId && r.round === round);
    return {
      trees: roundTrees.length,
      regenSeedlings: roundRegens.filter((r) => r.layer === '更新苗').length,
      shrubs: roundRegens.filter((r) => r.layer === '灌木').length,
    };
  }, [plotId, round, trees, regens]);

  const hasContent = liveCounts.trees + liveCounts.regenSeedlings + liveCounts.shrubs > 0;

  const handleOk = async () => {
    if (!plot) {
      setError('请选择样地');
      return;
    }
    if (round === undefined) {
      setError('请选择送审期次');
      return;
    }
    if (!submitter.trim()) {
      setError('请填写送审调查员');
      return;
    }
    if (!hasContent) {
      setError(`第 ${round} 期暂无样木、更新苗或灌木记录，无法送审`);
      return;
    }
    if (blocked) return;
    try {
      setSaving(true);
      const record = await submit({ plot, round, submitter, note });
      window.localStorage.setItem(SUBMITTER_KEY, submitter.trim());
      onSubmitted?.(record);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '送审失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={presetPlotId ? `${plot?.plotNo ?? ''} 送审` : '样地资料送审'}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={saving}
      okText={current?.status === 'returned' ? '重新送审（生成新版本）' : '提交送审'}
      okButtonProps={{ disabled: blocked }}
      cancelText="取消"
      width={620}
      destroyOnClose
    >
      <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
        {error ? <Alert type="error" showIcon message={error} /> : null}

        <Space wrap size={10}>
          <span>
            样地{' '}
            <Select
              style={{ width: 260, marginLeft: 4 }}
              showSearch
              value={plotId || undefined}
              disabled={!!presetPlotId}
              placeholder="选择样地"
              optionFilterProp="label"
              onChange={setPlotId}
              options={plots.map((p) => ({ value: p.id, label: `${p.plotNo} · ${p.locality}` }))}
            />
          </span>
          <span>
            送审期次{' '}
            <Select
              style={{ width: 130, marginLeft: 4 }}
              value={round}
              onChange={setRound}
              options={roundOptions.map((r) => ({ value: r, label: `第 ${r} 期` }))}
            />
          </span>
        </Space>

        {plot && round !== undefined ? (
          <Alert
            type="info"
            showIcon
            message={`送审将固化「${plot.plotNo}」第 ${round} 期的全部资料：样地卡 1 份、样木 ${liveCounts.trees} 株、更新苗 ${liveCounts.regenSeedlings} 组、灌木 ${liveCounts.shrubs} 组（草本样方不随送审）`}
            description="提交后本期资料进入停改状态，直到审核人退回；历史送审版本会全部留档。"
          />
        ) : null}

        {current ? (
          <Alert
            type={current.status === 'approved' ? 'success' : current.status === 'submitted' ? 'warning' : 'error'}
            showIcon
            message={
              <Space wrap size={6}>
                <Tag color={SUBMISSION_STATUS_META[current.status].color}>
                  {SUBMISSION_STATUS_META[current.status].label} · v{current.version}
                </Tag>
                <span>
                  {current.status === 'returned'
                    ? '可补录后重新送审，系统将冻结新版本，本版记录保留。'
                    : current.status === 'approved'
                      ? '本期已通过归档，资料永久只读。'
                      : '本期已送审、正在审核，提交后已停改。'}
                </span>
              </Space>
            }
            description={
              <Space direction="vertical" size={2}>
                {current.reviewComment ? (
                  <Typography.Text>
                    最近审核意见（{current.reviewer}，{current.reviewedAt ? new Date(current.reviewedAt).toLocaleString('zh-CN') : ''}
                    ）：{current.reviewComment}
                  </Typography.Text>
                ) : (
                  <Typography.Text type="secondary">
                    送审说明：{current.submitNote || '（无）'} · 调查员 {current.submitter}
                  </Typography.Text>
                )}
                {current.history.length > 1 ? (
                  <Typography.Text type="secondary">
                    已留档 {current.history.length} 次操作（
                    {current.history.map((h) => REVIEW_ACTION_META[h.action].label).join(' → ')}）
                  </Typography.Text>
                ) : null}
              </Space>
            }
          />
        ) : (
          <Typography.Text type="secondary">该期次尚未送审过，本次为第 1 版。</Typography.Text>
        )}

        <Input
          placeholder="送审调查员姓名"
          value={submitter}
          onChange={(e) => setSubmitter(e.target.value)}
        />
        <Input.TextArea
          rows={3}
          placeholder="送审说明（选填）：本期完成情况、需要审核人关注的问题"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Space>
    </Modal>
  );
}
