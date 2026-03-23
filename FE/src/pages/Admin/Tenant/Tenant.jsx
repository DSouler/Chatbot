import React, { useState, useEffect, useRef } from 'react';
import {
  Table, Button, Modal, Form, Input, message,
  Card, Space, Popconfirm, Select
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import AddTenant from './AddTenant';
import { useUser } from '../../../hooks/useUser';
import '../../../App.css';
import companies from './example/companies.json';

const { Option } = Select;
const initialData = companies;

const Tenant = () => {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const { user } = useUser();

  const [currentTime, setCurrentTime] = useState('');
  const intervalRef = useRef(null);

  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  useEffect(() => {
    if (modalVisible) {
      intervalRef.current = setInterval(() => {
        const now = new Date();
        const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        setCurrentTime(formatted);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [modalVisible]);

  const filteredData = data.filter(item =>
    item.id.toLowerCase().includes(search.toLowerCase()) ||
    item.tenant.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddTenant = (values) => {
    setData(prev => [
      {
        ...values,
        email: user?.email || '',
        date_created: currentTime,
        id: `${Date.now()}`,
      },
      ...prev,
    ]);
    setModalVisible(false);
    message.success('Company added successfully');
  };

  const handleDelete = (id) => {
    setData(prev => prev.filter(item => item.id !== id));
    message.success('Deleted successfully');
  };

  const handleEdit = (record) => {
    message.info(`Edit: ${record.tenant} (This feature is under development)`);
  };

  const columns = [
    {
      title: 'STT',
      key: 'index',
      render: (_, __, index) =>
        (pagination.current - 1) * pagination.pageSize + index + 1,
      width: 80,
    },
    { title: 'Company', dataIndex: 'tenant', key: 'tenant' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Date Created', dataIndex: 'date_created', key: 'date_created' },
    {
      title: 'Action',
      align: 'center',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Are you sure to delete?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button icon={<DeleteOutlined />} size="small" danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={<span style={{ fontSize: 22, fontWeight: 600 }}>Company Management</span>}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalVisible(true)}
        >
          Add Company
        </Button>
      }
      style={{ margin: 24 }}
    >
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Input
          placeholder="Search by ID or Name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 300 }}
        />

        <Space>
          <span>
            Total: <strong>{filteredData.length}</strong> companies
          </span>
          <Select
            value={pagination.pageSize}
            onChange={(value) => {
              setPagination({ ...pagination, pageSize: value, current: 1 });
            }}
            style={{ width: 120 }}
          >
            <Option value={5}>5 / page</Option>
            <Option value={10}>10 / page</Option>
            <Option value={20}>20 / page</Option>
            <Option value={50}>50 / page</Option>
          </Select>
        </Space>
      </Space>

      <div className="custom-scrollbar" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: filteredData.length,
            onChange: (page, pageSize) => {
              setPagination({ current: page, pageSize });
            },
          }}
          bordered
        />
      </div>

      <AddTenant
        visible={modalVisible}
        onCreate={handleAddTenant}
        onCancel={() => setModalVisible(false)}
        userEmail={user?.email || ''}
      />
    </Card>
  );
};

export default Tenant;
