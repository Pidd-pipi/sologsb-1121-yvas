import { useMemo, useState } from 'react';
import { Descriptions, Drawer, Empty, Select, Space, Table, Tabs, Tag, Timeline, Typography } from 'antd';
import type { TableProps } from 'antd';
import { usePlotStore } from '../../stores/plotStore';
import { useSubmissionStore } from '../../stores/submissionStore';
import {
  REVIEW_ACTION_META,
  SUBMISSION_STATUS_META,
  snapshotCounts,
  type SubmissionRecord,
} from '../../types/submission';
import type { TreeRecord } from '../../types/tree';
import type { RegenShrub } from '../../types/regen';
import { diameterClassLabel } from '../../utils/forestCalc';

export interface SubmissionDrawerProps {
  open: boolean;
  /** 打开时定位到的送审记录（其样地+期次下的所有版本都可切换） */
  record?: SubmissionRecord;
  onClose: () => void;
}

type TreeColumns = NonNullable<TableProps<TreeRecord>['columns']>;
type RegenColumns = NonNullable<TableProps<RegenShrub>['columns']>;

/** 送审详情：切换该期次历史版本，查看留档时间线与当期快照明细 */
export default function SubmissionDrawer({ open, record, onClose }: SubmissionDrawerProps) {
  const plots = usePlotStore((s) => s.items);
  const all = useSubmissionStore((s) => s.items);
  const [selectedId, setSelectedId] = useState<string | undefined>(record?.id);

  // 每次打开同步定位记录
  const currentId = open ? selectedId ?? record?.id : undefined;

  const versions = useMemo(() => {
    if (!record) return [];
    return all
      .filter((r) => r.plotId === record.plotId && r.round === record.round)
      .sort((a, b) => b.version - a.version);
  }, [all, record]);

  const current = versions.find((v) => v.id === currentId) ?? versions[0];
  const plot = plots.find((p) => p.id === record?.plotId);

  if (!record || !current) return null;
  const counts = snapshotCounts(current.snapshot);
  const snapPlot = current.snapshot.plot;

  const treeColumns: TreeColumns = [
    { title: '树号', dataIndex: 'treeNo', width: 70 },
    { title: '树种', dataIndex: 'species', width: 100 },
    {
      title: '径阶 cm',
      width: 100,
      render: (_: unknown, row: TreeRecord) => <Tag color="green">{diameterClassLabel(row.dbhCm)}</Tag>,
    },
    { title: '胸径 cm', dataIndex: 'dbhCm', width: 90 },
    { title: '树高 m', dataIndex: 'heightM', width: 90 },
    { title: '枝下高 m', dataIndex: 'underBranchH', width: 100 },
    { title: '冠幅 m', dataIndex: 'crownWidth', width: 90 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: string) => <Tag color={v === '活立木' ? 'green' : 'orange'}>{v}</Tag>,
    },
    { title: '起源', dataIndex: 'origin', width: 70 },
    { title: '健康', dataIndex: 'healthClass', width: 90 },
    { title: '位置', dataIndex: 'remark', ellipsis: true },
  ];

  const regenColumns: RegenColumns = [
    {
      title: '层位',
      dataIndex: 'layer',
      width: 90,
      render: (v: string) => <Tag color={v === '更新苗' ? 'green' : 'blue'}>{v}</Tag>,
    },
    { title: '种类', dataIndex: 'species', width: 120 },
    { title: '高度 cm', dataIndex: 'heightCm', width: 100 },
    { title: '株数', dataIndex: 'count', width: 80 },
    { title: '苗龄组', dataIndex: 'ageGroup', width: 100 },
    { title: '分布', dataIndex: 'distribution', width: 80 },
    { title: '啃食', dataIndex: 'browseDamage', width: 80 },
  ];

  return (
    <Drawer
      open={open}
      width={920}
      onClose={onClose}
      title={
        <Space wrap>
          <span>送审留档 · {snapPlot.plotNo} 第 {record.round} 期</span>
          <Tag color={SUBMISSION_STATUS_META[current.status].color}>
            {SUBMISSION_STATUS_META[current.status].label}
          </Tag>
        </Space>
      }
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <Space wrap>
          <span>
            历史版本{' '}
            <Select
              style={{ width: 200, marginLeft: 6 }}
              value={current.id}
              onChange={setSelectedId}
              options={versions.map((v) => ({
                value: v.id,
                label: `v${v.version} · ${SUBMISSION_STATUS_META[v.status].label}（${new Date(v.submittedAt).toLocaleDateString('zh-CN')}）`,
              }))}
            />
          </span>
          <Typography.Text type="secondary">共 {versions.length} 个版本，旧记录均保留可查</Typography.Text>
        </Space>

        <Descriptions size="small" bordered column={2}>
          <Descriptions.Item label="送审人">{current.submitter}</Descriptions.Item>
          <Descriptions.Item label="送审时间">
            {new Date(current.submittedAt).toLocaleString('zh-CN')}
          </Descriptions.Item>
          <Descriptions.Item label="送审说明" span={2}>
            {current.submitNote || '（无）'}
          </Descriptions.Item>
          <Descriptions.Item label="审核人">{current.reviewer ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="审核时间">
            {current.reviewedAt ? new Date(current.reviewedAt).toLocaleString('zh-CN') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="审核意见" span={2}>
            {current.reviewComment || '（暂无）'}
          </Descriptions.Item>
        </Descriptions>

        <Tabs
          items={[
            {
              key: 'timeline',
              label: `操作留档（${current.history.length}）`,
              children: (
                <Timeline
                  items={current.history
                    .slice()
                    .reverse()
                    .map((h) => ({
                      color: REVIEW_ACTION_META[h.action].color,
                      children: (
                        <Space direction="vertical" size={0}>
                          <Space size={8}>
                            <Tag color={REVIEW_ACTION_META[h.action].color}>{REVIEW_ACTION_META[h.action].label}</Tag>
                            <strong>{h.actor}</strong>
                            <Typography.Text type="secondary">
                              {new Date(h.at).toLocaleString('zh-CN')}
                            </Typography.Text>
                          </Space>
                          <Typography.Text>{h.comment || '（未填写意见）'}</Typography.Text>
                        </Space>
                      ),
                    }))}
                />
              ),
            },
            {
              key: 'snapshot',
              label: `当期快照（样木 ${counts.trees} · 苗 ${counts.regenSeedlings} · 灌木 ${counts.shrubs}）`,
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Descriptions size="small" bordered column={3} title="样地卡（送审时版本）">
                    <Descriptions.Item label="样地号">{snapPlot.plotNo}</Descriptions.Item>
                    <Descriptions.Item label="地点" span={2}>
                      {snapPlot.locality}
                    </Descriptions.Item>
                    <Descriptions.Item label="面积">{snapPlot.area} m²</Descriptions.Item>
                    <Descriptions.Item label="林型">{snapPlot.forestType}</Descriptions.Item>
                    <Descriptions.Item label="优势树种">{snapPlot.dominantSpecies}</Descriptions.Item>
                    <Descriptions.Item label="郁闭度">{snapPlot.canopyDensity}</Descriptions.Item>
                    <Descriptions.Item label="调查组" span={2}>
                      {snapPlot.crew}
                    </Descriptions.Item>
                  </Descriptions>
                  <div>
                    <Typography.Text strong>样木（{counts.trees} 株）</Typography.Text>
                    <Table<TreeRecord>
                      rowKey="id"
                      size="small"
                      columns={treeColumns}
                      dataSource={current.snapshot.trees}
                      pagination={false}
                      scroll={{ x: 980 }}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本期无样木" /> }}
                      style={{ marginTop: 8 }}
                    />
                  </div>
                  <div>
                    <Typography.Text strong>更新苗与灌木（{current.snapshot.regens.length} 组）</Typography.Text>
                    <Table<RegenShrub>
                      rowKey="id"
                      size="small"
                      columns={regenColumns}
                      dataSource={current.snapshot.regens}
                      pagination={false}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本期无更新苗/灌木记录" /> }}
                      style={{ marginTop: 8 }}
                    />
                  </div>
                </Space>
              ),
            },
          ]}
        />

        {plot ? null : (
          <Typography.Text type="warning">提示：该样地已从台账删除，但送审记录仍按规定保留。</Typography.Text>
        )}
      </Space>
    </Drawer>
  );
}
