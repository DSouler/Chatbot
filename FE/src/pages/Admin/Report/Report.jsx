import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Statistic, Select, Button, Table, Tag, Tabs, Spin, Tooltip, Typography,
} from 'antd';
import {
  LikeOutlined, DislikeOutlined, ReloadOutlined, BarChartOutlined, MessageOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { getUsageStats, getAdminFeedbackReport } from '../../../services/chat';

const { Option } = Select;
const { Text } = Typography;

// ── helpers ─────────────────────────────────────────────────────────────────
const DEFAULT_INPUT_PRICE  = 0.20;
const DEFAULT_OUTPUT_PRICE = 1.25;
const DEFAULT_USD_VND      = 25400;

const fmtUSD = v => `$${v < 0.01 ? v.toFixed(6) : v.toFixed(4)}`;
const fmtVND = v => `₫${Math.round(v).toLocaleString('vi-VN')}`;
const calcCost = (p, c, ip, op) => (p / 1_000_000) * ip + (c / 1_000_000) * op;

const cardStyle = {
  borderRadius: 10,
  border: '1px solid #e8e8e8',
  height: '100%',
};

// ── Token Usage Tab ──────────────────────────────────────────────────────────
const TokenTab = ({ days }) => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats]     = useState(null);
  const inputPrice  = DEFAULT_INPUT_PRICE;
  const outputPrice = DEFAULT_OUTPUT_PRICE;
  const usdVnd      = DEFAULT_USD_VND;

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try   { setStats(await getUsageStats(null, days)); }
    catch { setStats(null); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const summary  = stats?.summary ?? {};
  const rawDaily = stats?.daily   ?? [];

  const totalCostUSD = calcCost(
    summary.prompt_tokens || 0, summary.completion_tokens || 0, inputPrice, outputPrice,
  );

  const chartData = [...rawDaily]
    .sort((a, b) => String(a.day).localeCompare(String(b.day)))
    .map(r => ({ ...r, day: String(r.day).slice(5, 10) }));

  const columns = [
    { title: 'Ngày', dataIndex: 'day', key: 'day', render: v => String(v).slice(0, 10) },
    {
      title: 'Input tokens', dataIndex: 'prompt_tokens', key: 'pt', align: 'right',
      render: v => <Tag color="blue">{(v || 0).toLocaleString()}</Tag>,
    },
    {
      title: 'Output tokens', dataIndex: 'completion_tokens', key: 'ct', align: 'right',
      render: v => <Tag color="green">{(v || 0).toLocaleString()}</Tag>,
    },
    {
      title: 'Tổng tokens', dataIndex: 'total_tokens', key: 'tt', align: 'right',
      render: v => <strong>{(v || 0).toLocaleString()}</strong>,
    },
    {
      title: 'Chi phí ($)', key: 'usd', align: 'right',
      render: (_, r) => (
        <span style={{ color: '#fa8c16', fontWeight: 500 }}>
          {fmtUSD(calcCost(r.prompt_tokens || 0, r.completion_tokens || 0, inputPrice, outputPrice))}
        </span>
      ),
    },
    {
      title: 'Chi phí (₫)', key: 'vnd', align: 'right',
      render: (_, r) => (
        <span style={{ color: '#eb2f96', fontWeight: 500 }}>
          {fmtVND(calcCost(r.prompt_tokens || 0, r.completion_tokens || 0, inputPrice, outputPrice) * usdVnd)}
        </span>
      ),
    },
    { title: 'Tin nhắn', dataIndex: 'messages', key: 'msgs', align: 'right' },
  ];

  return (
    <Spin spinning={loading}>
      {/* Summary cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle}>
            <Statistic title="Tổng tokens" value={summary.total_tokens || 0}
              formatter={v => v.toLocaleString()} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle}>
            <Statistic title="Input tokens" value={summary.prompt_tokens || 0}
              formatter={v => v.toLocaleString()} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle}>
            <Statistic title="Output tokens" value={summary.completion_tokens || 0}
              formatter={v => v.toLocaleString()} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle}>
            <Statistic title="Ước tính chi phí" value={fmtUSD(totalCostUSD)}
              suffix={<span style={{ fontSize: 12, color: '#999' }}>≈ {fmtVND(totalCostUSD * usdVnd)}</span>}
              valueStyle={{ color: '#fa8c16', fontSize: 18 }} />
          </Card>
        </Col>
      </Row>

      {/* Chart */}
      <Card style={{ ...cardStyle, marginBottom: 20 }} title="Token theo ngày">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <ChartTooltip />
            <Legend />
            <Bar dataKey="prompt_tokens" name="Input" fill="#1677ff" radius={[3, 3, 0, 0]} />
            <Bar dataKey="completion_tokens" name="Output" fill="#52c41a" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Table */}
      <Card style={cardStyle} title="Chi tiết theo ngày">
        <Table
          dataSource={rawDaily.map((r, i) => ({ ...r, key: i }))}
          columns={columns}
          size="small"
          pagination={{ pageSize: 10, showSizeChanger: false }}
        />
      </Card>
    </Spin>
  );
};

// ── Feedback Tab ─────────────────────────────────────────────────────────────
const FeedbackTab = ({ days }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try   { setData(await getAdminFeedbackReport(days)); }
    catch { setData(null); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const summary     = data?.summary     ?? {};
  const daily       = data?.daily       ?? [];
  const topLiked    = data?.top_liked   ?? [];
  const topDisliked = data?.top_disliked ?? [];

  const netScore  = (summary.total_up || 0) - (summary.total_down || 0);
  const chartData = daily.map(r => ({ ...r, day: String(r.day).slice(5, 10) }));

  const messageColumns = (colorKey) => [
    {
      title: '#', key: 'idx', width: 50,
      render: (_, __, i) => i + 1,
    },
    {
      title: 'Nội dung tin nhắn', dataIndex: 'content', key: 'content',
      render: v => (
        <Tooltip title={v} placement="topLeft">
          <Text ellipsis style={{ maxWidth: 420 }}>{v || '—'}</Text>
        </Tooltip>
      ),
    },
    {
      title: <span style={{ color: '#52c41a' }}>👍 Like</span>,
      dataIndex: 'up_count', key: 'up', align: 'center', width: 90,
      render: v => <Tag color="success">{v}</Tag>,
    },
    {
      title: <span style={{ color: '#ff4d4f' }}>👎 Dislike</span>,
      dataIndex: 'down_count', key: 'down', align: 'center', width: 90,
      render: v => <Tag color="error">{v}</Tag>,
    },
    {
      title: 'Ngày tạo', dataIndex: 'message_created_at', key: 'created', width: 130,
      render: v => v ? String(v).slice(0, 10) : '—',
    },
  ];

  return (
    <Spin spinning={loading}>
      {/* Summary cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle}>
            <Statistic title="Tổng Like 👍"
              value={summary.total_up || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<LikeOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle}>
            <Statistic title="Tổng Dislike 👎"
              value={summary.total_down || 0}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<DislikeOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle}>
            <Statistic title="Điểm ròng (Like − Dislike)"
              value={netScore}
              valueStyle={{ color: netScore >= 0 ? '#52c41a' : '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle}>
            <Statistic title="Người dùng đã vote"
              value={summary.total_voters || 0}
              prefix={<MessageOutlined />}
              valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
      </Row>

      {/* Daily feedback chart */}
      <Card style={{ ...cardStyle, marginBottom: 20 }} title="Like / Dislike theo ngày">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <ChartTooltip />
            <Legend />
            <Bar dataKey="up_count"   name="Like 👍"    fill="#52c41a" radius={[3, 3, 0, 0]} />
            <Bar dataKey="down_count" name="Dislike 👎" fill="#ff4d4f" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Top liked messages */}
      <Card
        style={{ ...cardStyle, marginBottom: 20 }}
        title={<span><LikeOutlined style={{ color: '#52c41a', marginRight: 6 }} />Top 10 câu trả lời được đánh giá tốt nhất</span>}
      >
        <Table
          dataSource={topLiked.map((r, i) => ({ ...r, key: i }))}
          columns={messageColumns('up')}
          size="small"
          pagination={false}
        />
      </Card>

      {/* Top disliked messages */}
      <Card
        style={cardStyle}
        title={<span><DislikeOutlined style={{ color: '#ff4d4f', marginRight: 6 }} />Top 10 câu trả lời bị đánh giá thấp nhất</span>}
      >
        <Table
          dataSource={topDisliked.map((r, i) => ({ ...r, key: i }))}
          columns={messageColumns('down')}
          size="small"
          pagination={false}
        />
      </Card>
    </Spin>
  );
};

// ── Main Report Page ─────────────────────────────────────────────────────────
const Report = () => {
  const [days, setDays]         = useState(30);
  const [activeTab, setActiveTab] = useState('token');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey(k => k + 1);

  const tabItems = [
    {
      key: 'token',
      label: <span><BarChartOutlined style={{ marginRight: 4 }} />Token Usage</span>,
      children: <TokenTab key={`token-${days}-${refreshKey}`} days={days} />,
    },
    {
      key: 'feedback',
      label: <span><LikeOutlined style={{ marginRight: 4 }} />Feedback</span>,
      children: <FeedbackTab key={`feedback-${days}-${refreshKey}`} days={days} />,
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#f5f6fa', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>📊 Báo cáo & Thống kê</h2>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>
            Tổng hợp token sử dụng và phản hồi của người dùng
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Select value={days} onChange={setDays} size="middle" style={{ width: 140 }}>
            <Option value={7}>7 ngày qua</Option>
            <Option value={30}>30 ngày qua</Option>
            <Option value={90}>90 ngày qua</Option>
            <Option value={365}>1 năm qua</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>Làm mới</Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        style={{ background: 'transparent' }}
      />
    </div>
  );
};

export default Report;
