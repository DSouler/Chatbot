import React, { useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Tabs, Card, Space, message, Popconfirm, Select
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import Reasoning from './Reasoning/Reasoning';
import Retrieval from './Retrieval/Retrieval';
import LLM from './LLM/LLM';
import AddSettings from './AddSettings';

const { TabPane } = Tabs;
const { Option } = Select;

const Settings = () => {
  const [visible, setVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [activeTab, setActiveTab] = useState('retrieval');
  const [isNew, setIsNew] = useState(false);
  const [form] = Form.useForm();
  const [pageSize, setPageSize] = useState(10);

  const [data, setData] = useState([
    { id: 1, department: 'G2', company: 'VTI', createdAt: new Date(), updatedAt: new Date() },
    { id: 2, department: 'G4', company: 'VKR', createdAt: new Date(), updatedAt: new Date() },
    { id: 3, department: 'G7', company: 'HRI', createdAt: new Date(), updatedAt: new Date() },
  ]);

  const handleDelete = (id) => {
    setData((prev) => prev.filter((item) => item.id !== id));
    message.success('Setting deleted successfully!');
  };

  const handleCreate = (values) => {
    const timestamp = new Date();
    const newId = data.length ? Math.max(...data.map(d => d.id)) + 1 : 1;
    const newEntry = {
      id: newId,
      department: values.department,
      company: values.company,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setData([...data, newEntry]);
    setVisible(false);
    message.success('Setting added successfully!');
  };

  const handleSaveSettings = (updatedValues) => {
    setData(prevData =>
      prevData.map(item =>
        item.id === selectedRowId
          ? { ...item, ...updatedValues, updatedAt: new Date() }
          : item
      )
    );
    message.success('Setting updated successfully!');
  };

  const columns = [
    { title: 'ID', dataIndex: 'id' },
    { title: 'Department', dataIndex: 'department' },
    { title: 'Company', dataIndex: 'company' },
    {
      title: 'Date Created',
      dataIndex: 'createdAt',
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: 'Last Modified',
      dataIndex: 'updatedAt',
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: 'Actions',
      align: 'center',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedDepartment(record.department);
              setSelectedRowId(record.id);
              setIsNew(false);
              setVisible(true);
            }}
          >
            Edit
          </Button>
          <Popconfirm
            title="Are you sure to delete this setting?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button danger size="small" icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={<span style={{ fontSize: 22, fontWeight: 600 }}>Settings Management</span>}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setIsNew(true);
            setVisible(true);
            form.resetFields();
          }}
        >
          Add Setting
        </Button>
      }
      style={{ margin: 24 }}
    >
      {/* LLM Settings Global */}
      <div style={{ marginBottom: 32 }}>
        <LLM onSave={handleSaveSettings} />
      </div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end'}}>
      <Space>
        <span>
          Total: <strong>{data.length}</strong> settings
        </span>
        <Select
          value={pageSize}
          onChange={(value) => setPageSize(value)}
          style={{ width: 120 }}
        >
          <Option value={5}>5 / page</Option>
          <Option value={10}>10 / page</Option>
          <Option value={20}>20 / page</Option>
          <Option value={50}>50 / page</Option>
        </Select>
      </Space>
      </div>

      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize }}
      />

      <Modal
        open={visible}
        title={isNew ? 'Add Setting' : `Settings for ${selectedDepartment}`}
        onCancel={() => setVisible(false)}
        footer={null}
        width={800}
      >
        {isNew ? (
          <Form form={form} layout="vertical" onFinish={handleCreate}>
            <Form.Item
              label="Department"
              name="department"
              rules={[{ required: true, message: 'Please input department' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Company"
              name="company"
              rules={[{ required: true, message: 'Please input company' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                Create
              </Button>
            </Form.Item>
          </Form>
        ) : (
          <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key)}>
            <TabPane tab="Retrieval Settings" key="retrieval">
              <Retrieval department={selectedDepartment} onSave={handleSaveSettings} />
            </TabPane>
            <TabPane tab="Reasoning Settings" key="reasoning">
              <Reasoning department={selectedDepartment} onSave={handleSaveSettings} />
            </TabPane>
            <TabPane tab="LLM Settings" key="llm">
              <LLM department={selectedDepartment} onSave={handleSaveSettings} />
            </TabPane>
          </Tabs>
        )}
      </Modal>

      <AddSettings
        visible={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onCreate={(newSetting) => {
          const timestamp = new Date();
          const newId = data.length ? Math.max(...data.map(d => d.id)) + 1 : 1;
          setData([
            ...data,
            {
              id: newId,
              ...newSetting,
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ]);
          setAddModalVisible(false);
          message.success('Setting created successfully!');
        }}
      />
    </Card>
  );
};

export default Settings;
