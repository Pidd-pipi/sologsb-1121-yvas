import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Input,
  InputNumber,
  Modal,
  Row,
  Segmented,
  Select,
  Slider,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { PlusOutlined, ReloadOutlined, SendOutlined, FileSearchOutlined } from '@ant-design/icons';
import { usePlotStore } from '../stores/plotStore';
import { useTreeStore } from '../stores/treeStore';
import { useRegenStore } from '../stores/regenStore';
import { useSubmissionStore } from '../stores/submissionStore';
import { usePlotFilter } from '../hooks/usePlotFilter';
import PlotCard from '../components/common/PlotCard';
import SubmitForReviewModal from '../components/submission/SubmitForReviewModal';
import ReviewArchiveDrawer from '../components/submission/ReviewArchiveDrawer';
import { isSubmissionFrozen, SUBMISSION_STATUS_META } from '../types/submission';
import { FOREST_TYPES, PLOT_SHAPES, type PlotDraft, type PlotShape } from '../types/plot';

const EMPTY: PlotDraft = {
  plotNo: '',
  locality: '',
  lng: 128.9,
  lat: 47.18,
  shape: '方形',
  area: 600,
  elevation: 400,
  slope: 8,
  aspect: '东南',
  forestType: '针阔混交林',
  canopyDensity: 0.7,
  dominantSpecies: '',
  surveyRound: 1,
  surveyedAt: Date.now(),
  crew: '',
  locked: false,
};

/** /plots 样地台账：按地点/林型/复查期次筛选，显示面积、优势树种与已录样木数 */
export default function PlotList() {
  const navigate = useNavigate();
  const plots = usePlotStore((s) => s.items);
  const addPlot = usePlotStore((s) => s.add);
  const toggleLock = usePlotStore((s) => s.toggleLock);
  const trees = useTreeStore((s) => s.items);
  const regens = useRegenStore((s) => s.items);
  const submissions = useSubmissionStore((s) => s.items);
  const { filters, patch, reset, result, options } = usePlotFilter();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PlotDraft>(EMPTY);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitPlotId, setSubmitPlotId] = useState<string | undefined>(undefined);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivePlotId, setArchivePlotId] = useState<string | undefined>(undefined);

  /** 样地当期次的最新送审版本 */
  const latestOf = (plotId: string, round: number) =>
    submissions
      .filter((s) => s.plotId === plotId && s.round === round)
      .sort((a, b) => b.version - a.version)[0];

  const pendingCount = submissions.filter((s) => s.status === 'pending').length;

  const openSubmit = (plotId?: string) => {
    setSubmitPlotId(plotId);
    setSubmitOpen(true);
  };
  const openArchive = (plotId?: string) => {
    setArchivePlotId(plotId);
    setArchiveOpen(true);
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const totalTrees = trees.length;
  const avgCanopy = useMemo(() => {
    if (plots.length === 0) return 0;
    return Math.round((plots.reduce((s, p) => s + p.canopyDensity, 0) / plots.length) * 100) / 100;
  }, [plots]);

  const submit = async () => {
    if (!draft.plotNo.trim()) {
      setError('样地号必填');
      return;
    }
    if (plots.some((p) => p.plotNo === draft.plotNo.trim())) {
      setError('样地号已存在，请更换');
      return;
    }
    if (draft.canopyDensity < 0 || draft.canopyDensity > 1) {
      setError('郁闭度需在 0 ~ 1 之间');
      return;
    }
    const created = await addPlot({ ...draft, plotNo: draft.plotNo.trim(), surveyedAt: Date.now() });
    setOpen(false);
    setDraft(EMPTY);
    setError('');
    setToast(`已建立样地「${created.plotNo}」`);
  };

  return (
    <Space direction="vertical" size={14} style={{ width: '100%' }}>
      <Space wrap align="center">
        <Typography.Title level={4} style={{ margin: 0 }}>
          样地台账
        </Typography.Title>
        <Tag>共 {plots.length} 个样地</Tag>
        <Tag color="blue">筛选命中 {result.length} 个</Tag>
        <div style={{ flex: 1 }} />
        <Tooltip title="查看每期送审版本与审核意见；审核人可退回补录或通过归档">
          <Badge count={pendingCount} showZero={false} size="small" color="#1677ff">
            <Button icon={<FileSearchOutlined />} onClick={() => openArchive()}>
              送审档案
            </Button>
          </Badge>
        </Tooltip>
        <Button icon={<SendOutlined />} onClick={() => openSubmit()}>
          本期送审
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          新建样地
        </Button>
      </Space>

      {toast ? <Alert type="success" showIcon message={toast} closable onClose={() => setToast('')} /> : null}

      <Row gutter={12}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="样地总数" value={plots.length} suffix="个" />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="样木记录" value={totalTrees} suffix="株" />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="更新与灌木记录" value={regens.length} suffix="条" />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="平均郁闭度" value={avgCanopy} precision={2} />
          </Card>
        </Col>
      </Row>

      <Card size="small">
        <Space wrap size={12}>
          <Input
            allowClear
            style={{ width: 220 }}
            placeholder="样地号 / 地点 / 优势树种"
            value={filters.keyword}
            onChange={(e) => patch({ keyword: e.target.value })}
          />
          <Select
            style={{ width: 220 }}
            value={filters.locality}
            onChange={(v) => patch({ locality: v })}
            options={[{ value: 'all', label: '全部地点' }, ...options.localities.map((v) => ({ value: v, label: v }))]}
          />
          <Select
            style={{ width: 160 }}
            value={filters.forestType}
            onChange={(v) => patch({ forestType: v })}
            options={[{ value: 'all', label: '全部林型' }, ...FOREST_TYPES.map((v) => ({ value: v, label: v }))]}
          />
          <Select
            style={{ width: 150 }}
            value={filters.round}
            onChange={(v) => patch({ round: v as number | 'all' })}
            options={[
              { value: 'all', label: '全部期次' },
              ...options.rounds.map((r) => ({ value: r, label: `第 ${r} 期` })),
            ]}
          />
          <Space size={4}>
            <Typography.Text type="secondary">郁闭度</Typography.Text>
            <Slider
              range
              min={0}
              max={1}
              step={0.05}
              style={{ width: 160 }}
              value={[filters.canopyMin, filters.canopyMax]}
              onChange={(v) => {
                if (Array.isArray(v)) patch({ canopyMin: v[0], canopyMax: v[1] });
              }}
            />
            <Typography.Text type="secondary">
              {filters.canopyMin} ~ {filters.canopyMax}
            </Typography.Text>
          </Space>
          <Segmented
            value={filters.sortBy}
            onChange={(v) => patch({ sortBy: v as typeof filters.sortBy })}
            options={[
              { value: 'createdAt', label: '按建档时间' },
              { value: 'plotNo', label: '按样地号' },
              { value: 'area', label: '按面积' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={reset}>
            重置
          </Button>
        </Space>
      </Card>

      {result.length === 0 ? (
        <Empty description="没有符合条件的样地" />
      ) : (
        <Row gutter={[12, 12]}>
          {result.map((plot) => {
            const latest = latestOf(plot.id, plot.surveyRound);
            const frozen = isSubmissionFrozen(latest);
            return (
              <Col key={plot.id} xs={24} md={12} xl={8}>
                <PlotCard
                  plot={plot}
                  treeCount={trees.filter((t) => t.plotId === plot.id && t.round === plot.surveyRound).length}
                  frozen={frozen}
                  frozenText={latest?.status === 'approved' ? ' · 已归档' : ' · 送审停改'}
                  footer={
                    <Space wrap size={4}>
                      <Button size="small" type="link" onClick={() => navigate(`/plots/${plot.id}/trees`)}>
                        样木录入
                      </Button>
                      <Button size="small" type="link" onClick={() => navigate(`/plots/${plot.id}/regen`)}>
                        更新与灌木
                      </Button>
                      <Button size="small" type="link" onClick={() => navigate(`/plots/${plot.id}/recheck`)}>
                        复查比对
                      </Button>
                      <Button size="small" type="link" onClick={() => navigate(`/summary/${plot.id}`)}>
                        林分汇总
                      </Button>
                      <Tooltip
                        title={
                          latest?.status === 'pending'
                            ? '该期正在审核中，退回后方可补录'
                            : latest?.status === 'approved'
                              ? '该期已审核归档'
                              : latest?.status === 'returned'
                                ? `上一版本 v${latest.version} 已退回，补录后可再次送审（旧版本保留）`
                                : '整理当期记录并提交审核，提交后本期停改'
                        }
                      >
                        <Button
                          size="small"
                          type="link"
                          disabled={frozen}
                          icon={<SendOutlined />}
                          onClick={() => openSubmit(plot.id)}
                        >
                          {latest?.status === 'returned' ? '再次送审' : '送审'}
                        </Button>
                      </Tooltip>
                      <Button size="small" type="link" onClick={() => openArchive(plot.id)}>
                        送审档案
                        {latest ? (
                          <Tag
                            color={SUBMISSION_STATUS_META[latest.status].color}
                            style={{ marginInlineStart: 4, marginInlineEnd: 0 }}
                          >
                            v{latest.version} {SUBMISSION_STATUS_META[latest.status].label}
                          </Tag>
                        ) : null}
                      </Button>
                      <Button size="small" danger={!plot.locked} onClick={() => toggleLock(plot.id)}>
                        {plot.locked ? '解锁往期' : '锁定往期'}
                      </Button>
                    </Space>
                  }
                />
              </Col>
            );
          })}
        </Row>
      )}

      <Modal
        open={open}
        title="新建固定样地"
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="保存样地"
        width={680}
      >
        <Space direction="vertical" size={10} style={{ width: '100%', marginTop: 8 }}>
          {error ? <Alert type="error" message={error} showIcon /> : null}
          <Space wrap size={10}>
            <Input
              style={{ width: 200 }}
              placeholder="样地号，如 FP-4201"
              value={draft.plotNo}
              onChange={(e) => setDraft({ ...draft, plotNo: e.target.value })}
            />
            <Input
              style={{ width: 260 }}
              placeholder="地点"
              value={draft.locality}
              onChange={(e) => setDraft({ ...draft, locality: e.target.value })}
            />
            <Select
              style={{ width: 120 }}
              value={draft.shape}
              onChange={(v) => setDraft({ ...draft, shape: v as PlotShape })}
              options={PLOT_SHAPES.map((s) => ({ value: s, label: s }))}
            />
          </Space>
          <Space wrap size={10}>
            <span>
              经度 <InputNumber value={draft.lng} step={0.0001} onChange={(v) => setDraft({ ...draft, lng: Number(v) })} />
            </span>
            <span>
              纬度 <InputNumber value={draft.lat} step={0.0001} onChange={(v) => setDraft({ ...draft, lat: Number(v) })} />
            </span>
            <span>
              面积 m² <InputNumber min={1} value={draft.area} onChange={(v) => setDraft({ ...draft, area: Number(v) })} />
            </span>
          </Space>
          <Space wrap size={10}>
            <span>
              海拔 m <InputNumber value={draft.elevation} onChange={(v) => setDraft({ ...draft, elevation: Number(v) })} />
            </span>
            <span>
              坡度 ° <InputNumber min={0} max={60} value={draft.slope} onChange={(v) => setDraft({ ...draft, slope: Number(v) })} />
            </span>
            <Input
              style={{ width: 120 }}
              placeholder="坡向"
              value={draft.aspect}
              onChange={(e) => setDraft({ ...draft, aspect: e.target.value })}
            />
          </Space>
          <Space wrap size={10}>
            <Select
              style={{ width: 160 }}
              value={draft.forestType}
              onChange={(v) => setDraft({ ...draft, forestType: v })}
              options={FOREST_TYPES.map((s) => ({ value: s, label: s }))}
            />
            <Input
              style={{ width: 200 }}
              placeholder="优势树种"
              value={draft.dominantSpecies}
              onChange={(e) => setDraft({ ...draft, dominantSpecies: e.target.value })}
            />
            <span>
              复查期次{' '}
              <InputNumber min={1} value={draft.surveyRound} onChange={(v) => setDraft({ ...draft, surveyRound: Number(v) })} />
            </span>
          </Space>
          <Space wrap size={10}>
            <span>
              郁闭度 <InputNumber min={0} max={1} step={0.01} value={draft.canopyDensity} onChange={(v) => setDraft({ ...draft, canopyDensity: Number(v) })} />
            </span>
            <Input
              style={{ width: 260 }}
              placeholder="调查组"
              value={draft.crew}
              onChange={(e) => setDraft({ ...draft, crew: e.target.value })}
            />
          </Space>
        </Space>
      </Modal>

      <SubmitForReviewModal
        open={submitOpen}
        defaultPlotId={submitPlotId}
        onClose={() => setSubmitOpen(false)}
        onSubmitted={(plotId, r) => {
          const p = plots.find((it) => it.id === plotId);
          setToast(`「${p?.plotNo ?? ''}」第 ${r} 期记录已送审，该期次已停改，等待审核意见`);
        }}
      />
      <ReviewArchiveDrawer open={archiveOpen} defaultPlotId={archivePlotId} onClose={() => setArchiveOpen(false)} />
    </Space>
  );
}
