import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
  type TableProps,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileSearchOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { usePlotStore } from '../../stores/plotStore';
import { useSubmissionStore } from '../../stores/submissionStore';
import TreeTable from '../common/TreeTable';
import type { RegenShrub } from '../../types/regen';
import {
  REVIEW_ACTION_META,
  SUBMISSION_STATUS_META,
  type Submission,
  type SubmissionStatus,
} from '../../types/submission';

const REVIEWER_KEY = 'gbforestplot:reviewer';

type Filter = SubmissionStatus | 'all';

export interface ReviewArchiveDrawerProps {
  open: boolean;
  defaultPlotId?: string;
  onClose: () => void;
}

const STATUS_ICON: Record<SubmissionStatus, ReactNode> = {
  pending: <ClockCircleOutlined style={{ color: '#1677ff' }} />,
  returned: <CloseCircleOutlined style={{ color: '#cf1322' }} />,
  approved: <CheckCircleOutlined style={{ color: '#389e0d' }} />,
};

const regenColumns: NonNullable<TableProps<RegenShrub>['columns']> = [
  { title: '层位', dataIndex: 'layer', width: 90, render: (v: string) => <Tag color={v === '更新苗' ? 'green' : v === '灌木' ? 'blue' : 'default'}>{v}</Tag> },
  { title: '种类', dataIndex: 'species', width: 130 },
  { title: '高度 cm', dataIndex: 'heightCm', width: 90 },
  { title: '株数', dataIndex: 'count', width: 80 },
  { title: '苗龄组', dataIndex: 'ageGroup', width: 100 },
  { title: '分布', dataIndex: 'distribution', width: 80 },
  { title: '啃食情况', dataIndex: 'browseDamage', width: 100 },
];

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
}

/** 送审档案：查看每期各版本的冻结记录与意见，审核人写意见后退回补录或通过归档 */
export default function ReviewArchiveDrawer({ open, defaultPlotId, onClose }: ReviewArchiveDrawerProps) {
  const plots = usePlotStore((s) => s.items);
  const submissions = useSubmissionStore((s) => s.items);
  const returnBack = useSubmissionStore((s) => s.returnBack);
  const approve = useSubmissionStore((s) => s.approve);

  const [plotFilter, setPlotFilter] = useState<string>(defaultPlotId ?? 'all');
  const [statusFilter, setStatusFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [reviewer, setReviewer] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setPlotFilter(defaultPlotId ?? 'all');
      setError('');
      try {
        setReviewer(window.localStorage.getItem(REVIEWER_KEY) ?? '');
      } catch {
        setReviewer('');
      }
    }
  }, [open, defaultPlotId]);

  const list = useMemo(
    () =>
      submissions
        .filter((s) => plotFilter === 'all' || s.plotId === plotFilter)
        .filter((s) => statusFilter === 'all' || s.status === statusFilter)
        .sort((a, b) => b.submittedAt - a.submittedAt || b.version - a.version),
    [submissions, plotFilter, statusFilter],
  );

  const selected = submissions.find((s) => s.id === selectedId) ?? list.find((s) => s.status === 'pending');
  const pendingCount = submissions.filter((s) => s.status === 'pending').length;

  const doReview = async (action: 'return' | 'approve') => {
    if (!selected) return;
    if (!reviewer.trim()) {
      setError('请填写审核人姓名');
      return;
    }
    if (action === 'return' && !comment.trim()) {
      setError('退回时必须填写问题意见，调查员将据此补录');
      return;
    }
    setError('');
    try {
      const finalComment =
        comment.trim() || (action === 'approve' ? '审核通过，同意归档。' : '');
      if (action === 'return') {
        await returnBack(selected.id, reviewer.trim(), finalComment);
      } else {
        await approve(selected.id, reviewer.trim(), finalComment);
      }
      try {
        window.localStorage.setItem(REVIEWER_KEY, reviewer.trim());
      } catch {
        /* localStorage 不可用时忽略 */
      }
      setComment('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '审核操作失败');
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={1080}
      title={
        <Space>
          <FileSearchOutlined />
          <span>送审档案</span>
          <Badge count={pendingCount} showZero={false} color="#1677ff" overflowCount={99} />
        </Space>
      }
      destroyOnClose
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space wrap>
          <Select
            style={{ width: 300 }}
            value={plotFilter}
            onChange={setPlotFilter}
            showSearch
            optionFilterProp="label"
            options={[{ value: 'all', label: '全部样地' }, ...plots.map((p) => ({ value: p.id, label: `${p.plotNo} · ${p.locality}` }))]}
          />
          <Segmented<Filter>
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: `全部 ${submissions.length}` },
              { value: 'pending', label: `待审核 ${pendingCount}` },
              { value: 'returned', label: `已退回 ${submissions.filter((s) => s.status === 'returned').length}` },
              { value: 'approved', label: `已归档 ${submissions.filter((s) => s.status === 'approved').length}` },
            ]}
          />
        </Space>

        {list.length === 0 ? (
          <Empty description="暂无送审记录" style={{ marginTop: 60 }} />
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Card size="small" title="送审版本（每次送审一条，旧版本不删除）">
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                {list.map((s) => {
                  const meta = SUBMISSION_STATUS_META[s.status];
                  const active = selected?.id === s.id;
                  return (
                    <Card
                      key={s.id}
                      size="small"
                      hoverable
                      onClick={() => {
                        setSelectedId(s.id);
                        setError('');
                      }}
                      style={{ borderColor: active ? '#1677ff' : undefined, background: active ? '#f0f7ff' : undefined }}
                    >
                      <Space wrap size={8}>
                        {STATUS_ICON[s.status]}
                        <b>{s.plotNo}</b>
                        <Tag>第 {s.round} 期</Tag>
                        <Tag color="purple">v{s.version}</Tag>
                        <Tag color={meta.color}>{meta.label}</Tag>
                        <Typography.Text type="secondary">
                          {s.submittedBy} 送审于 {formatTime(s.submittedAt)}
                        </Typography.Text>
                        <Typography.Text type="secondary" ellipsis={{ tooltip: s.note }}>
                          {s.note ? `· ${s.note}` : ''}
                        </Typography.Text>
                      </Space>
                    </Card>
                  );
                })}
              </Space>
            </Card>

            {selected ? <SubmissionDetail submission={selected} /> : null}

            {selected ? (
              <Card
                size="small"
                title="审核意见"
                extra={
                  selected.status === 'pending' ? (
                    <Space>
                      <Input
                        style={{ width: 180 }}
                        placeholder="审核人姓名"
                        value={reviewer}
                        onChange={(e) => setReviewer(e.target.value)}
                      />
                      <Button danger icon={<RollbackOutlined />} onClick={() => doReview('return')}>
                        退回补录
                      </Button>
                      <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => doReview('approve')}>
                        通过归档
                      </Button>
                    </Space>
                  ) : (
                    <Tag color={SUBMISSION_STATUS_META[selected.status].color}>
                      该版本已{SUBMISSION_STATUS_META[selected.status].label === '已退回' ? '退回' : '归档'}，不可再处理
                    </Tag>
                  )
                }
              >
                {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 8 }} /> : null}
                <Input.TextArea
                  rows={2}
                  value={comment}
                  disabled={selected.status !== 'pending'}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    selected.status === 'pending'
                      ? '审核意见：退回时必填（如「3 号样木树高与胸径比例异常，请现场复核」）；通过时可留空'
                      : '该版本已结束审核'
                  }
                />
                <Timeline
                  style={{ marginTop: 14, marginBottom: 0 }}
                  items={selected.reviews.map((r) => ({
                    color: r.action === 'approve' ? 'green' : r.action === 'return' ? 'red' : 'blue',
                    children: (
                      <Space size={8} wrap>
                        <Tag color={REVIEW_ACTION_META[r.action].color === '#1677ff' ? 'blue' : r.action === 'return' ? 'red' : 'green'}>
                          {REVIEW_ACTION_META[r.action].label}
                        </Tag>
                        <b>{r.actor}</b>
                        <Typography.Text type="secondary">{formatTime(r.at)}</Typography.Text>
                        <Typography.Text>{r.comment}</Typography.Text>
                      </Space>
                    ),
                  }))}
                />
              </Card>
            ) : null}
          </Space>
        )}
      </Space>
    </Drawer>
  );
}

/** 送审版本详情：冻结时点的样地、样木、更新苗与灌木快照 */
function SubmissionDetail({ submission }: { submission: Submission }) {
  const { snapshot } = submission;
  const meta = SUBMISSION_STATUS_META[submission.status];
  return (
    <Card
      size="small"
      title={
        <Space wrap>
          <span>
            冻结记录 · {submission.plotNo} 第 {submission.round} 期 · v{submission.version}
          </span>
          <Tag color={meta.color}>{meta.label}</Tag>
        </Space>
      }
    >
      <Descriptions size="small" column={3} bordered style={{ marginBottom: 10 }}>
        <Descriptions.Item label="地点">{snapshot.plot.locality}</Descriptions.Item>
        <Descriptions.Item label="林型">{snapshot.plot.forestType}</Descriptions.Item>
        <Descriptions.Item label="面积">{snapshot.plot.area} m²</Descriptions.Item>
        <Descriptions.Item label="优势树种">{snapshot.plot.dominantSpecies}</Descriptions.Item>
        <Descriptions.Item label="郁闭度">{snapshot.plot.canopyDensity}</Descriptions.Item>
        <Descriptions.Item label="调查组">{snapshot.plot.crew}</Descriptions.Item>
      </Descriptions>

      <Typography.Text strong>
        样木快照（{snapshot.trees.length} 株，只读）
      </Typography.Text>
      <TreeTable items={snapshot.trees} showClassSummary={false} emptyText="本期无样木记录" />

      <Typography.Text strong style={{ display: 'block', margin: '10px 0 6px' }}>
        更新苗与灌木样方快照（{snapshot.regens.length} 条，只读）
      </Typography.Text>
      <Table<RegenShrub>
        rowKey="id"
        size="small"
        columns={regenColumns}
        dataSource={snapshot.regens}
        pagination={false}
        locale={{ emptyText: '本期无样方记录' }}
      />
    </Card>
  );
}
