import React, { useState, useEffect } from 'react';
import { Modal, Statistic, Table, Row, Col, Spin, Select, Divider, Tag, InputNumber, Button, Tooltip as AntTooltip } from 'antd';
import { SettingOutlined, ReloadOutlined, RobotOutlined } from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { getUsageStats } from '../services/chat';
import { getLLMConfig } from '../config/chatConfig';

const { Option } = Select;

const DEFAULT_INPUT_PRICE  = 0.15;   // USD per 1M input tokens
const DEFAULT_OUTPUT_PRICE = 0.60;   // USD per 1M output tokens
const DEFAULT_USD_VND      = 25400;  // 1 USD = VND

const cardStyle = {
  padding: '16px 20px',
  background: '#fff',
  borderRadius: 10,
  border: '1px solid #e8e8e8',
  height: '100%',
};

const fmtUSD = v => `$${v < 0.01 ? v.toFixed(6) : v.toFixed(4)}`;
const fmtVND = v => `₫${Math.round(v).toLocaleString('vi-VN')}`;

const calcCost = (promptTk, completionTk, inputPrice, outputPrice) =>
  (promptTk / 1_000_000) * inputPrice + (completionTk / 1_000_000) * outputPrice;

const CustomTooltip = ({ active, payload, label, inputPrice, outputPrice, usdVnd }) => {
  if (!active || !payload?.length) return null;
  const input  = payload.find(p => p.dataKey === 'prompt_tokens')?.value ?? 0;
  const output = payload.find(p => p.dataKey === 'completion_tokens')?.value ?? 0;
  const costUSD = calcCost(input, output, inputPrice, outputPrice);
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, padding: '10px 14px', fontSize: 13, minWidth: 180 }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: '#333' }}>{label}</div>
      <div style={{ color: '#1677ff', marginBottom: 2 }}>Input:  <strong>{input.toLocaleString()}</strong> tokens</div>
      <div style={{ color: '#52c41a', marginBottom: 6 }}>Output: <strong>{output.toLocaleString()}</strong> tokens</div>
      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 6 }}>
        <div style={{ color: '#fa8c16' }}>Chi phí: <strong>{fmtUSD(costUSD)}</strong></div>
        <div style={{ color: '#eb2f96' }}>= <strong>{fmtVND(costUSD * usdVnd)}</strong></div>
      </div>
    </div>
  );
};

const ReportModal = ({ open, onClose, userId }) => {
  const modelName = getLLMConfig().model || 'gpt-4o-mini';

  const [loading, setLoading]       = useState(false);
  const [stats, setStats]           = useState(null);
  const [days, setDays]             = useState(30);
  const [showSettings, setShowSettings] = useState(false);
  const [inputPrice, setInputPrice]   = useState(DEFAULT_INPUT_PRICE);
  const [outputPrice, setOutputPrice] = useState(DEFAULT_OUTPUT_PRICE);
  const [usdVnd, setUsdVnd]           = useState(DEFAULT_USD_VND);
  const [rateLoading, setRateLoading] = useState(false);

  useEffect(() => { if (open) fetchStats(); }, [open, days]);

  const fetchStats = async () => {
    setLoading(true);
    try   { setStats(await getUsageStats(userId, days)); }
    catch { setStats(null); }
    finally { setLoading(false); }
  };

  const fetchLiveRate = async () => {
    setRateLoading(true);
    try {
      const res  = await fetch('https://api.frankfurter.app/latest?from=USD&to=VND');
      const data = await res.json();
      if (data?.rates?.VND) setUsdVnd(Math.round(data.rates.VND));
    } catch { /* keep current */ }
    finally { setRateLoading(false); }
  };

  const summary  = stats?.summary ?? {};
  const rawDaily = stats?.daily   ?? [];

  const totalCostUSD = calcCost(
    summary.prompt_tokens || 0,
    summary.completion_tokens || 0,
    inputPrice, outputPrice,
  );
  const totalCostVND = totalCostUSD * usdVnd;
  const avgPerMsg    = summary.messages > 0
    ? Math.round((summary.total_tokens || 0) / summary.messages) : 0;

  const chartData = [...rawDaily]
    .sort((a, b) => String(a.day).localeCompare(String(b.day)))
    .map(r => ({ ...r, day: String(r.day).slice(5, 10) }));

  const tableColumns = [
    {
      title: 'Ngày',
      dataIndex: 'day',
      key: 'day',
      render: v => String(v).slice(0, 10),
    },
    {
      title: 'Input',
      dataIndex: 'prompt_tokens',
      key: 'prompt_tokens',
      align: 'right',
      render: v => <Tag color="blue">{(v || 0).toLocaleString()}</Tag>,
    },
    {
      title: 'Output',
      dataIndex: 'completion_tokens',
      key: 'completion_tokens',
      align: 'right',
      render: v => <Tag color="green">{(v || 0).toLocaleString()}</Tag>,
    },
    {
      title: 'Tổng tokens',
      dataIndex: 'total_tokens',
      key: 'total_tokens',
      align: 'right',
      render: v => <strong>{(v || 0).toLocaleString()}</strong>,
    },
    {
      title: 'Chi phí ($)',
      key: 'cost_usd',
      align: 'right',
      render: (_, row) => (
        <span style={{ color: '#fa8c16', fontWeight: 500 }}>
          {fmtUSD(calcCost(row.prompt_tokens || 0, row.completion_tokens || 0, inputPrice, outputPrice))}
        </span>
      ),
    },
    {
      title: 'Chi phí (₫)',
      key: 'cost_vnd',
      align: 'right',
      render: (_, row) => (
        <span style={{ color: '#eb2f96', fontWeight: 500 }}>
          {fmtVND(calcCost(row.prompt_tokens || 0, row.completion_tokens || 0, inputPrice, outputPrice) * usdVnd)}
        </span>
      ),
    },
    {
      title: 'Tin nhắn',
      dataIndex: 'messages',
      key: 'messages',
      align: 'right',
    },
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Báo Cáo Sử Dụng Token</span>
          <Tag icon={<RobotOutlined />} color="purple" style={{ fontWeight: 500, fontSize: 12 }}>
            {modelName}
          </Tag>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={940}
    >
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Button
          size="small"
          icon={<SettingOutlined />}
          type={showSettings ? 'primary' : 'default'}
          onClick={() => setShowSettings(s => !s)}
        >
          Đơn giá
        </Button>
        <Select value={days} onChange={setDays} size="small" style={{ width: 130 }}>
          <Option value={7}>7 ngày qua</Option>
          <Option value={30}>30 ngày qua</Option>
          <Option value={90}>90 ngày qua</Option>
        </Select>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div style={{
          background: '#f6f8fa', borderRadius: 8, padding: '12px 16px',
          marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', fontSize: 13,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#666' }}>Input ($/1M):</span>
            <InputNumber
              size="small" min={0} step={0.01} value={inputPrice}
              onChange={v => setInputPrice(v ?? 0)}
              style={{ width: 90 }} stringMode
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#666' }}>Output ($/1M):</span>
            <InputNumber
              size="small" min={0} step={0.01} value={outputPrice}
              onChange={v => setOutputPrice(v ?? 0)}
              style={{ width: 90 }} stringMode
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#666' }}>1 USD =</span>
            <InputNumber
              size="small" min={1} step={100} value={usdVnd}
              onChange={v => setUsdVnd(v ?? DEFAULT_USD_VND)}
              style={{ width: 100 }}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => v.replace(/,/g, '')}
            />
            <span style={{ color: '#666' }}>VND</span>
            <AntTooltip title="Lấy tỷ giá thực tế">
              <Button
                size="small" icon={<ReloadOutlined />}
                loading={rateLoading} onClick={fetchLiveRate}
              />
            </AntTooltip>
          </div>
        </div>
      )}

      <Spin spinning={loading}>
        {/* Summary cards */}
        <Row gutter={12} style={{ marginBottom: 20 }}>
          <Col span={6}>
            <div style={cardStyle}>
              <Statistic
                title={<span style={{ fontSize: 12, color: '#888' }}>Tổng Tokens</span>}
                value={summary.total_tokens || 0}
                valueStyle={{ color: '#722ed1', fontSize: 22, fontWeight: 700 }}
              />
              <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>{days} ngày qua</div>
            </div>
          </Col>
          <Col span={6}>
            <div style={cardStyle}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Input / Output</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#1677ff' }}>
                  {(summary.prompt_tokens || 0).toLocaleString()}
                </span>
                <span style={{ color: '#ccc' }}>/</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#52c41a' }}>
                  {(summary.completion_tokens || 0).toLocaleString()}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>~{avgPerMsg.toLocaleString()} tokens/tin</div>
            </div>
          </Col>
          <Col span={6}>
            <div style={cardStyle}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Chi Phí (USD)</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fa8c16' }}>
                {fmtUSD(totalCostUSD)}
              </div>
              <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                {fmtUSD(inputPrice)}/1M in · {fmtUSD(outputPrice)}/1M out
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div style={cardStyle}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Chi Phí (VND)</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#eb2f96' }}>
                {fmtVND(totalCostVND)}
              </div>
              <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                1 USD = {usdVnd.toLocaleString()} ₫
              </div>
            </div>
          </Col>
        </Row>

        {/* Bar chart */}
        <div style={{
          background: '#fafafa', borderRadius: 10, border: '1px solid #f0f0f0',
          padding: '16px 16px 8px 8px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 12, paddingLeft: 8 }}>
            Token Usage theo ngày
          </div>
          {chartData.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#bbb', padding: '32px 0', fontSize: 13 }}>
              Chưa có dữ liệu. Hãy gửi tin nhắn để bắt đầu theo dõi.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barSize={chartData.length < 8 ? 28 : 16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip content={<CustomTooltip inputPrice={inputPrice} outputPrice={outputPrice} usdVnd={usdVnd} />}
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="prompt_tokens" name="Input" stackId="a" fill="#1677ff" radius={[0, 0, 0, 0]} />
                <Bar dataKey="completion_tokens" name="Output" stackId="a" fill="#52c41a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Daily table */}
        <Divider style={{ margin: '0 0 12px 0' }} />
        <Table
          dataSource={[...rawDaily]
            .sort((a, b) => String(b.day).localeCompare(String(a.day)))
            .map((r, i) => ({ ...r, key: i }))}
          columns={tableColumns}
          size="small"
          pagination={{ pageSize: 7, hideOnSinglePage: true, size: 'small' }}
          locale={{ emptyText: ' ' }}
          scroll={{ x: true }}
        />
      </Spin>
    </Modal>
  );
};

export default ReportModal;
