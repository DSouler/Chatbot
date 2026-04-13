import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card, Row, Col, Statistic, Select, Button, Table, Tag, Tabs, Spin, Tooltip, Typography, Dropdown,
} from 'antd';
import {
  LikeOutlined, DislikeOutlined, ReloadOutlined, BarChartOutlined, MessageOutlined,
  DownloadOutlined, FileExcelOutlined, FilePdfOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
const TokenTab = ({ days, onData }) => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats]     = useState(null);
  const inputPrice  = DEFAULT_INPUT_PRICE;
  const outputPrice = DEFAULT_OUTPUT_PRICE;
  const usdVnd      = DEFAULT_USD_VND;

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsageStats(null, days);
      setStats(data);
      onData && onData(data);
    }
    catch { setStats(null); onData && onData(null); }
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
        {[
          {
            title: 'Tổng Tokens',
            value: (summary.total_tokens || 0).toLocaleString(),
            sub: `${days} ngày qua`,
          },
          {
            title: 'Input / Output',
            value: `${(summary.prompt_tokens || 0).toLocaleString()} / ${(summary.completion_tokens || 0).toLocaleString()}`,
            sub: summary.total_messages ? `~${Math.round((summary.total_tokens || 0) / summary.total_messages).toLocaleString()} tokens/tin` : '—',
          },
          {
            title: 'Chi Phí (USD)',
            value: fmtUSD(totalCostUSD),
            sub: `$${inputPrice.toFixed(4)}/1M in · $${outputPrice.toFixed(4)}/1M out`,
          },
          {
            title: 'Chi Phí (VND)',
            value: fmtVND(totalCostUSD * usdVnd),
            sub: `1 USD = ${usdVnd.toLocaleString('vi-VN')} ₫`,
          },
        ].map(card => (
          <Col key={card.title} xs={24} sm={12} lg={6}>
            <div style={{
              borderRadius: 14,
              padding: '20px 22px',
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
              color: '#fff',
              height: '100%',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.85, marginBottom: 8 }}>{card.title}</div>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 6 }}>{card.value}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{card.sub}</div>
            </div>
          </Col>
        ))}
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
const FeedbackTab = ({ days, onData }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getAdminFeedbackReport(days);
      setData(d);
      onData && onData(d);
    }
    catch { setData(null); onData && onData(null); }
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
      title: 'Ngày tạo', dataIndex: 'updated_at', key: 'created', width: 130,
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
  const [days, setDays]             = useState(30);
  const [activeTab, setActiveTab]   = useState('token');
  const [refreshKey, setRefreshKey] = useState(0);
  const tokenDataRef    = useRef(null);
  const feedbackDataRef = useRef(null);

  const handleRefresh = () => setRefreshKey(k => k + 1);

  // ── Excel export ────────────────────────────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Token sheet
    if (tokenDataRef.current) {
      const daily = tokenDataRef.current.daily ?? [];
      const summary = tokenDataRef.current.summary ?? {};
      const tokenRows = daily.map(r => ({
        'Ngày': String(r.day).slice(0, 10),
        'Input tokens': r.prompt_tokens || 0,
        'Output tokens': r.completion_tokens || 0,
        'Tổng tokens': r.total_tokens || 0,
        'Chi phí ($)': +calcCost(r.prompt_tokens || 0, r.completion_tokens || 0, DEFAULT_INPUT_PRICE, DEFAULT_OUTPUT_PRICE).toFixed(6),
        'Chi phí (₫)': Math.round(calcCost(r.prompt_tokens || 0, r.completion_tokens || 0, DEFAULT_INPUT_PRICE, DEFAULT_OUTPUT_PRICE) * DEFAULT_USD_VND),
        'Tin nhắn': r.messages || 0,
      }));
      tokenRows.push({
        'Ngày': 'TỔNG',
        'Input tokens': summary.prompt_tokens || 0,
        'Output tokens': summary.completion_tokens || 0,
        'Tổng tokens': summary.total_tokens || 0,
        'Chi phí ($)': +calcCost(summary.prompt_tokens || 0, summary.completion_tokens || 0, DEFAULT_INPUT_PRICE, DEFAULT_OUTPUT_PRICE).toFixed(6),
        'Chi phí (₫)': Math.round(calcCost(summary.prompt_tokens || 0, summary.completion_tokens || 0, DEFAULT_INPUT_PRICE, DEFAULT_OUTPUT_PRICE) * DEFAULT_USD_VND),
        'Tin nhắn': summary.total_messages || 0,
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tokenRows), 'Token Usage');
    }

    // Feedback sheet
    if (feedbackDataRef.current) {
      const summary = feedbackDataRef.current.summary ?? {};
      const daily   = feedbackDataRef.current.daily   ?? [];
      const fbSummaryRows = [
        { 'Chỉ số': 'Tổng Like',   'Giá trị': summary.total_up   || 0 },
        { 'Chỉ số': 'Tổng Dislike','Giá trị': summary.total_down || 0 },
        { 'Chỉ số': 'Điểm ròng',   'Giá trị': (summary.total_up || 0) - (summary.total_down || 0) },
        { 'Chỉ số': 'Người đã vote','Giá trị': summary.total_voters || 0 },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fbSummaryRows), 'Feedback Summary');

      const fbDailyRows = daily.map(r => ({
        'Ngày': String(r.day).slice(5, 10),
        'Like 👍': r.up_count   || 0,
        'Dislike 👎': r.down_count || 0,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fbDailyRows), 'Feedback Daily');

      const topLiked    = (feedbackDataRef.current.top_liked    ?? []).map((r, i) => ({ '#': i + 1, 'Nội dung': r.content, 'Like': r.up_count, 'Dislike': r.down_count, 'Ngày': String(r.updated_at || '').slice(0, 10) }));
      const topDisliked = (feedbackDataRef.current.top_disliked ?? []).map((r, i) => ({ '#': i + 1, 'Nội dung': r.content, 'Like': r.up_count, 'Dislike': r.down_count, 'Ngày': String(r.updated_at || '').slice(0, 10) }));
      if (topLiked.length)    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topLiked),    'Top Liked');
      if (topDisliked.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topDisliked), 'Top Disliked');
    }

    XLSX.writeFile(wb, `report_${days}days_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── PDF export ──────────────────────────────────────────────────────────────
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 40;

    doc.setFontSize(16); doc.setFont(undefined, 'bold');
    doc.text(`Bao cao & Thong ke - ${days} ngay qua`, pageW / 2, y, { align: 'center' });
    y += 14;
    doc.setFontSize(9); doc.setFont(undefined, 'normal');
    doc.text(`Xuat ngay: ${new Date().toLocaleDateString('vi-VN')}`, pageW / 2, y, { align: 'center' });
    y += 20;

    // Token section
    if (tokenDataRef.current) {
      const daily   = tokenDataRef.current.daily   ?? [];
      const summary = tokenDataRef.current.summary ?? {};
      doc.setFontSize(12); doc.setFont(undefined, 'bold');
      doc.text('Token Usage', 40, y); y += 10;

      autoTable(doc, {
        startY: y,
        head: [['Ngay', 'Input tokens', 'Output tokens', 'Tong tokens', 'Chi phi ($)', 'Chi phi (d)', 'Tin nhan']],
        body: [
          ...daily.map(r => [
            String(r.day).slice(0, 10),
            (r.prompt_tokens || 0).toLocaleString(),
            (r.completion_tokens || 0).toLocaleString(),
            (r.total_tokens || 0).toLocaleString(),
            fmtUSD(calcCost(r.prompt_tokens || 0, r.completion_tokens || 0, DEFAULT_INPUT_PRICE, DEFAULT_OUTPUT_PRICE)),
            fmtVND(calcCost(r.prompt_tokens || 0, r.completion_tokens || 0, DEFAULT_INPUT_PRICE, DEFAULT_OUTPUT_PRICE) * DEFAULT_USD_VND),
            r.messages || 0,
          ]),
          [
            'TONG',
            (summary.prompt_tokens || 0).toLocaleString(),
            (summary.completion_tokens || 0).toLocaleString(),
            (summary.total_tokens || 0).toLocaleString(),
            fmtUSD(calcCost(summary.prompt_tokens || 0, summary.completion_tokens || 0, DEFAULT_INPUT_PRICE, DEFAULT_OUTPUT_PRICE)),
            fmtVND(calcCost(summary.prompt_tokens || 0, summary.completion_tokens || 0, DEFAULT_INPUT_PRICE, DEFAULT_OUTPUT_PRICE) * DEFAULT_USD_VND),
            summary.total_messages || 0,
          ],
        ],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [22, 33, 62] },
        theme: 'striped',
      });
      y = doc.lastAutoTable.finalY + 20;
    }

    // Feedback section
    if (feedbackDataRef.current) {
      const summary  = feedbackDataRef.current.summary     ?? {};
      const topLiked = feedbackDataRef.current.top_liked   ?? [];
      const topDisliked = feedbackDataRef.current.top_disliked ?? [];

      doc.setFontSize(12); doc.setFont(undefined, 'bold');
      doc.text('Feedback Summary', 40, y); y += 10;

      autoTable(doc, {
        startY: y,
        head: [['Tong Like', 'Tong Dislike', 'Diem rong', 'Nguoi da vote']],
        body: [[summary.total_up || 0, summary.total_down || 0, (summary.total_up || 0) - (summary.total_down || 0), summary.total_voters || 0]],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [22, 33, 62] },
        theme: 'striped',
      });
      y = doc.lastAutoTable.finalY + 20;

      if (topLiked.length) {
        doc.setFontSize(11); doc.setFont(undefined, 'bold');
        doc.text('Top Liked Messages', 40, y); y += 10;
        autoTable(doc, {
          startY: y,
          head: [['#', 'Noi dung', 'Like', 'Dislike', 'Ngay']],
          body: topLiked.map((r, i) => [i + 1, (r.content || '').slice(0, 80), r.up_count, r.down_count, String(r.updated_at || '').slice(0, 10)]),
          styles: { fontSize: 7 },
          headStyles: { fillColor: [82, 196, 26] },
          theme: 'striped',
        });
        y = doc.lastAutoTable.finalY + 20;
      }

      if (topDisliked.length) {
        doc.setFontSize(11); doc.setFont(undefined, 'bold');
        doc.text('Top Disliked Messages', 40, y); y += 10;
        autoTable(doc, {
          startY: y,
          head: [['#', 'Noi dung', 'Like', 'Dislike', 'Ngay']],
          body: topDisliked.map((r, i) => [i + 1, (r.content || '').slice(0, 80), r.up_count, r.down_count, String(r.updated_at || '').slice(0, 10)]),
          styles: { fontSize: 7 },
          headStyles: { fillColor: [255, 77, 79] },
          theme: 'striped',
        });
      }
    }

    doc.save(`report_${days}days_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportMenuItems = [
    { key: 'excel', label: <span><FileExcelOutlined style={{ color: '#217346', marginRight: 6 }} />Xuất Excel (.xlsx)</span>, onClick: exportExcel },
    { key: 'pdf',   label: <span><FilePdfOutlined   style={{ color: '#e74c3c', marginRight: 6 }} />Xuất PDF (.pdf)</span>,   onClick: exportPDF },
  ];

  const tabItems = [
    {
      key: 'token',
      label: <span><BarChartOutlined style={{ marginRight: 4 }} />Token Usage</span>,
      children: <TokenTab key={`token-${days}-${refreshKey}`} days={days} onData={d => { tokenDataRef.current = d; }} />,
    },
    {
      key: 'feedback',
      label: <span><LikeOutlined style={{ marginRight: 4 }} />Feedback</span>,
      children: <FeedbackTab key={`feedback-${days}-${refreshKey}`} days={days} onData={d => { feedbackDataRef.current = d; }} />,
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#ffffff', minHeight: '100vh' }}>
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
          <Dropdown menu={{ items: exportMenuItems }} placement="bottomRight">
            <Button type="primary" icon={<DownloadOutlined />}>Xuất báo cáo</Button>
          </Dropdown>
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
