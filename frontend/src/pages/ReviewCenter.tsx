import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tabs,
  Typography,
  type TableProps,
} from 'antd';
import { AuditOutlined, CheckCircleOutlined, HistoryOutlined, RollbackOutlined } from '@ant-design/icons';
import { usePlotStore } from '../stores/plotStore';
import { useSubmissionStore } from '../stores/submissionStore';
import {
  SUBMISSION_STATUS_META,
  snapshotCounts,
  type SubmissionRecord,
} from '../types/submission';
import ReviewDecisionModal from '../components/review/ReviewDecisionModal';
import SubmissionDrawer from '../components/review/SubmissionDrawer';

type Columns = NonNullable<TableProps<SubmissionRecord>['columns']>;

/** /reviews 送审审核：待审核队列、全部留档，可写意见退回或通过 */
export default function ReviewCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const plots = usePlotStore((s) => s.items);
  const records = useSubmissionStore((s) => s.items);

  // 台账卡片「送审记录」可带 plotId / round 跳转定位
  const [plotFilter, setPlotFilter] = useState<string>(searchParams.get('plotId') ?? 'all');
  const [keyword, setKeyword] = useState('');
  const [tab, setTab] = useState(searchParams.get('plotId') ? 'all' : 'pending');
  const [decisionTarget, setDecisionTarget] = useState<SubmissionRecord | undefined>();
  const [detail, setDetail] = useState<SubmissionRecord | undefined>();
  const [toast, setToast] = useState('');

  const plotMap = useMemo(() => new Map(plots.map((p) => [p.id, p])), [plots]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return records.filter((r) => {
      if (plotFilter !== 'all' && r.plotId !== plotFilter) return false;
      if (kw) {
        const plot = plotMap.get(r.plotId);
        const hay = [
          plot?.plotNo ?? '',
          plot?.locality ?? '',
          r.submitter,
          r.reviewer ?? '',
          r.submitNote,
          r.reviewComment ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [records, plotFilter, keyword, plotMap]);

  const pending = filtered.filter((r) => r.status === 'submitted');
  const returned = filtered.filter((r) => r.status === 'returned');
  const approved = filtered.filter((r) => r.status === 'approved');

  const columns: Columns = [
    {
      title: '样地',
      width: 200,
      render: (_: unknown, r: SubmissionRecord) => {
        const plot = plotMap.get(r.plotId);
        return (
          <Space direction="vertical" size={0}>
            <strong>{plot?.plotNo ?? '(样地已删)'}</strong>
            <Typography.Text type="secondary" ellipsis style={{ maxWidth: 180 }}>
              {plot?.locality ?? r.plotId}
            </Typography.Text>
          </Space>
        );
      },
    },
    {
      title: '期次 / 版本',
      width: 110,
      render: (_: unknown, r: SubmissionRecord) => (
        <Space size={4}>
          <Tag>第 {r.round} 期</Tag>
          <Tag color={r.version > 1 ? 'gold' : 'default'}>v{r.version}</Tag>
        </Space>
      ),
    },
    {
      title: '送审资料',
      width: 200,
      render: (_: unknown, r: SubmissionRecord) => {
        const c = snapshotCounts(r.snapshot);
        return (
          <Typography.Text type="secondary">
            样木 {c.trees} 株 · 更新苗 {c.regenSeedlings} · 灌木 {c.shrubs}
          </Typography.Text>
        );
      },
    },
    {
      title: '送审人 / 时间',
      width: 180,
      render: (_: unknown, r: SubmissionRecord) => (
        <Space direction="vertical" size={0}>
          <span>{r.submitter}</span>
          <Typography.Text type="secondary">{new Date(r.submittedAt).toLocaleString('zh-CN')}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '最近意见',
      render: (_: unknown, r: SubmissionRecord) => (
        <Typography.Paragraph
          style={{ margin: 0 }}
          ellipsis={{ rows: 2, tooltip: r.reviewComment || r.submitNote }}
        >
          {r.reviewComment ? (
            <>
              <Tag color={r.status === 'approved' ? 'green' : 'red'}>
                {r.status === 'approved' ? '通过意见' : '退回意见'}
              </Tag>
              {r.reviewComment}
            </>
          ) : (
            <Typography.Text type="secondary">{r.submitNote || '（送审未附说明）'}</Typography.Text>
          )}
        </Typography.Paragraph>
      ),
    },
    {
      title: '状态',
      width: 100,
      render: (_: unknown, r: SubmissionRecord) => (
        <Tag color={SUBMISSION_STATUS_META[r.status].color}>{SUBMISSION_STATUS_META[r.status].label}</Tag>
      ),
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_: unknown, r: SubmissionRecord) => (
        <Space size={4}>
          {r.status === 'submitted' ? (
            <Button
              size="small"
              type="primary"
              icon={<AuditOutlined />}
              onClick={() => setDecisionTarget(r)}
            >
              审核
            </Button>
          ) : (
            <Button size="small" type="link" icon={<AuditOutlined />} onClick={() => setDecisionTarget(r)} disabled>
              {r.status === 'approved' ? '已归档' : '已退回'}
            </Button>
          )}
          <Button size="small" type="link" onClick={() => setDetail(r)}>
            留档
          </Button>
        </Space>
      ),
    },
  ];

  const tableFor = (rows: SubmissionRecord[], emptyText: string) => (
    <Table<SubmissionRecord>
      rowKey="id"
      size="small"
      columns={columns}
      dataSource={rows}
      pagination={{ pageSize: 8, showSizeChanger: false }}
      scroll={{ x: 1100 }}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} /> }}
    />
  );

  return (
    <Space direction="vertical" size={14} style={{ width: '100%' }}>
      <Space wrap align="center">
        <Typography.Title level={4} style={{ margin: 0 }}>
          送审审核
        </Typography.Title>
        <Tag color="blue">送审记录 {records.length} 条</Tag>
        <Tag color="processing">待审核 {records.filter((r) => r.status === 'submitted').length} 条</Tag>
      </Space>

      {toast ? <Alert type="success" showIcon message={toast} closable onClose={() => setToast('')} /> : null}

      <Row gutter={12}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="待审核"
              value={records.filter((r) => r.status === 'submitted').length}
              suffix="条"
              prefix={<AuditOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已退回补录"
              value={records.filter((r) => r.status === 'returned').length}
              suffix="条"
              prefix={<RollbackOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已通过归档"
              value={records.filter((r) => r.status === 'approved').length}
              suffix="条"
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="历史版本总数"
              value={records.reduce((s, r) => s + r.version, 0)}
              suffix="版"
              prefix={<HistoryOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small">
        <Space wrap size={12}>
          <Select
            style={{ width: 280 }}
            showSearch
            value={plotFilter}
            optionFilterProp="label"
            onChange={(v) => {
              setPlotFilter(v);
              if (v === 'all') setSearchParams({});
              else setSearchParams({ plotId: v });
            }}
            options={[
              { value: 'all', label: '全部样地' },
              ...plots.map((p) => ({ value: p.id, label: `${p.plotNo} · ${p.locality}` })),
            ]}
          />
          <Input.Search
            allowClear
            style={{ width: 280 }}
            placeholder="搜样地号 / 送审人 / 审核意见"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </Space>
      </Card>

      <Card size="small">
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: 'pending',
              label: `待审核（${pending.length}）`,
              children: tableFor(pending, '没有待审核的送审记录'),
            },
            {
              key: 'returned',
              label: `已退回（${returned.length}）`,
              children: tableFor(returned, '暂无退回记录'),
            },
            {
              key: 'approved',
              label: `已归档（${approved.length}）`,
              children: tableFor(approved, '暂无归档记录'),
            },
            {
              key: 'all',
              label: `全部留档（${filtered.length}）`,
              children: tableFor(filtered, '暂无送审记录'),
            },
          ]}
        />
      </Card>

      <ReviewDecisionModal
        open={!!decisionTarget}
        record={decisionTarget}
        onClose={() => setDecisionTarget(undefined)}
        onReviewed={(r, decision) =>
          setToast(
            decision === 'return'
              ? `已退回第 ${r.round} 期 v${r.version}，调查员可继续补录后重新送审`
              : `第 ${r.round} 期 v${r.version} 已通过归档，资料永久停改`,
          )
        }
      />
      <SubmissionDrawer key={detail?.id ?? 'none'} open={!!detail} record={detail} onClose={() => setDetail(undefined)} />
    </Space>
  );
}
