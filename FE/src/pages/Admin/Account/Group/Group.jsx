import React, { useState, useEffect, useRef } from 'react';
import {
  Table, Button, Input, Card, Select, Space, Popconfirm, message
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined
} from '@ant-design/icons';
import AddGroup from './AddGroup';
import { useUser } from '../../../../hooks/useUser';
import departments from './example/departments.json';

const { Option } = Select;

const initialData = Object.entries(departments).flatMap(([company, groupsObj]) =>
  Object.entries(groupsObj).map(([group, description]) => ({
    key: `${company}-${group}`,
    group,
    company,
    description,
    date_created: new Date().toISOString().slice(0, 19).replace('T', ' ')
  }))
);

const Group = () => {
  const [data, setData] = useState(initialData);
  const [searchText, setSearchText] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(undefined);
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const { user } = useUser();
  const [currentTime, setCurrentTime] = useState('');
  const intervalRef = useRef(null);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

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

  const handleAddGroup = (values) => {
    if (editItem) {
      setData(prev =>
        prev.map(item =>
          item.key === editItem.key ? { ...item, ...values } : item
        )
      );
      message.success('Group updated successfully.');
    } else {
      const newItem = {
        key: `${values.company}-${values.group}-${Date.now()}`,
        ...values,
        email: user?.email || '',
        date_created: currentTime || new Date().toISOString().slice(0, 19).replace('T', ' ')
      };
      setData(prev => [newItem, ...prev]);
      message.success('Group added successfully.');
    }
    setModalVisible(false);
    setEditItem(null);
  };

  const handleEdit = (record) => {
    setEditItem(record);
    setModalVisible(true);
  };

  const handleDelete = (key) => {
    setData(prev => prev.filter(item => item.key !== key));
    message.success('Group deleted.');
  };

  const filteredData = data
    .filter(item => item.group.toLowerCase().includes(searchText.toLowerCase()))
    .filter(item => (selectedCompany ? item.company === selectedCompany : true));

  const companyOptions = Object.keys(departments);

  const columns = [
    {
      title: 'STT',
      key: 'index',
      render: (_text, _record, index) => index + 1,
      width: 70,
    },
    {
      title: 'Group',
      dataIndex: 'group',
      key: 'group',
    },
    {
      title: 'Company',
      dataIndex: 'company',
      key: 'company',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Date Created',
      dataIndex: 'date_created',
      key: 'date_created',
    },
    {
      title: 'Action',
      align: 'center',
      key: 'action',
      render: (_text, record) => (
        <Space>
          <Button icon={<EditOutlined />}
          size="small"
            onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Are you sure to delete this group?"
            onConfirm={() => handleDelete(record.key)}
            okText="Yes"
            cancelText="No"
          >
            <Button danger icon={<DeleteOutlined />}
            size="small"
            >Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={<span style={{ fontSize: 22, fontWeight: 600 }}>Group Management</span>}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditItem(null);
            setModalVisible(true);
          }}
        >
          Add Group
        </Button>
      }
      style={{ margin: 24 }}
    >
      <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Input
            placeholder="Search group name..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
          />
          <Select
            placeholder="Filter by company"
            allowClear
            value={selectedCompany}
            onChange={value => setSelectedCompany(value)}
            style={{ width: 200 }}
          >
            {companyOptions.map(company => (
              <Option key={company} value={company}>{company}</Option>
            ))}
          </Select>
        </Space>

        <Space>
          <span>Total: <strong>{filteredData.length}</strong> departments</span>
          <Select
            value={pageSize}
            onChange={value => setPageSize(value)}
            style={{ width: 120 }}
          >
            <Option value={5}>5 / page</Option>
            <Option value={10}>10 / page</Option>
            <Option value={20}>20 / page</Option>
            <Option value={50}>50 / page</Option>
          </Select>
        </Space>
      </Space>

    <Table
      columns={columns}
      dataSource={filteredData}
      rowKey="key"
      pagination={{ pageSize }}
      bordered
      rowClassName={() => 'custom-row-height'}
    />


      <AddGroup
        visible={modalVisible}
        onCreate={handleAddGroup}
        onCancel={() => {
          setModalVisible(false);
          setEditItem(null);
        }}
        companyOptions={companyOptions}
        initialValues={editItem}
      />
    </Card>
  );
};

export default Group;
