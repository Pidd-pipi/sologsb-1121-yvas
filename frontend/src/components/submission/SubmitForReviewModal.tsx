import { useEffect, useMemo, useState } from 'react';
import { Alert, Input, Modal, Select, Space, Tag, Typography } from 'antd';
import { usePlotStore } from '../../stores/plotStore';
import { useTreeStore } from '../../stores/treeStore';
import { useRegenStore } from '../../stores/regenStore';
import { useSubmissionStore } from '../../stores/submissionStore';
import { SUBMISSION_STATUS_META } from '../../types/submission';

const SUBMITTER_KEY = 'gbforestplot:submitter';

export interface SubmitForReviewModalProps {
  open: boolean;
  defaultPlotId?: string;
  onClose: () => void;
  /** 送审成功后回调（可用于跳转/提示） */
  onSubmitted?: (plotId: string, round: number) => void;
}

/** 调查员送审：选样地与期次，冻结当期样地、样木、更新苗与灌木为一份记录送出 */
export default function SubmitForReviewModal({ open, defaultPlotId, onClose, onSubmitted }: SubmitForReviewModalProps) {
  const plots = usePlotStore((s) => s.items);
  const trees = useTreeStore((s) => s.items);
  const regens = useRegenStore((s) => s.items);
  const submit = useSubmissionStore((s) => s.submit);
  const latestOf = useSubmissionStore((s) => s.latest);

  const [plotId, setPlotId] = useState(defaultPlotId ?? '');
  const [round, setRound] = useState<number | undefined>(undefined);
  const [submitter, setSubmitter] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPlotId(defaultPlotId ?? plots[0]?.id ?? '');
      setRound(undefined);
      setNote('');
      setError('');
      setSaving(false);
      try {
        setSubmitter(window.localStorage.getItem(SUBMITTER_KEY) ?? '');
      } catch {
        setSubmitter('');
      }
    }
  }, [open, defaultPlotId, plots]);

  const plot = plots.find((p) => p.id === plotId);

  const roundOptions = useMemo(() => {
    if (!plotId) return [];
    const rounds = new Set<number>();
    trees.forEach((t) => t.plotId === plotId && rounds.add(t.round));
    regens.forEach((r) => r.plotId === plotId && rounds.add(r.round));
    rounds.add(plot?.surveyRound ?? 1);
    return Array.from(rounds).sort((a, b) => a - b);
  }, [plotId, plot?.surveyRound, trees, regens]);

  useEffect(() => {
    if (open && round === undefined && roundOptions.length > 0) {
      setRound(roundOptions[roundOptions.length - 1]);
    }
  }, [open, roundOptions, round]);

  const roundTrees = plotId && round !== undefined ? trees.filter((t) => t.plotId === plotId && t.round === round) : [];
  const roundRegens = plotId && round !== undefined ? regens.filter((r) => r.plotId === plotId && r.round === round) : [];
  const latest = plotId && round !== undefined ? latestOf(plotId, round) : undefined;
  const alreadyFrozen = latest?.status === 'pending' || latest?.status === 'approved';

  const doSubmit = async () => {
    if (!plotId) {
      setError('请选择样地');
      return;
    }
    if (round === undefined) {
      setError('请选择送审期次');
      return;
    }
    if (!submitter.trim()) {
      setError('请填写调查员姓名');
      return;
    }
    if (alreadyFrozen) {
      setError(
        latest?.status === 'pending'
          ? '该期次正在审核中，待审核结果退回后才能再次送审'
          : '该期次已审核归档，不能再次送审',
      );
      return;
    }
    if (roundTrees.length === 0 && roundRegens.length === 0) {
      setError('该期次尚无样木或更新苗/灌木记录，请先补录后再送审');
      return;
    }
    setSaving(true);
    try {
      await submit({ plotId, round, submittedBy: submitter.trim(), note });
      try {
        window.localStorage.setItem(SUBMITTER_KEY, submitter.trim());
      } catch {
        /* localStorage 不可用时忽略 */
      }
      onSubmitted?.(plotId, round);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '送审失败');
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="本期记录送审"
      onCancel={onClose}
      onOk={doSubmit}
      okText="提交送审（本期停改）"
      cancelText="取消"
      confirmLoading={saving}
      width={620}
      destroyOnClose
    >
      <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
        {error ? <Alert type="error" showIcon message={error} /> : null}
        <Space wrap size={10} style={{ width: '100%' }}>
          <span>
            样地{' '}
            <Select
              style={{ width: 260, marginLeft: 4 }}
              showSearch
              optionFilterProp="label"
              value={plotId || undefined}
              onChange={setPlotId}
              options={plots.map((p) => ({ value: p.id, label: `${p.plotNo} · ${p.locality}` }))}
              placeholder="选择样地"
            />
          </span>
          <span>
            期次{' '}
            <Select
              style={{ width: 130, marginLeft: 4 }}
              value={round}
              onChange={setRound}
              options={roundOptions.map((r) => ({ value: r, label: `第 ${r} 期` }))}
              placeholder="选择期次"
            />
          </span>
          <span>
            调查员{' '}
            <Input
              style={{ width: 150, marginLeft: 4 }}
              value={submitter}
              onChange={(e) => setSubmitter(e.target.value)}
              placeholder="送审人姓名"
            />
          </span>
        </Space>

        {plot && round !== undefined ? (
          <Alert
            type={alreadyFrozen ? 'warning' : 'info'}
            showIcon
            message={
              <Space size={8} wrap>
                <span>
                  本次将冻结 <b>{plot.plotNo}</b> 第 <b>{round}</b> 期当前记录：
                </span>
                <Tag color="green">样木 {roundTrees.length} 株</Tag>
                <Tag color="cyan">更新苗 {roundRegens.filter((r) => r.layer === '更新苗').length} 条</Tag>
                <Tag color="blue">灌木 {roundRegens.filter((r) => r.layer === '灌木').length} 条</Tag>
                <Tag>其他样方 {roundRegens.filter((r) => r.layer === '草本').length} 条</Tag>
              </Space>
            }
            description={
              latest ? (
                <Space size={6} wrap>
                  <span>
                    该期次已有 {latest.version} 个送审版本，当前最新版本状态：
                  </span>
                  <Tag color={SUBMISSION_STATUS_META[latest.status].color}>
                    {SUBMISSION_STATUS_META[latest.status].label}
                  </Tag>
                  <Typography.Text type="secondary">
                    {latest.status === 'returned'
                      ? '再次送审将生成新版本，旧版本与意见继续留档'
                      : latest.status === 'pending'
                        ? '请等待审核结果'
                        : '归档版本不可改动'}
                  </Typography.Text>
                </Space>
              ) : (
                '提交后该期次先停改，审核人可在「送审档案」中退回补录或通过归档。'
              )
            }
          />
        ) : null}

        <Input.TextArea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="送审说明（可选）：本期完成情况、需审核人重点关注的问题"
        />
      </Space>
    </Modal>
  );
}
